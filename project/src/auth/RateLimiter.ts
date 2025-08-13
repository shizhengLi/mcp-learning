export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (key: string, limit: RateLimitEntry) => void;
}

export class RateLimiter {
  protected config: RateLimitConfig;
  private store: Map<string, RateLimitEntry> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      onLimitReached: config.onLimitReached,
    };
  }

  public async checkLimit(request: any): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    total: number;
  }> {
    const key = this.config.keyGenerator!(request);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    
    if (!entry || entry.resetTime < windowStart) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.store.set(key, entry);
    }

    const isAllowed = entry.count < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);

    if (isAllowed) {
      entry.count++;
    } else if (this.config.onLimitReached) {
      this.config.onLimitReached(key, entry);
    }

    return {
      allowed: isAllowed,
      remaining,
      resetTime: entry.resetTime,
      total: this.config.maxRequests,
    };
  }

  public async recordSuccess(request: any): Promise<void> {
    if (this.config.skipSuccessfulRequests) {
      const key = this.config.keyGenerator!(request);
      const entry = this.store.get(key);
      if (entry && entry.count > 0) {
        entry.count--;
      }
    }
  }

  public async recordFailure(request: any): Promise<void> {
    if (this.config.skipFailedRequests) {
      const key = this.config.keyGenerator!(request);
      const entry = this.store.get(key);
      if (entry && entry.count > 0) {
        entry.count--;
      }
    }
  }

  public resetLimit(key: string): void {
    this.store.delete(key);
  }

  public cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < windowStart) {
        this.store.delete(key);
      }
    }
  }

  public getStats(): {
    totalKeys: number;
    activeKeys: number;
    memoryUsage: string;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let activeKeys = 0;

    for (const entry of this.store.values()) {
      if (entry.resetTime >= windowStart) {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
      memoryUsage: `${(this.store.size * 64 / 1024).toFixed(2)} KB`,
    };
  }

  private defaultKeyGenerator(request: any): string {
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const userAgent = request.headers?.['user-agent'] || 'unknown';
    return `${ip}:${userAgent}`;
  }

  public createMiddleware() {
    return async (req: any, res: any, next: any) => {
      const result = await this.checkLimit(req);
      
      res.set('X-RateLimit-Limit', result.total.toString());
      res.set('X-RateLimit-Remaining', result.remaining.toString());
      res.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

      if (!result.allowed) {
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
        return;
      }

      next();
    };
  }
}

export class SlidingWindowRateLimiter extends RateLimiter {
  private requestLog: Map<string, Array<{ timestamp: number; weight: number }>> = new Map();

  constructor(config: RateLimitConfig) {
    super(config);
  }

  public override async checkLimit(request: any): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    total: number;
  }> {
    const key = this.config.keyGenerator!(request);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let log = this.requestLog.get(key) || [];
    
    log = log.filter(entry => entry.timestamp > windowStart);
    
    const currentCount = log.reduce((sum, entry) => sum + entry.weight, 0);
    const isAllowed = currentCount < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - currentCount);

    if (isAllowed) {
      log.push({ timestamp: now, weight: 1 });
      this.requestLog.set(key, log);
    } else if (this.config.onLimitReached) {
      this.config.onLimitReached(key, {
        count: currentCount,
        resetTime: now + this.config.windowMs,
      });
    }

    return {
      allowed: isAllowed,
      remaining,
      resetTime: now + this.config.windowMs,
      total: this.config.maxRequests,
    };
  }

  public override resetLimit(key: string): void {
    this.requestLog.delete(key);
  }

  public override cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, log] of this.requestLog.entries()) {
      const filteredLog = log.filter(entry => entry.timestamp > windowStart);
      if (filteredLog.length === 0) {
        this.requestLog.delete(key);
      } else {
        this.requestLog.set(key, filteredLog);
      }
    }
  }
}