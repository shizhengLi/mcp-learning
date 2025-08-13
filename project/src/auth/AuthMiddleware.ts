import { AuthConfig, AuthContext, AuthRequest, AuthResult } from './BaseAuth';
import { JWTAuth } from './JWTAuth';
import { APIKeyAuth } from './APIKeyAuth';
import { RateLimiter, RateLimitConfig } from './RateLimiter';

export interface MiddlewareConfig {
  auth: AuthConfig;
  rateLimit: RateLimitConfig;
  enableCORS: boolean;
  allowedMethods: string[];
  authRequired: boolean;
  requiredPermissions?: string[];
}

export interface RequestContext {
  auth?: AuthContext;
  isAuthenticated: boolean;
  rateLimit: {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    total: number;
  };
}

export class AuthMiddleware {
  private jwtAuth: JWTAuth;
  private apiKeyAuth: APIKeyAuth;
  private rateLimiter: RateLimiter;
  private config: MiddlewareConfig;

  constructor(config: MiddlewareConfig) {
    this.config = config;
    this.jwtAuth = new JWTAuth(config.auth);
    this.apiKeyAuth = new APIKeyAuth(config.auth);
    this.rateLimiter = new RateLimiter(config.rateLimit);
  }

  public async authenticate(request: AuthRequest): Promise<RequestContext> {
    const context: RequestContext = {
      isAuthenticated: false,
      rateLimit: await this.rateLimiter.checkLimit(request),
    };

    if (!context.rateLimit.allowed) {
      return context;
    }

    if (this.config.authRequired) {
      const authResult = await this.tryAuthentication(request);
      if (authResult.success && authResult.context) {
        context.auth = authResult.context;
        context.isAuthenticated = true;

        if (this.config.requiredPermissions) {
          const isAuthorized = await this.jwtAuth.authorize(
            authResult.context,
            this.config.requiredPermissions
          );
          
          if (!isAuthorized) {
            context.isAuthenticated = false;
          }
        }
      }
    }

    return context;
  }

  public createAuthMiddleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const request: AuthRequest = {
          headers: req.headers,
          body: req.body,
          query: req.query,
        };

        const context = await this.authenticate(request);

        if (!context.rateLimit.allowed) {
          res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((context.rateLimit.resetTime - Date.now()) / 1000),
          });
          return;
        }

        if (this.config.authRequired && !context.isAuthenticated) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
          return;
        }

        req.authContext = context;
        next();
      } catch (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authentication middleware error',
        });
      }
    };
  }

  public createCORSMiddleware() {
    if (!this.config.enableCORS) {
      return (_req: any, _res: any, next: any) => next();
    }

    return (_req: any, res: any, next: any) => {
      const origin = _req.headers.origin;
      
      if (this.config.auth.allowedOrigins?.includes('*') || 
          (origin && this.config.auth.allowedOrigins?.includes(origin))) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }

      res.header('Access-Control-Allow-Methods', this.config.allowedMethods.join(', '));
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
      res.header('Access-Control-Allow-Credentials', 'true');

      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    };
  }

  public createSecurityHeadersMiddleware() {
    return (_req: any, res: any, next: any) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.header('Content-Security-Policy', "default-src 'self'");
      
      next();
    };
  }

  public createRateLimitMiddleware() {
    return this.rateLimiter.createMiddleware();
  }

  private async tryAuthentication(request: AuthRequest): Promise<AuthResult> {
    const jwtResult = await this.jwtAuth.authenticate(request);
    if (jwtResult.success) {
      return jwtResult;
    }

    const apiKeyResult = await this.apiKeyAuth.authenticate(request);
    if (apiKeyResult.success) {
      return apiKeyResult;
    }

    return {
      success: false,
      error: 'Invalid authentication credentials',
      statusCode: 401,
    };
  }

  public async generateToken(context: AuthContext, type: 'jwt' | 'apikey' = 'jwt'): Promise<any> {
    if (type === 'jwt') {
      return this.jwtAuth.generateToken(context);
    } else {
      return this.apiKeyAuth.generateToken(context);
    }
  }

  public async validateToken(token: string, type: 'jwt' | 'apikey' = 'jwt'): Promise<AuthResult> {
    if (type === 'jwt') {
      return this.jwtAuth.validateToken(token);
    } else {
      return this.apiKeyAuth.validateToken(token);
    }
  }

  public getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  public cleanup() {
    this.rateLimiter.cleanup();
  }
}

export function createAuthMiddleware(config: MiddlewareConfig): AuthMiddleware {
  return new AuthMiddleware(config);
}