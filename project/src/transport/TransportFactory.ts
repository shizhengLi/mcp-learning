import { BaseTransport } from './BaseTransport';
import { StdioTransport } from './StdioTransport';
import { HttpTransport } from './HttpTransport';
import { WebSocketTransport } from './WebSocketTransport';
import { TransportConfig } from './BaseTransport';

export class TransportFactory {
  static createTransport(config: TransportConfig): BaseTransport {
    switch (config.type) {
      case 'stdio':
        return new StdioTransport(config);
      case 'http':
        return new HttpTransport(config);
      case 'websocket':
        return new WebSocketTransport(config);
      default:
        throw new Error(`Unsupported transport type: ${config.type}`);
    }
  }

  static getAvailableTransports(): string[] {
    return ['stdio', 'http', 'websocket'];
  }

  static validateConfig(config: TransportConfig): boolean {
    switch (config.type) {
      case 'stdio':
        return true; // stdio transport doesn't require additional config
      case 'http':
        return config.port !== undefined && config.port > 0 && config.port < 65536;
      case 'websocket':
        return config.port !== undefined && config.port > 0 && config.port < 65536;
      default:
        return false;
    }
  }

  static getDefaultConfig(type: 'stdio' | 'http' | 'websocket'): TransportConfig {
    switch (type) {
      case 'stdio':
        return { type: 'stdio' };
      case 'http':
        return {
          type: 'http',
          host: 'localhost',
          port: 3000,
          path: '/mcp',
          timeout: 30000,
        };
      case 'websocket':
        return {
          type: 'websocket',
          host: 'localhost',
          port: 8080,
          path: '/ws',
          timeout: 30000,
        };
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}