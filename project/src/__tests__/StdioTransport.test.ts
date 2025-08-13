import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { StdioTransport } from '../transport/StdioTransport'
import { TransportConfig } from '../transport/BaseTransport'

describe('StdioTransport', () => {
  let transport: StdioTransport
  let config: TransportConfig

  beforeEach(() => {
    config = { type: 'stdio' }
    transport = new StdioTransport(config)
  })

  afterEach(async () => {
    if (transport) {
      await transport.disconnect()
    }
  })

  describe('Transport Configuration', () => {
    it('should create stdio transport with correct config', () => {
      expect(transport.getConfig()).toEqual(config)
      expect(transport.getStatus().type).toBe('stdio')
    })
  })

  describe('Connection Management', () => {
    it('should connect and disconnect correctly', async () => {
      await transport.connect()
      expect(transport.getStatus().isConnected).toBe(true)

      await transport.disconnect()
      expect(transport.getStatus().isConnected).toBe(false)
    })

    it('should handle connection gracefully', async () => {
      await expect(transport.connect()).resolves.not.toThrow()
      expect(transport.getStatus().isConnected).toBe(true)
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      await transport.connect()
    })

    it('should send messages when connected', async () => {
      const message = {
        id: 'test-1',
        type: 'request' as const,
        method: 'echo',
        params: { message: 'Hello' },
        timestamp: Date.now(),
      }

      await expect(transport.send(message)).resolves.not.toThrow()
    })

    it('should reject messages when not connected', async () => {
      await transport.disconnect()

      const message = {
        id: 'test-1',
        type: 'request' as const,
        method: 'echo',
        timestamp: Date.now(),
      }

      await expect(transport.send(message)).rejects.toThrow('Transport not connected')
    })

    it('should reject invalid messages', async () => {
      const invalidMessage = {
        id: '',
        type: 'request' as const,
        method: 'echo',
        timestamp: Date.now(),
      }

      await expect(transport.send(invalidMessage)).rejects.toThrow('Invalid message format')
    })
  })

  describe('Event Handling', () => {
    beforeEach(async () => {
      await transport.connect()
    })

    it('should handle message events', async () => {
      const messageHandler = jest.fn()
      transport.onMessage(messageHandler)

      expect(messageHandler).not.toHaveBeenCalled()
    })

    it('should remove message handlers', () => {
      const messageHandler = jest.fn()
      transport.onMessage(messageHandler)
      transport.offMessage(messageHandler)

      expect(messageHandler).not.toHaveBeenCalled()
    })
  })
})
