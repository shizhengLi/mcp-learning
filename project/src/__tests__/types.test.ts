import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { 
  ServerConfig, 
  MCPRequest, 
  MCPResponse, 
  AuthContext,
  Metric
} from '../types/index.js';

describe('Type Definitions', () => {
  describe('ServerConfig', () => {
    it('should create valid server config', () => {
      const config: ServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        capabilities: {
          tools: [
            {
              name: 'test-tool',
              description: 'A test tool',
              inputSchema: z.object({
                input: z.string(),
              }),
            },
          ],
        },
        transport: {
          type: 'stdio',
        },
      };

      expect(config.name).toBe('test-server');
      expect(config.version).toBe('1.0.0');
      expect(config.capabilities.tools).toHaveLength(1);
      expect(config.capabilities.tools?.[0].name).toBe('test-tool');
    });

    it('should validate tool capability schema', () => {
      const toolSchema = z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).optional(),
      });

      const validInput = { query: 'test', limit: 10 };
      const invalidInput = { query: '', limit: 200 };

      expect(() => toolSchema.parse(validInput)).not.toThrow();
      expect(() => toolSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('MCPRequest', () => {
    it('should create valid MCP request', () => {
      const request: MCPRequest = {
        id: 'req-123',
        method: 'tools.call',
        params: { name: 'test-tool', arguments: {} },
        timestamp: Date.now(),
        headers: { 'content-type': 'application/json' },
      };

      expect(request.id).toBe('req-123');
      expect(request.method).toBe('tools.call');
      expect(request.params).toBeDefined();
      expect(request.timestamp).toBeGreaterThan(0);
    });

    it('should handle request without optional fields', () => {
      const request: MCPRequest = {
        id: 'req-456',
        method: 'tools.list',
        timestamp: Date.now(),
      };

      expect(request.params).toBeUndefined();
      expect(request.headers).toBeUndefined();
    });
  });

  describe('MCPResponse', () => {
    it('should create successful response', () => {
      const response: MCPResponse = {
        id: 'req-123',
        result: { content: 'test result' },
        timestamp: Date.now(),
      };

      expect(response.id).toBe('req-123');
      expect(response.result).toEqual({ content: 'test result' });
      expect(response.error).toBeUndefined();
    });

    it('should create error response', () => {
      const response: MCPResponse = {
        id: 'req-123',
        error: {
          code: -32601,
          message: 'Method not found',
        },
        timestamp: Date.now(),
      };

      expect(response.id).toBe('req-123');
      expect(response.error).toEqual({
        code: -32601,
        message: 'Method not found',
      });
      expect(response.result).toBeUndefined();
    });
  });

  describe('AuthContext', () => {
    it('should create auth context with required fields', () => {
      const authContext: AuthContext = {
        userId: 'user-123',
        roles: ['admin', 'user'],
        permissions: ['read', 'write'],
        metadata: { department: 'engineering' },
      };

      expect(authContext.userId).toBe('user-123');
      expect(authContext.roles).toContain('admin');
      expect(authContext.permissions).toContain('write');
      expect(authContext.metadata?.department).toBe('engineering');
    });

    it('should create minimal auth context', () => {
      const authContext: AuthContext = {
        userId: 'user-456',
        roles: ['user'],
        permissions: ['read'],
      };

      expect(authContext.userId).toBe('user-456');
      expect(authContext.roles).toEqual(['user']);
      expect(authContext.permissions).toEqual(['read']);
      expect(authContext.metadata).toBeUndefined();
    });
  });

  describe('Metric', () => {
    it('should create valid metric', () => {
      const metric: Metric = {
        name: 'request_count',
        value: 100,
        timestamp: Date.now(),
        tags: { endpoint: '/api/test', method: 'GET' },
      };

      expect(metric.name).toBe('request_count');
      expect(metric.value).toBe(100);
      expect(metric.timestamp).toBeGreaterThan(0);
      expect(metric.tags.endpoint).toBe('/api/test');
    });

    it('should create metric without tags', () => {
      const metric: Metric = {
        name: 'cpu_usage',
        value: 75.5,
        timestamp: Date.now(),
        tags: {},
      };

      expect(metric.name).toBe('cpu_usage');
      expect(metric.value).toBe(75.5);
      expect(metric.tags).toEqual({});
    });
  });
});