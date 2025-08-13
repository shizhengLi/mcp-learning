import { describe, it, expect } from '@jest/globals'
import { TransportFactory } from '../transport/TransportFactory'
import { TransportConfig } from '../transport/BaseTransport'

describe('TransportFactory', () => {
  describe('Transport Creation', () => {
    it('should create stdio transport', () => {
      const config: TransportConfig = { type: 'stdio' }
      const transport = TransportFactory.createTransport(config)

      expect(transport).toBeDefined()
      expect(transport.getStatus().type).toBe('stdio')
    })

    it('should create http transport', () => {
      const config: TransportConfig = {
        type: 'http',
        port: 3000,
        host: 'localhost',
      }
      const transport = TransportFactory.createTransport(config)

      expect(transport).toBeDefined()
      expect(transport.getStatus().type).toBe('http')
    })

    it('should create websocket transport', () => {
      const config: TransportConfig = {
        type: 'websocket',
        port: 8080,
        host: 'localhost',
      }
      const transport = TransportFactory.createTransport(config)

      expect(transport).toBeDefined()
      expect(transport.getStatus().type).toBe('websocket')
    })

    it('should throw error for unsupported transport type', () => {
      const config: TransportConfig = { type: 'unsupported' as any }

      expect(() => {
        TransportFactory.createTransport(config)
      }).toThrow('Unsupported transport type: unsupported')
    })
  })

  describe('Transport Validation', () => {
    it('should validate stdio config', () => {
      const config: TransportConfig = { type: 'stdio' }
      expect(TransportFactory.validateConfig(config)).toBe(true)
    })

    it('should validate http config with valid port', () => {
      const config: TransportConfig = { type: 'http', port: 3000 }
      expect(TransportFactory.validateConfig(config)).toBe(true)
    })

    it('should reject http config with invalid port', () => {
      const config: TransportConfig = { type: 'http', port: 70000 }
      expect(TransportFactory.validateConfig(config)).toBe(false)
    })

    it('should reject http config without port', () => {
      const config: TransportConfig = { type: 'http' }
      expect(TransportFactory.validateConfig(config)).toBe(false)
    })

    it('should validate websocket config with valid port', () => {
      const config: TransportConfig = { type: 'websocket', port: 8080 }
      expect(TransportFactory.validateConfig(config)).toBe(true)
    })

    it('should reject websocket config with invalid port', () => {
      const config: TransportConfig = { type: 'websocket', port: -1 }
      expect(TransportFactory.validateConfig(config)).toBe(false)
    })

    it('should reject unsupported transport type', () => {
      const config: TransportConfig = { type: 'unsupported' as any }
      expect(TransportFactory.validateConfig(config)).toBe(false)
    })
  })

  describe('Default Configurations', () => {
    it('should provide default stdio config', () => {
      const config = TransportFactory.getDefaultConfig('stdio')

      expect(config.type).toBe('stdio')
      expect(config).toEqual({ type: 'stdio' })
    })

    it('should provide default http config', () => {
      const config = TransportFactory.getDefaultConfig('http')

      expect(config.type).toBe('http')
      expect(config.host).toBe('localhost')
      expect(config.port).toBe(3000)
      expect(config.path).toBe('/mcp')
      expect(config.timeout).toBe(30000)
    })

    it('should provide default websocket config', () => {
      const config = TransportFactory.getDefaultConfig('websocket')

      expect(config.type).toBe('websocket')
      expect(config.host).toBe('localhost')
      expect(config.port).toBe(8080)
      expect(config.path).toBe('/ws')
      expect(config.timeout).toBe(30000)
    })

    it('should throw error for unsupported transport type', () => {
      expect(() => {
        TransportFactory.getDefaultConfig('unsupported' as any)
      }).toThrow('Unsupported transport type: unsupported')
    })
  })

  describe('Available Transports', () => {
    it('should return list of available transports', () => {
      const transports = TransportFactory.getAvailableTransports()

      expect(transports).toContain('stdio')
      expect(transports).toContain('http')
      expect(transports).toContain('websocket')
      expect(transports).toHaveLength(3)
    })
  })
})
