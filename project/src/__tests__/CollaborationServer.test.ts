import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { CollaborationServer } from '../collaboration/CollaborationServer'

describe('CollaborationServer', () => {
  let server: CollaborationServer

  beforeEach(() => {
    server = new CollaborationServer()
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
      expect(serverInfo.name).toBe('collaboration-server')
      expect(serverInfo.version).toBe('1.0.0')
    })

    it('should have correct server status when not running', () => {
      const status = server.getStatus()
      expect(status.isRunning).toBe(false)
      expect(status.uptime).toBeGreaterThan(0)
    })
  })

  describe('Session Management', () => {
    it('should create a collaboration session', async () => {
      await server.start()

      const request = {
        id: 'test-1',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1', 'user2'],
          codeContext: 'console.log("Hello World")'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-1')
      expect(response.result).toBeDefined()
      expect(response.result.content[0].text).toContain('Collaboration session started')
    })

    it('should handle session with additional metadata', async () => {
      await server.start()

      const request = {
        id: 'test-2',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1'],
          codeContext: 'def hello(): pass',
          sessionName: 'Python Review Session',
          description: 'Review Python code'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('test-2')
      expect(response.result).toBeDefined()
    })

    it('should list active sessions', async () => {
      await server.start()

      // Create a session first
      await server.processRequest({
        id: 'create-1',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      const request = {
        id: 'list-1',
        method: 'list-sessions',
        params: {},
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('list-1')
      expect(response.result).toBeDefined()
      expect(response.result.content[0].text).toContain('sessions')
    })

    it('should filter sessions by project ID', async () => {
      await server.start()

      // Create sessions for different projects
      await server.processRequest({
        id: 'create-1',
        method: 'start-collaboration',
        params: {
          projectId: 'project-a',
          participants: ['user1'],
          codeContext: 'code a'
        },
        timestamp: Date.now()
      })

      await server.processRequest({
        id: 'create-2',
        method: 'start-collaboration',
        params: {
          projectId: 'project-b',
          participants: ['user2'],
          codeContext: 'code b'
        },
        timestamp: Date.now()
      })

      const request = {
        id: 'list-1',
        method: 'list-sessions',
        params: { projectId: 'project-a' },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('list-1')
      expect(response.result).toBeDefined()
    })
  })

  describe('Session Participation', () => {
    let sessionId: string

    beforeEach(async () => {
      await server.start()

      const createResponse = await server.processRequest({
        id: 'create-session',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      // Extract session ID from response
      const match = createResponse.result.content[0].text.match(/Session ID: (.+)/)
      sessionId = match ? match[1] : ''
    })

    it('should allow users to join existing sessions', async () => {
      const request = {
        id: 'join-1',
        method: 'join-collaboration',
        params: {
          sessionId,
          userId: 'user2',
          userName: 'Alice'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('join-1')
      expect(response.result).toBeDefined()
      expect(response.result.content[0].text).toContain('Successfully joined')
    })

    it('should handle joining non-existent sessions', async () => {
      const request = {
        id: 'join-invalid',
        method: 'join-collaboration',
        params: {
          sessionId: 'non-existent-session',
          userId: 'user1'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('Session non-existent-session not found')
    })

    it('should handle joining inactive sessions', async () => {
      // End the session first
      await server.processRequest({
        id: 'end-session',
        method: 'end-session',
        params: {
          sessionId,
          userId: 'user1'
        },
        timestamp: Date.now()
      })

      const request = {
        id: 'join-inactive',
        method: 'join-collaboration',
        params: {
          sessionId,
          userId: 'user2'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('is not active')
    })
  })

  describe('Messaging', () => {
    let sessionId: string

    beforeEach(async () => {
      await server.start()

      const createResponse = await server.processRequest({
        id: 'create-session',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1', 'user2'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      const match = createResponse.result.content[0].text.match(/Session ID: (.+)/)
      sessionId = match ? match[1] : ''
    })

    it('should send text messages', async () => {
      const request = {
        id: 'msg-1',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user1',
          content: 'Hello everyone!'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('msg-1')
      expect(response.result).toBeDefined()
      expect(response.result.content[0].text).toContain('Message sent')
    })

    it('should send code messages', async () => {
      const request = {
        id: 'msg-2',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user2',
          content: 'console.log("Debug code")',
          type: 'code'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('msg-2')
      expect(response.result).toBeDefined()
    })

    it('should send suggestion messages', async () => {
      const request = {
        id: 'msg-3',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user1',
          content: 'Consider using async/await here',
          type: 'suggestion'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('msg-3')
      expect(response.result).toBeDefined()
    })

    it('should handle reply-to functionality', async () => {
      // Send original message
      await server.processRequest({
        id: 'msg-original',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user1',
          content: 'What about this approach?'
        },
        timestamp: Date.now()
      })

      // Send reply
      const request = {
        id: 'msg-reply',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user2',
          content: 'That looks good to me!',
          replyTo: 'msg-original'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('msg-reply')
      expect(response.result).toBeDefined()
    })

    it('should prevent non-participants from sending messages', async () => {
      const request = {
        id: 'msg-unauthorized',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'unauthorized-user',
          content: 'I should not be able to send this'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('is not a participant')
    })
  })

  describe('Code Reviews', () => {
    let sessionId: string

    beforeEach(async () => {
      await server.start()

      const createResponse = await server.processRequest({
        id: 'create-session',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1', 'user2'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      const match = createResponse.result.content[0].text.match(/Session ID: (.+)/)
      sessionId = match ? match[1] : ''
    })

    it('should send code reviews with comments', async () => {
      const request = {
        id: 'review-1',
        method: 'send-code-review',
        params: {
          sessionId,
          filePath: 'src/test.js',
          userId: 'user1',
          comments: [
            {
              line: 10,
              content: 'Consider adding error handling here',
              severity: 'warning'
            },
            {
              line: 25,
              content: 'This variable is unused',
              severity: 'info'
            }
          ]
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('review-1')
      expect(response.result).toBeDefined()
      expect(response.result.content[0].text).toContain('Code review sent')
    })

    it('should handle different severity levels', async () => {
      const request = {
        id: 'review-severity',
        method: 'send-code-review',
        params: {
          sessionId,
          filePath: 'src/test.py',
          userId: 'user2',
          comments: [
            {
              line: 5,
              content: 'Security issue: potential SQL injection',
              severity: 'error'
            },
            {
              line: 15,
              content: 'This could be optimized',
              severity: 'warning'
            },
            {
              line: 30,
              content: 'Consider using a more descriptive name',
              severity: 'info'
            }
          ]
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('review-severity')
      expect(response.result).toBeDefined()
    })

    it('should prevent non-participants from sending reviews', async () => {
      const request = {
        id: 'review-unauthorized',
        method: 'send-code-review',
        params: {
          sessionId,
          filePath: 'src/test.js',
          userId: 'unauthorized-user',
          comments: [
            {
              line: 1,
              content: 'Unauthorized comment',
              severity: 'error'
            }
          ]
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('is not a participant')
    })
  })

  describe('Session Information', () => {
    let sessionId: string

    beforeEach(async () => {
      await server.start()

      const createResponse = await server.processRequest({
        id: 'create-session',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1', 'user2'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      const match = createResponse.result.content[0].text.match(/Session ID: (.+)/)
      sessionId = match ? match[1] : ''
    })

    it('should get session information', async () => {
      // Add some activity
      await server.processRequest({
        id: 'add-activity',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user1',
          content: 'Test message'
        },
        timestamp: Date.now()
      })

      const request = {
        id: 'get-info',
        method: 'get-session-info',
        params: { sessionId },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('get-info')
      expect(response.result).toBeDefined()
      
      const sessionInfo = JSON.parse(response.result.content[0].text)
      expect(sessionInfo.id).toBe(sessionId)
      expect(sessionInfo.projectId).toBe('test-project')
      expect(sessionInfo.participants).toEqual(['user1', 'user2'])
      expect(sessionInfo.messageCount).toBeGreaterThan(0)
    })

    it('should handle non-existent session info requests', async () => {
      const request = {
        id: 'get-info-invalid',
        method: 'get-session-info',
        params: { sessionId: 'non-existent' },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('Session non-existent not found')
    })
  })

  describe('Session Lifecycle', () => {
    let sessionId: string

    beforeEach(async () => {
      await server.start()

      const createResponse = await server.processRequest({
        id: 'create-session',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1', 'user2'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      const match = createResponse.result.content[0].text.match(/Session ID: (.+)/)
      sessionId = match ? match[1] : ''
    })

    it('should end sessions by authorized users', async () => {
      const request = {
        id: 'end-session',
        method: 'end-session',
        params: {
          sessionId,
          userId: 'user1'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.id).toBe('end-session')
      expect(response.result).toBeDefined()
      expect(response.result.content[0].text).toContain('ended')
    })

    it('should prevent unauthorized users from ending sessions', async () => {
      const request = {
        id: 'end-unauthorized',
        method: 'end-session',
        params: {
          sessionId,
          userId: 'unauthorized-user'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('not authorized')
    })

    it('should handle ending non-existent sessions', async () => {
      const request = {
        id: 'end-nonexistent',
        method: 'end-session',
        params: {
          sessionId: 'non-existent',
          userId: 'user1'
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain('Session non-existent not found')
    })
  })

  describe('Event Handling', () => {
    it('should emit session created event', async () => {
      await server.start()

      const mockHandler = jest.fn()
      server.onSessionCreated(mockHandler)

      await server.processRequest({
        id: 'create-event-test',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      expect(mockHandler).toHaveBeenCalled()
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('id')
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('projectId', 'test-project')
    })

    it('should emit message sent event', async () => {
      await server.start()

      // Create session first
      const createResponse = await server.processRequest({
        id: 'create-for-message',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project',
          participants: ['user1'],
          codeContext: 'test code'
        },
        timestamp: Date.now()
      })

      const match = createResponse.result.content[0].text.match(/Session ID: (.+)/)
      const sessionId = match ? match[1] : ''

      const mockHandler = jest.fn()
      server.onMessageSent(mockHandler)

      await server.processRequest({
        id: 'send-message-event',
        method: 'send-message',
        params: {
          sessionId,
          userId: 'user1',
          content: 'Test message with event'
        },
        timestamp: Date.now()
      })

      expect(mockHandler).toHaveBeenCalled()
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('session')
      expect(mockHandler.mock.calls[0][0]).toHaveProperty('message')
      expect((mockHandler.mock.calls[0][0] as any).message.content).toBe('Test message with event')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid request format', async () => {
      await server.start()

      const request = {
        id: 'invalid-request',
        method: 'start-collaboration',
        // Missing required params
        params: {},
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
    })

    it('should handle missing required parameters', async () => {
      await server.start()

      const request = {
        id: 'missing-params',
        method: 'start-collaboration',
        params: {
          projectId: 'test-project'
          // Missing participants and codeContext
        },
        timestamp: Date.now()
      }

      const response = await server.processRequest(request)
      expect(response.error).toBeDefined()
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
})