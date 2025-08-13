import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseTransport, TransportConfig, TransportMessage } from '../transport/BaseTransport';

class TestTransport extends BaseTransport {
  private messages: TransportMessage[] = [];
  private testMessageHandlers: Function[] = [];

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async send(message: TransportMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Transport not connected');
    }
    if (!this.validateMessage(message)) {
      return;
    }
    this.messages.push(message);
  }

  onMessage(handler: (message: TransportMessage) => void): void {
    this.testMessageHandlers.push(handler);
  }

  offMessage(handler: (message: TransportMessage) => void): void {
    const index = this.testMessageHandlers.indexOf(handler);
    if (index > -1) {
      this.testMessageHandlers.splice(index, 1);
    }
  }

  getMessages(): TransportMessage[] {
    return [...this.messages];
  }

  simulateMessage(message: TransportMessage): void {
    this.testMessageHandlers.forEach(handler => {
      handler(message);
    });
  }
}

describe('BaseTransport', () => {
  let transport: TestTransport;
  let config: TransportConfig;

  beforeEach(() => {
    config = { type: 'stdio' };
    transport = new TestTransport(config);
  });

  afterEach(async () => {
    if (transport) {
      await transport.disconnect();
    }
  });

  describe('Transport Configuration', () => {
    it('should create transport with correct config', () => {
      expect(transport.getConfig()).toEqual(config);
    });

    it('should return correct status', () => {
      expect(transport.getStatus()).toEqual({
        isConnected: false,
        type: 'stdio',
      });
    });
  });

  describe('Connection Management', () => {
    it('should connect and disconnect correctly', async () => {
      await transport.connect();
      expect(transport.getStatus().isConnected).toBe(true);

      await transport.disconnect();
      expect(transport.getStatus().isConnected).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      class ErrorTransport extends TestTransport {
        override async connect(): Promise<void> {
          throw new Error('Connection failed');
        }
      }

      const errorTransport = new ErrorTransport(config);
      await expect(errorTransport.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await transport.connect();
    });

    it('should send valid messages', async () => {
      const message: TransportMessage = {
        id: 'test-1',
        type: 'request',
        method: 'echo',
        params: { message: 'Hello' },
        timestamp: Date.now(),
      };

      await transport.send(message);
      const sentMessages = transport.getMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(message);
    });

    it('should reject invalid messages', async () => {
      const invalidMessage: TransportMessage = {
        id: '',
        type: 'request',
        method: 'echo',
        timestamp: Date.now(),
      };

      await transport.send(invalidMessage);
      const sentMessages = transport.getMessages();
      expect(sentMessages).toHaveLength(0);
    });

    it('should reject messages when not connected', async () => {
      await transport.disconnect();
      
      const message: TransportMessage = {
        id: 'test-1',
        type: 'request',
        method: 'echo',
        timestamp: Date.now(),
      };

      await expect(transport.send(message)).rejects.toThrow('Transport not connected');
    });

    it('should handle message events', async () => {
      const messageHandler = jest.fn();
      transport.onMessage(messageHandler);

      const testMessage: TransportMessage = {
        id: 'test-1',
        type: 'response',
        result: { data: 'test' },
        timestamp: Date.now(),
      };

      transport.simulateMessage(testMessage);
      expect(messageHandler).toHaveBeenCalledWith(testMessage);
    });

    it('should remove message handlers', () => {
      const messageHandler = jest.fn();
      transport.onMessage(messageHandler);
      transport.offMessage(messageHandler);

      transport.simulateMessage({
        id: 'test-1',
        type: 'response',
        result: { data: 'test' },
        timestamp: Date.now(),
      });

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('Message Creation', () => {
    it('should create unique message IDs', () => {
      const id1 = transport['createMessageId']();
      const id2 = transport['createMessageId']();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should create request messages correctly', () => {
      const request = transport['createRequest']('echo', { message: 'Hello' });
      
      expect(request.type).toBe('request');
      expect(request.method).toBe('echo');
      expect(request.params).toEqual({ message: 'Hello' });
      expect(request.id).toBeDefined();
      expect(request.timestamp).toBeDefined();
    });

    it('should create response messages correctly', () => {
      const response = transport['createResponse']('test-id', { result: 'success' });
      
      expect(response.type).toBe('response');
      expect(response.id).toBe('test-id');
      expect(response.result).toEqual({ result: 'success' });
      expect(response.error).toBeUndefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should create notification messages correctly', () => {
      const notification = transport['createNotification']('status.update', { status: 'ready' });
      
      expect(notification.type).toBe('notification');
      expect(notification.method).toBe('status.update');
      expect(notification.params).toEqual({ status: 'ready' });
      expect(notification.id).toBeDefined();
      expect(notification.timestamp).toBeDefined();
    });
  });

  describe('Message Validation', () => {
    it('should validate correct messages', () => {
      const validMessage: TransportMessage = {
        id: 'test-1',
        type: 'request',
        method: 'echo',
        timestamp: Date.now(),
      };

      expect(transport['validateMessage'](validMessage)).toBe(true);
    });

    it('should reject messages without ID', () => {
      const invalidMessage: TransportMessage = {
        id: '',
        type: 'request',
        method: 'echo',
        timestamp: Date.now(),
      };

      expect(transport['validateMessage'](invalidMessage)).toBe(false);
    });

    it('should reject messages with invalid type', () => {
      const invalidMessage: TransportMessage = {
        id: 'test-1',
        type: 'invalid' as any,
        method: 'echo',
        timestamp: Date.now(),
      };

      expect(transport['validateMessage'](invalidMessage)).toBe(false);
    });

    it('should reject messages without timestamp', () => {
      const invalidMessage: TransportMessage = {
        id: 'test-1',
        type: 'request',
        method: 'echo',
        timestamp: 0,
      };

      expect(transport['validateMessage'](invalidMessage)).toBe(false);
    });
  });
});