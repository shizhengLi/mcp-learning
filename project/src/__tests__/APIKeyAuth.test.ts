import { describe, it, expect, beforeEach } from '@jest/globals'
import { APIKeyAuth } from '../auth/APIKeyAuth'
import { AuthConfig, AuthContext } from '../auth/BaseAuth'

describe('APIKeyAuth', () => {
  let apiKeyAuth: APIKeyAuth
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
    apiKeyAuth = new APIKeyAuth(config)
  })

  describe('API Key Generation', () => {
    it('should generate valid API key', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read', 'write'],
      }

      const token = await apiKeyAuth.generateToken(context)

      expect(token).toBeDefined()
      expect(token.type).toBe('apikey')
      expect(token.token).toBeTruthy()
      expect(token.scopes).toEqual(['read', 'write'])
      expect(token.expiresAt).toBeGreaterThan(Date.now())
      expect(token.token.startsWith('mcp_')).toBe(true)
    })

    it('should generate unique API keys', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const token1 = await apiKeyAuth.generateToken(context)
      const token2 = await apiKeyAuth.generateToken(context)

      expect(token1.token).not.toBe(token2.token)
    })
  })

  describe('API Key Validation', () => {
    it('should validate valid API key', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const token = await apiKeyAuth.generateToken(context)
      const result = await apiKeyAuth.validateToken(token.token)

      expect(result.success).toBe(true)
      expect(result.context).toBeDefined()
      expect(result.context?.userId).toBe('test-user')
      expect(result.context?.username).toBe('testuser')
    })

    it('should reject invalid API key', async () => {
      const result = await apiKeyAuth.validateToken('invalid-api-key')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key')
      expect(result.statusCode).toBe(401)
    })
  })

  describe('Authentication', () => {
    it('should authenticate with valid API key in header', async () => {
      const request = {
        headers: {
          'X-Api-Key': 'mcp_admin_test_key_123456789',
        },
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context).toBeDefined()
      expect(result.context?.username).toBe('admin')
    })

    it('should authenticate with valid API key in query', async () => {
      const request = {
        query: {
          api_key: 'mcp_admin_test_key_123456789',
        },
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context?.username).toBe('admin')
    })

    it('should fail authentication with invalid API key', async () => {
      const request = {
        headers: {
          'X-Api-Key': 'invalid-api-key',
        },
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('should fail authentication without API key', async () => {
      const request = {
        headers: {},
        query: {},
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No API key provided')
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

      const result = await apiKeyAuth.authorize(context, ['read'])
      expect(result).toBe(true)
    })

    it('should reject user with insufficient permissions', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['guest'],
        permissions: ['read'],
      }

      const result = await apiKeyAuth.authorize(context, ['write'])
      expect(result).toBe(false)
    })
  })

  describe('API Key Management', () => {
    it('should create and retrieve API key context', () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const apiKey = apiKeyAuth.createAPIKey(context)
      const retrievedContext = apiKeyAuth.getAPIKeyContext(apiKey)

      expect(retrievedContext).toBeDefined()
      expect(retrievedContext?.userId).toBe('test-user')
      expect(retrievedContext?.username).toBe('testuser')
    })

    it('should revoke API key', () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const apiKey = apiKeyAuth.createAPIKey(context)
      expect(apiKeyAuth.getAPIKeyContext(apiKey)).toBeDefined()

      const revoked = apiKeyAuth.revokeAPIKey(apiKey)
      expect(revoked).toBe(true)
      expect(apiKeyAuth.getAPIKeyContext(apiKey)).toBeUndefined()
    })

    it('should get all API keys', () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const apiKey = apiKeyAuth.createAPIKey(context)
      const allKeys = apiKeyAuth.getAllAPIKeys()

      expect(allKeys.length).toBeGreaterThan(0)
      const createdKey = allKeys.find(k => k.key === apiKey)
      expect(createdKey).toBeDefined()
      expect(createdKey?.context.userId).toBe('test-user')
    })

    it('should validate API key format', () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const apiKey = apiKeyAuth.createAPIKey(context)
      const isValid = apiKeyAuth.validateAPIKeyFormat(apiKey)

      expect(isValid).toBe(true)
    })

    it('should reject invalid API key format', () => {
      const invalidFormats = [
        'invalid-key',
        'mcp_short',
        'wrongprefix_123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
        'mcp_123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef', // too long
      ]

      invalidFormats.forEach(format => {
        expect(apiKeyAuth.validateAPIKeyFormat(format)).toBe(false)
      })
    })
  })

  describe('Token Refresh', () => {
    it('should refresh valid API key', async () => {
      const context: AuthContext = {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read'],
      }

      const oldToken = await apiKeyAuth.generateToken(context)
      const newToken = await apiKeyAuth.refreshToken(oldToken.token)

      expect(newToken).toBeDefined()
      expect(newToken.token).not.toBe(oldToken.token)
      expect(newToken.scopes).toEqual(oldToken.scopes)
    })

    it('should fail to refresh invalid API key', async () => {
      await expect(apiKeyAuth.refreshToken('invalid-api-key')).rejects.toThrow('Invalid API key')
    })
  })

  describe('Test API Keys', () => {
    it('should have default test API keys', () => {
      const allKeys = apiKeyAuth.getAllAPIKeys()
      expect(allKeys.length).toBeGreaterThan(0)

      const adminKey = allKeys.find(k => k.context.username === 'admin')
      expect(adminKey).toBeDefined()
      expect(adminKey?.context.roles).toContain('admin')
      expect(adminKey?.context.permissions).toContain('*')
    })

    it('should authenticate with test admin API key', async () => {
      const request = {
        headers: {
          'X-Api-Key': 'mcp_admin_test_key_123456789',
        },
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context?.username).toBe('admin')
      expect(result.context?.roles).toContain('admin')
    })

    it('should authenticate with test user API key', async () => {
      const request = {
        headers: {
          'X-Api-Key': 'mcp_user_test_key_123456789',
        },
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context?.username).toBe('user')
      expect(result.context?.roles).toContain('user')
    })

    it('should authenticate with test guest API key', async () => {
      const request = {
        headers: {
          'X-Api-Key': 'mcp_guest_test_key_123456789',
        },
      }

      const result = await apiKeyAuth.authenticate(request)

      expect(result.success).toBe(true)
      expect(result.context?.username).toBe('guest')
      expect(result.context?.roles).toContain('guest')
    })
  })
})
