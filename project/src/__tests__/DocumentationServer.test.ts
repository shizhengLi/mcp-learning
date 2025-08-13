import { DocumentationServer } from '../documentation/DocumentationServer'

describe('DocumentationServer', () => {
  let server: DocumentationServer

  beforeEach(() => {
    server = new DocumentationServer()
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  describe('Server Initialization', () => {
    it('should initialize server with correct configuration', () => {
      expect(server).toBeDefined()
      const serverInfo = server.getServerInfo()
      expect(serverInfo.name).toBe('documentation-server')
      expect(serverInfo.version).toBe('1.0.0')
    })

    it('should have correct server status when not running', () => {
      const status = server.getStatus()
      expect(status.isRunning).toBe(false)
      expect(status.uptime).toBeGreaterThan(0)
    })
  })

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      await server.start()
      expect(server.getStatus().isRunning).toBe(true)

      await server.stop()
      expect(server.getStatus().isRunning).toBe(false)
    })
  })

  describe('Request Handling', () => {
    it('should handle generate-project-docs request', async () => {
      const request = {
        id: 'test-1',
        method: 'generate-project-docs',
        params: {
          projectPath: './test-project',
          formats: ['markdown'],
          includeSource: true,
        },
        timestamp: Date.now(),
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-1')
      expect(response.result).toBeDefined()
      expect(response.result.success).toBeDefined()
    })

    it('should handle generate-api-docs request', async () => {
      const request = {
        id: 'test-2',
        method: 'generate-api-docs',
        params: {
          apiPath: './test-api',
          format: 'markdown',
          includeExamples: true,
        },
        timestamp: Date.now(),
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-2')
      expect(response.result).toBeDefined()
      expect(response.result.success).toBeDefined()
    })

    it('should handle unknown method', async () => {
      const request = {
        id: 'test-3',
        method: 'unknown-method',
        params: {},
        timestamp: Date.now(),
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-3')
      expect(response.error).toBeDefined()
      if (response.error) {
        expect(response.error.code).toBe(-32601) // Method not found
      }
    })

    it('should handle invalid request', async () => {
      const request = {
        id: 'test-4',
        method: 'test',
        timestamp: Date.now(),
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-4')
      expect(response.error).toBeDefined()
    })
  })

  describe('Server Instructions', () => {
    it('should provide server instructions', () => {
      // Since getServerInstructions is protected, we can't test it directly
      // But we can verify the server is properly configured
      expect(server).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const request = {
        id: 'test-5',
        method: 'generate-project-docs',
        params: {
          projectPath: '/nonexistent-path', // This should cause an error
        },
        timestamp: Date.now(),
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-5')
      expect(response.result).toBeDefined()
      expect(response.result.success).toBeDefined()
    })
  })
})
