import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestMCPServer } from '../core/TestMCPServer';
import { ServerConfig, MCPRequest, MCPResponse } from '../types/index';

describe('BaseMCPServer', () => {
  let server: TestMCPServer;
  let config: ServerConfig;

  beforeEach(() => {
    config = {
      name: 'test-server',
      version: '1.0.0',
      capabilities: {
        tools: [],
      },
      transport: {
        type: 'stdio',
      },
    };
    server = new TestMCPServer(config);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Initialization', () => {
    it('should create server with correct config', () => {
      expect(server.getServerInfo()).toEqual({
        name: 'test-server',
        version: '1.0.0',
      });
    });

    it('should start with correct status', () => {
      const status = server.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.uptime).toBeGreaterThan(0);
    });

    it('should have server instructions', () => {
      expect(server['getServerInstructions']()).toBe('Test MCP server for unit testing');
    });
  });

  describe('Request Processing', () => {
    it('should process valid echo request', async () => {
      const request: MCPRequest = {
        id: 'test-1',
        method: 'echo',
        params: { message: 'Hello World' },
        timestamp: Date.now(),
      };

      const response = await server.processRequest(request);
      
      expect(response.id).toBe('test-1');
      expect(response.result).toEqual({
        message: 'Hello World',
      });
      expect(response.error).toBeUndefined();
    });

    it('should process valid add request', async () => {
      const request: MCPRequest = {
        id: 'test-2',
        method: 'add',
        params: { a: 5, b: 3 },
        timestamp: Date.now(),
      };

      const response = await server.processRequest(request);
      
      expect(response.id).toBe('test-2');
      expect(response.result).toEqual({
        result: 8,
      });
      expect(response.error).toBeUndefined();
    });

    it('should handle request without params', async () => {
      const request: MCPRequest = {
        id: 'test-3',
        method: 'echo',
        timestamp: Date.now(),
      };

      const response = await server.processRequest(request);
      
      expect(response.id).toBe('test-3');
      expect(response.result).toEqual({
        message: 'No message provided',
      });
    });

    it('should handle invalid request', async () => {
      const invalidRequest: MCPRequest = {
        id: '',
        method: 'echo',
        timestamp: Date.now(),
      };

      const response = await server.processRequest(invalidRequest);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toBe('Invalid Request');
    });

    it('should handle unknown method', async () => {
      const request: MCPRequest = {
        id: 'test-4',
        method: 'unknown.method',
        timestamp: Date.now(),
      };

      const response = await server.processRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe('Method not found');
    });

    it('should handle request processing error', async () => {
      // Create a server that throws an error
      class ErrorServer extends TestMCPServer {
        protected override async handleRequest(_request: MCPRequest): Promise<MCPResponse> {
          throw new Error('Test error');
        }
      }

      const errorServer = new ErrorServer(config);
      const request: MCPRequest = {
        id: 'test-5',
        method: 'echo',
        timestamp: Date.now(),
      };

      const response = await errorServer.processRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32603);
      expect(response.error?.message).toContain('Internal error');
    });
  });

  describe('Event Handling', () => {
    it('should emit and receive server:started event', async () => {
      const eventHandler = jest.fn();
      server.on('server:started', eventHandler);

      await server.start();
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should emit and receive server:stopped event', async () => {
      const eventHandler = jest.fn();
      server.on('server:stopped', eventHandler);

      await server.start();
      await server.stop();
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should emit and receive request:received event', async () => {
      const eventHandler = jest.fn();
      server.on('request:received', eventHandler);

      const request: MCPRequest = {
        id: 'test-6',
        method: 'echo',
        timestamp: Date.now(),
      };

      await server.processRequest(request);
      
      expect(eventHandler).toHaveBeenCalledWith(request);
    });

    it('should emit and receive response:sent event', async () => {
      const eventHandler = jest.fn();
      server.on('response:sent', eventHandler);

      const request: MCPRequest = {
        id: 'test-7',
        method: 'echo',
        timestamp: Date.now(),
      };

      const response = await server.processRequest(request);
      
      expect(eventHandler).toHaveBeenCalledWith(response);
    });

    it('should handle event handler errors gracefully', async () => {
      const errorHandler = jest.fn();
      server.on('error', errorHandler);

      // Add an event handler that throws an error
      server.on('request:received', () => {
        throw new Error('Handler error');
      });

      const request: MCPRequest = {
        id: 'test-8',
        method: 'echo',
        timestamp: Date.now(),
      };

      await server.processRequest(request);
      
      // The error should be caught and logged, so the error handler should be called
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should remove event handlers', () => {
      const eventHandler = jest.fn();
      server.on('server:started', eventHandler);
      server.off('server:started', eventHandler);

      expect(server['eventHandlers'].get('server:started')).not.toContain(eventHandler);
    });
  });

  describe('Response Creation', () => {
    it('should create success response correctly', () => {
      const response = server['createSuccessResponse']('test-id', { data: 'test' });
      
      expect(response.id).toBe('test-id');
      expect(response.result).toEqual({ data: 'test' });
      expect(response.error).toBeUndefined();
      expect(response.timestamp).toBeGreaterThan(0);
    });

    it('should create error response correctly', () => {
      const response = server['createErrorResponse']('test-id', 400, 'Bad Request', { details: 'test' });
      
      expect(response.id).toBe('test-id');
      expect(response.error).toEqual({
        code: 400,
        message: 'Bad Request',
        data: { details: 'test' },
      });
      expect(response.result).toBeUndefined();
      expect(response.timestamp).toBeGreaterThan(0);
    });

    it('should validate request correctly', () => {
      const validRequest: MCPRequest = {
        id: 'test-id',
        method: 'test.method',
        timestamp: Date.now(),
      };

      const invalidRequest1: MCPRequest = {
        id: '',
        method: 'test.method',
        timestamp: Date.now(),
      };

      const invalidRequest2: MCPRequest = {
        id: 'test-id',
        method: '',
        timestamp: Date.now(),
      };

      expect(server['validateRequest'](validRequest)).toBe(true);
      expect(server['validateRequest'](invalidRequest1)).toBe(false);
      expect(server['validateRequest'](invalidRequest2)).toBe(false);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server correctly', async () => {
      await server.start();
      expect(server.getStatus().isRunning).toBe(true);

      await server.stop();
      expect(server.getStatus().isRunning).toBe(false);
    });

    it('should handle start errors', async () => {
      class ErrorStartServer extends TestMCPServer {
        protected override createTransport(): any {
          throw new Error('Transport error');
        }
      }

      const errorServer = new ErrorStartServer(config);
      
      await expect(errorServer.start()).rejects.toThrow('Transport error');
    });

    it('should handle stop errors', async () => {
      class ErrorStopServer extends TestMCPServer {
        protected override createTransport(): any {
          return {
            connect: async () => {},
            close: async () => {
              throw new Error('Close error');
            },
          };
        }
      }

      const errorServer = new ErrorStopServer(config);
      await errorServer.start();
      
      await expect(errorServer.stop()).rejects.toThrow('Close error');
    });
  });
});