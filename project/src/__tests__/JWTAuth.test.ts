import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { JWTAuth } from '../auth/JWTAuth'
import { AuthConfig, AuthContext } from '../auth/BaseAuth'

describe('JWTAuth', () => {
  let jwtAuth: JWTAuth
  let config: AuthConfig

  beforeEach(() => {
    config = {
      jwtSecret: 'test-secret-key',
      jwtExpiration: '1h',
      apiKeyPrefix: 'mcp',
      rateLimitWindow: 60000,
      rateLimitMax: 100,
      allowedOrigins: ['*'],
    }
    jwtAuth = new JWTAuth(config)
  })

  afterEach(() => {
    // Clean up test users
    const users = jwtAuth.getAllUsers()
    users.forEach(user => jwtAuth.removeUser(user.userId))
  })

  describe('Token Generation', () => {
    it('should generate valid JWT token', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read', 'write'],
      }

      const token = await jwtAuth.generateToken(context)

      expect(token).toBeDefined()
      expect(token.type).toBe('bearer')
      expect(token.token).toBeTruthy()
      expect(token.scopes).toEqual(['read', 'write'])
      expect(token.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should generate tokens with different expiration times', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const token = await jwtAuth.generateToken(context)
      const expiresInMs = token.expiresAt - Date.now()

      expect(expiresInMs).toBeGreaterThan(0)
      expect(expiresInMs).toBeLessThan(2 * 60 * 60 * 1000) // Less than 2 hours
    })
  })

  describe('Token Validation', () => {
    it('should validate valid token', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      jwtAuth.addUser(context)
      const token = await jwtAuth.generateToken(context)
      const result = await jwtAuth.validateToken(token.token)

      expect(result.success).toBe(true)
      expect(result.context).toBeDefined()
      expect(result.context?.userId).toBe('test-user')
      expect(result.context?.username).toBe('testuser')
    })

    it('should reject invalid token', async () => {
      const result = await jwtAuth.validateToken('invalid-token')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid token')
      expect(result.statusCode).toBe(401)
    })

    it('should reject expired token', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const shortJWTAuth = new JWTAuth(config)
      shortJWTAuth.addUser(context)

      // Use the original approach with a very short expiration time
      const shortConfig = {
        ...config,
        jwtExpiration: '1ms',
      }

      const veryShortJWTAuth = new JWTAuth(shortConfig)
      veryShortJWTAuth.addUser(context)
      const token = await veryShortJWTAuth.generateToken(context)

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await veryShortJWTAuth.validateToken(token.token)
      expect(result.success).toBe(false)
      // Accept any error message for expired token
      expect(result.error).toBeDefined()
    })
  })

  describe('Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      jwtAuth.addUser(context)

      const token = await jwtAuth.generateToken(context)
      const request = {
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      }

      const result = await jwtAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context).toBeDefined()
      expect(result.context?.userId).toBe('test-user')
    })

    it('should fail authentication with invalid token', async () => {
      const request = {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      }

      const result = await jwtAuth.authenticate(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid token')
    })

    it('should fail authentication without token', async () => {
      const request = {
        headers: {},
      }

      const result = await jwtAuth.authenticate(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No authentication token provided')
    })

    it('should authenticate with token from query parameter', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      jwtAuth.addUser(context)

      const token = await jwtAuth.generateToken(context)
      const request = {
        query: {
          token: token.token,
        },
      }

      const result = await jwtAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context?.userId).toBe('test-user')
    })
  })

  describe('Authorization', () => {
    it('should authorize user with correct permissions', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read', 'write'],
      }

      const result = await jwtAuth.authorize(context, ['read'])
      expect(result).toBe(true)
    })

    it('should reject user with insufficient permissions', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['guest'], // Guest role only has 'read' permission
        permissions: ['read'],
      }

      const result = await jwtAuth.authorize(context, ['write'])
      expect(result).toBe(false)
    })

    it('should authorize admin with all permissions', async () => {
      const context: AuthContext = {
        userId: 'admin-user',
        username: 'admin',
        roles: ['admin'],
        permissions: ['*'],
      }

      const result = await jwtAuth.authorize(context, ['read', 'write', 'delete'])
      expect(result).toBe(true)
    })

    it('should authorize based on role permissions', async () => {
      const context: AuthContext = {
        userId: 'user-user',
        username: 'user',
        roles: ['user'],
        permissions: [], // No explicit permissions, should inherit from role
      }

      const result = await jwtAuth.authorize(context, ['read'])
      expect(result).toBe(true)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh valid token', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      jwtAuth.addUser(context)

      const oldToken = await jwtAuth.generateToken(context)
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000))
      const newToken = await jwtAuth.refreshToken(oldToken.token)

      expect(newToken).toBeDefined()
      expect(newToken.scopes).toEqual(oldToken.scopes)
      expect(newToken.expiresAt).toBeGreaterThan(oldToken.expiresAt)
    })

    it('should fail to refresh invalid token', async () => {
      await expect(jwtAuth.refreshToken('invalid-token')).rejects.toThrow('Invalid token')
    })
  })

  describe('User Management', () => {
    it('should add and retrieve users', () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      jwtAuth.addUser(context)
      const retrieved = jwtAuth.getUser('test-user')

      expect(retrieved).toBeDefined()
      expect(retrieved?.userId).toBe('test-user')
      expect(retrieved?.username).toBe('testuser')
    })

    it('should remove users', () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      jwtAuth.addUser(context)
      expect(jwtAuth.getUser('test-user')).toBeDefined()

      jwtAuth.removeUser('test-user')
      expect(jwtAuth.getUser('test-user')).toBeUndefined()
    })

    it('should get all users', () => {
      // Clear existing users first
      const existingUsers = jwtAuth.getAllUsers()
      existingUsers.forEach(user => jwtAuth.removeUser(user.userId))

      const context1: AuthContext = {
        userId: 'user-1',
        username: 'user1',
        roles: ['user'],
        permissions: ['read'],
      }

      const context2: AuthContext = {
        userId: 'user-2',
        username: 'user2',
        roles: ['admin'],
        permissions: ['*'],
      }

      jwtAuth.addUser(context1)
      jwtAuth.addUser(context2)

      const users = jwtAuth.getAllUsers()
      expect(users).toHaveLength(2)
      expect(users.map(u => u.userId)).toContain('user-1')
      expect(users.map(u => u.userId)).toContain('user-2')
    })
  })

  describe('Test Users', () => {
    it('should have default test users', () => {
      const users = jwtAuth.getAllUsers()
      expect(users.length).toBeGreaterThan(0)

      const adminUser = users.find(u => u.username === 'admin')
      expect(adminUser).toBeDefined()
      expect(adminUser?.roles).toContain('admin')
      expect(adminUser?.permissions).toContain('*')
    })
  })
})
