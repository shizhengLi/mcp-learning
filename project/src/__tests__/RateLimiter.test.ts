import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RateLimiter, RateLimitConfig } from '../auth/RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let config: RateLimitConfig;

  beforeEach(() => {
    config = {
      windowMs: 60000, // 1 minute
      maxRequests: 5,
      keyGenerator: (req) => req.ip || 'unknown',
    };
    rateLimiter = new RateLimiter(config);
  });

  afterEach(() => {
    rateLimiter.cleanup();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const request = { ip: '192.168.1.1' };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit(request);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - i - 1);
      }
    });

    it('should block requests exceeding limit', async () => {
      const request = { ip: '192.168.1.1' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      // Next request should be blocked
      const result = await rateLimiter.checkLimit(request);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset limit after window expires', async () => {
      const request = { ip: '192.168.1.1' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      // Create a rate limiter with very short window
      const shortConfig = {
        ...config,
        windowMs: 100, // 100ms
      };
      const shortRateLimiter = new RateLimiter(shortConfig);

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await shortRateLimiter.checkLimit(request);
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should allow requests again
      const result = await shortRateLimiter.checkLimit(request);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should handle different clients independently', async () => {
      const request1 = { ip: '192.168.1.1' };
      const request2 = { ip: '192.168.1.2' };

      // Use up limit for first client
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request1);
      }

      // Second client should still be able to make requests
      const result = await rateLimiter.checkLimit(request2);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('Success/Failure Tracking', () => {
    it('should decrement count on successful request when configured', async () => {
      const configWithSkip = {
        ...config,
        skipSuccessfulRequests: true,
      };
      const rateLimiterWithSkip = new RateLimiter(configWithSkip);
      const request = { ip: '192.168.1.1' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiterWithSkip.checkLimit(request);
      }

      // Should be blocked
      let result = await rateLimiterWithSkip.checkLimit(request);
      expect(result.allowed).toBe(false);

      // Record success
      await rateLimiterWithSkip.recordSuccess(request);

      // Should now be allowed
      result = await rateLimiterWithSkip.checkLimit(request);
      expect(result.allowed).toBe(true);
    });

    it('should decrement count on failed request when configured', async () => {
      const configWithSkip = {
        ...config,
        skipFailedRequests: true,
      };
      const rateLimiterWithSkip = new RateLimiter(configWithSkip);
      const request = { ip: '192.168.1.1' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiterWithSkip.checkLimit(request);
      }

      // Should be blocked
      let result = await rateLimiterWithSkip.checkLimit(request);
      expect(result.allowed).toBe(false);

      // Record failure
      await rateLimiterWithSkip.recordFailure(request);

      // Should now be allowed
      result = await rateLimiterWithSkip.checkLimit(request);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator', async () => {
      const configWithCustomKey = {
        ...config,
        keyGenerator: (req: any) => `custom:${req.id}`,
      };
      const customRateLimiter = new RateLimiter(configWithCustomKey);
      const request = { id: 'user-123' };

      const result = await customRateLimiter.checkLimit(request);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('Limit Reached Callback', () => {
    it('should call limit reached callback', async () => {
      const callback = jest.fn();
      const configWithCallback = {
        ...config,
        onLimitReached: callback,
      };
      const callbackRateLimiter = new RateLimiter(configWithCallback);
      const request = { ip: '192.168.1.1' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await callbackRateLimiter.checkLimit(request);
      }

      // Next request should trigger callback
      await callbackRateLimiter.checkLimit(request);

      expect(callback).toHaveBeenCalledWith('192.168.1.1', expect.any(Object));
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset limit for specific key', async () => {
      const request = { ip: '192.168.1.1' };

      // Use up some requests
      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkLimit(request);
      }

      let result = await rateLimiter.checkLimit(request);
      expect(result.remaining).toBe(1);

      // Reset limit
      rateLimiter.resetLimit('192.168.1.1');

      result = await rateLimiter.checkLimit(request);
      expect(result.remaining).toBe(4);
    });

    it('should cleanup expired entries', async () => {
      const shortConfig = {
        ...config,
        windowMs: 50, // 50ms
      };
      const shortRateLimiter = new RateLimiter(shortConfig);

      // Create entries for different IPs
      await shortRateLimiter.checkLimit({ ip: '192.168.1.1' });
      await shortRateLimiter.checkLimit({ ip: '192.168.1.2' });

      expect(shortRateLimiter.getStats().totalKeys).toBe(2);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup should remove expired entries
      shortRateLimiter.cleanup();
      expect(shortRateLimiter.getStats().totalKeys).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      const request = { ip: '192.168.1.1' };

      // Make some requests
      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkLimit(request);
      }

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(1);
      expect(stats.activeKeys).toBe(1);
      expect(stats.memoryUsage).toMatch(/KB$/);
    });
  });

  describe('Middleware Creation', () => {
    it('should create middleware function', () => {
      const middleware = rateLimiter.createMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should handle middleware request flow', async () => {
      const middleware = rateLimiter.createMiddleware();
      const req = { ip: '192.168.1.1' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // First request should pass
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);

      // Reset mocks
      next.mockClear();
      res.status.mockClear();
      res.json.mockClear();

      // Use up remaining requests
      for (let i = 0; i < 4; i++) {
        await rateLimiter.checkLimit(req);
      }

      // Next request should be blocked
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});