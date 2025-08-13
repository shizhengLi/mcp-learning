import { EventEmitter } from 'events';
import { BaseTransport, TransportConfig, TransportMessage } from './BaseTransport';

export class HttpTransport extends BaseTransport {
  private server: any = null;
  private clients: Set<any> = new Set();
  private eventEmitter: EventEmitter;

  constructor(config: TransportConfig) {
    super(config);
    this.eventEmitter = new EventEmitter();
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const express = await import('express');
      const http = await import('http');
      const cors = await import('cors');

      const app = express.default();
      app.use(cors.default());
      app.use(express.json());

      app.post(this.config.path || '/mcp', (req: any, res: any) => {
        this.handleHttpRequest(req, res);
      });

      app.get('/health', (_req: any, res: any) => {
        res.json({ status: 'ok', connected: this.isConnected });
      });

      const server = http.createServer(app);
      
      server.listen(this.config.port || 3000, this.config.host || 'localhost', () => {
        this.isConnected = true;
        this.emit('connected');
      });

      server.on('error', (error) => {
        this.isConnected = false;
        this.emit('error', error);
      });

      this.server = server;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isConnected = false;
        this.clients.clear();
        this.emit('disconnected');
        resolve();
      });
    });
  }

  async send(message: TransportMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Transport not connected');
    }

    if (!this.validateMessage(message)) {
      throw new Error('Invalid message format');
    }

    this.eventEmitter.emit('message', message);
    this.emit('messageSent', message);
  }

  onMessage(handler: (message: TransportMessage) => void): void {
    this.eventEmitter.on('message', handler);
  }

  offMessage(handler: (message: TransportMessage) => void): void {
    this.eventEmitter.off('message', handler);
  }

  private handleHttpRequest(req: any, res: any): void {
    try {
      const message = req.body as TransportMessage;
      
      if (!this.validateMessage(message)) {
        res.status(400).json({
          error: 'Invalid message format',
          timestamp: Date.now(),
        });
        return;
      }

      this.emit('message', message);

      const response: TransportMessage = {
        id: message.id + '_response',
        type: 'response',
        result: { received: true },
        timestamp: Date.now(),
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        timestamp: Date.now(),
      });
    }
  }

  protected override emit(event: string, ...args: any[]): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in transport event handler for ${event}:`, error);
        }
      });
    }
  }
}