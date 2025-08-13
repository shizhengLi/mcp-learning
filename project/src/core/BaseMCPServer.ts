import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ServerConfig, MCPRequest, MCPResponse } from '../types/index';

export abstract class BaseMCPServer {
  protected server: McpServer;
  protected config: ServerConfig;
  protected isRunning: boolean = false;
  protected eventHandlers: Map<string, Function[]> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        instructions: this.getServerInstructions(),
      }
    );
    
    this.initializeEventHandlers();
    this.setupServer();
  }

  protected abstract getServerInstructions(): string;
  protected abstract initializeTools(): void;
  protected abstract initializeResources(): void;
  protected abstract handleRequest(request: MCPRequest): Promise<MCPResponse>;

  protected initializeEventHandlers(): void {
    this.on('server:started', () => {
      console.log(`Server ${this.config.name} started`);
    });
    
    this.on('server:stopped', () => {
      console.log(`Server ${this.config.name} stopped`);
    });
    
    this.on('request:received', (request: MCPRequest) => {
      console.log(`Received request: ${request.method}`);
    });
    
    this.on('response:sent', (response: MCPResponse) => {
      console.log(`Sent response for request: ${response.id}`);
    });
    
    this.on('error', (error: Error) => {
      console.error(`Server error: ${error.message}`);
    });
  }

  protected setupServer(): void {
    this.initializeTools();
    this.initializeResources();
  }

  public async start(): Promise<void> {
    try {
      // For testing, check if transport has start method
      const transport = this.createTransport();
      if (transport.start) {
        await transport.start();
      }
      this.isRunning = true;
      this.emit('server:started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      if (this.isRunning) {
        // For testing, check if transport has close method
        const transport = this.createTransport();
        if (transport.close) {
          await transport.close();
        }
        this.isRunning = false;
        this.emit('server:stopped');
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async processRequest(request: MCPRequest): Promise<MCPResponse> {
    this.emit('request:received', request);
    
    try {
      const response = await this.handleRequest(request);
      this.emit('response:sent', response);
      return response;
    } catch (error) {
      const errorResponse: MCPResponse = {
        id: request.id,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        timestamp: Date.now(),
      };
      this.emit('response:sent', errorResponse);
      return errorResponse;
    }
  }

  protected abstract createTransport(): any;

  public getStatus(): { isRunning: boolean; uptime: number } {
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
    };
  }

  public getServerInfo(): { name: string; version: string } {
    return {
      name: this.config.name,
      version: this.config.version,
    };
  }

  // Event handling
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  protected emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
          // Emit error event for event handler errors
          if (event !== 'error') {
            this.emit('error', error);
          }
        }
      });
    }
  }

  protected createErrorResponse(
    requestId: string, 
    code: number, 
    message: string, 
    data?: any
  ): MCPResponse {
    return {
      id: requestId,
      error: {
        code,
        message,
        data,
      },
      timestamp: Date.now(),
    };
  }

  protected createSuccessResponse(
    requestId: string, 
    result: any
  ): MCPResponse {
    return {
      id: requestId,
      result,
      timestamp: Date.now(),
    };
  }

  protected validateRequest(request: MCPRequest): boolean {
    return (
      !!request.id &&
      !!request.method &&
      !!request.timestamp &&
      typeof request.id === 'string' &&
      typeof request.method === 'string' &&
      typeof request.timestamp === 'number'
    );
  }
}