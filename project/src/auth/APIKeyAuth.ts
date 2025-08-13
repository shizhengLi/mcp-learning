import crypto from 'crypto'
import { BaseAuth, AuthConfig, AuthContext, AuthToken, AuthRequest, AuthResult } from './BaseAuth'

export class APIKeyAuth extends BaseAuth {
  private apiKeys: Map<string, AuthContext> = new Map()

  constructor(config: AuthConfig) {
    super(config)
    this.initializeTestAPIKeys()
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      const apiKey = this.extractAPIKey(request)
      if (!apiKey) {
        return this.createError('No API key provided', 401)
      }

      const context = this.apiKeys.get(apiKey)
      if (!context) {
        return this.createError('Invalid API key', 401)
      }

      return this.createSuccess(context)
    } catch (error) {
      return this.createError('Authentication failed', 500)
    }
  }

  async authorize(context: AuthContext, requiredPermissions: string[]): Promise<boolean> {
    return this.hasPermission(context, requiredPermissions)
  }

  async generateToken(context: AuthContext): Promise<AuthToken> {
    const apiKey = this.generateAPIKey()
    this.apiKeys.set(apiKey, context)

    return {
      token: apiKey,
      type: 'apikey',
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      scopes: context.permissions,
    }
  }

  async validateToken(token: string): Promise<AuthResult> {
    try {
      const context = this.apiKeys.get(token)
      if (!context) {
        return this.createError('Invalid API key', 401)
      }

      return this.createSuccess(context)
    } catch (error) {
      return this.createError('API key validation failed', 500)
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    const result = await this.validateToken(refreshToken)
    if (!result.success || !result.context) {
      throw new Error(result.error || 'Invalid refresh token')
    }

    return this.generateToken(result.context)
  }

  private extractAPIKey(request: AuthRequest): string | null {
    return (
      this.extractApiKeyFromHeader(request.headers || {}) ||
      this.extractTokenFromQuery(request.query || {})
    )
  }

  private generateAPIKey(): string {
    const prefix = this.config.apiKeyPrefix
    const randomBytes = crypto.randomBytes(32).toString('hex')
    return `${prefix}_${randomBytes}`
  }

  private initializeTestAPIKeys(): void {
    const testAPIKeys = [
      {
        key: 'mcp_admin_test_key_123456789',
        context: {
          userId: 'user-1',
          username: 'admin',
          roles: ['admin'],
          permissions: ['*'],
          metadata: { email: 'admin@example.com' },
        },
      },
      {
        key: 'mcp_user_test_key_123456789',
        context: {
          userId: 'user-2',
          username: 'user',
          roles: ['user'],
          permissions: ['read', 'write'],
          metadata: { email: 'user@example.com' },
        },
      },
      {
        key: 'mcp_guest_test_key_123456789',
        context: {
          userId: 'user-3',
          username: 'guest',
          roles: ['guest'],
          permissions: ['read'],
          metadata: { email: 'guest@example.com' },
        },
      },
    ]

    testAPIKeys.forEach(({ key, context }) => {
      this.apiKeys.set(key, context)
    })
  }

  public createAPIKey(context: AuthContext): string {
    const apiKey = this.generateAPIKey()
    this.apiKeys.set(apiKey, context)
    return apiKey
  }

  public revokeAPIKey(apiKey: string): boolean {
    return this.apiKeys.delete(apiKey)
  }

  public getAPIKeyContext(apiKey: string): AuthContext | undefined {
    return this.apiKeys.get(apiKey)
  }

  public getAllAPIKeys(): Array<{ key: string; context: AuthContext }> {
    return Array.from(this.apiKeys.entries()).map(([key, context]) => ({
      key,
      context,
    }))
  }

  public validateAPIKeyFormat(apiKey: string): boolean {
    const prefix = this.config.apiKeyPrefix
    const regex = new RegExp(`^${prefix}_[a-f0-9]{64}$`)
    return regex.test(apiKey)
  }
}
