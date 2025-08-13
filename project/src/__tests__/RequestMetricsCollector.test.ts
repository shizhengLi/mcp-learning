import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { RequestMetricsCollector } from '../metrics/RequestMetricsCollector'

describe('RequestMetricsCollector', () => {
  let collector: RequestMetricsCollector

  beforeEach(() => {
    collector = new RequestMetricsCollector(100)
  })

  afterEach(() => {
    collector.clearHistory()
  })

  describe('Request Tracking', () => {
    it('should start and track active requests', () => {
      const requestId = 'req-123'
      const request = { method: 'GET', path: '/test' }

      collector.startRequest(requestId, request)

      expect(collector.getActiveRequestCount()).toBe(1)
      expect(collector.getActiveRequests()).toHaveLength(1)
    })

    it('should end request and record metrics', () => {
      const requestId = 'req-123'
      const request = { method: 'GET', path: '/test' }
      const response = { statusCode: 200 }

      collector.startRequest(requestId, request)
      const metrics = collector.endRequest(requestId, response)

      expect(metrics).toBeTruthy()
      expect(metrics?.requestId).toBe(requestId)
      expect(metrics?.method).toBe('GET')
      expect(metrics?.path).toBe('/test')
      expect(metrics?.statusCode).toBe(200)
      expect(metrics?.success).toBe(true)
      expect(collector.getActiveRequestCount()).toBe(0)
    })

    it('should handle request with error', () => {
      const requestId = 'req-123'
      const request = { method: 'POST', path: '/test' }
      const response = { statusCode: 500 }

      collector.startRequest(requestId, request)
      const metrics = collector.endRequest(requestId, response, 'Database error')

      expect(metrics?.success).toBe(false)
      expect(metrics?.error).toBe('Database error')
      expect(metrics?.statusCode).toBe(500)
    })

    it('should return null for unknown request', () => {
      const metrics = collector.endRequest('unknown-req', {})
      expect(metrics).toBeNull()
    })
  })

  describe('Request History', () => {
    it('should maintain request history', () => {
      const request1 = { method: 'GET', path: '/test1' }
      const request2 = { method: 'POST', path: '/test2' }
      const response = { statusCode: 200 }

      collector.startRequest('req-1', request1)
      collector.endRequest('req-1', response)

      collector.startRequest('req-2', request2)
      collector.endRequest('req-2', response)

      const history = collector.getRequestHistory()
      expect(history).toHaveLength(2)
      expect(history[0].requestId).toBe('req-2') // Most recent first
      expect(history[1].requestId).toBe('req-1')
    })

    it('should limit history size', () => {
      const smallCollector = new RequestMetricsCollector(2)
      const response = { statusCode: 200 }

      // Add 3 requests
      for (let i = 1; i <= 3; i++) {
        smallCollector.startRequest(`req-${i}`, { method: 'GET', path: `/test${i}` })
        smallCollector.endRequest(`req-${i}`, response)
      }

      const history = smallCollector.getRequestHistory()
      expect(history).toHaveLength(2)
      expect(history[0].requestId).toBe('req-3')
      expect(history[1].requestId).toBe('req-2')
    })

    it('should return limited history', () => {
      const response = { statusCode: 200 }

      for (let i = 1; i <= 5; i++) {
        collector.startRequest(`req-${i}`, { method: 'GET', path: `/test${i}` })
        collector.endRequest(`req-${i}`, response)
      }

      const limitedHistory = collector.getRequestHistory(3)
      expect(limitedHistory).toHaveLength(3)
      expect(limitedHistory[0].requestId).toBe('req-5')
    })
  })

  describe('Request Filtering', () => {
    beforeEach(() => {
      const response = { statusCode: 200 }
      const errorResponse = { statusCode: 500 }

      // Add various requests
      collector.startRequest('req-1', { method: 'GET', path: '/users' })
      collector.endRequest('req-1', response)

      collector.startRequest('req-2', { method: 'POST', path: '/users' })
      collector.endRequest('req-2', response)

      collector.startRequest('req-3', { method: 'GET', path: '/posts' })
      collector.endRequest('req-3', response)

      collector.startRequest('req-4', { method: 'DELETE', path: '/users/1' })
      collector.endRequest('req-4', errorResponse, 'Not found')
    })

    it('should filter by time range', () => {
      const now = Date.now()
      const startTime = now - 5000 // Last 5 seconds
      const endTime = now

      const filtered = collector.getRequestsByTimeRange(startTime, endTime)
      expect(filtered).toHaveLength(4) // All requests are recent
    })

    it('should filter by status code', () => {
      const successRequests = collector.getRequestsByStatusCode(200)
      expect(successRequests).toHaveLength(3)

      const errorRequests = collector.getRequestsByStatusCode(500)
      expect(errorRequests).toHaveLength(1)
    })

    it('should filter by path', () => {
      const userRequests = collector.getRequestsByPath('/users')
      expect(userRequests).toHaveLength(2)

      const postRequests = collector.getRequestsByPath('/posts')
      expect(postRequests).toHaveLength(1)
    })

    it('should get error requests', () => {
      const errorRequests = collector.getErrorRequests()
      expect(errorRequests).toHaveLength(1)
      expect(errorRequests[0].success).toBe(false)
    })

    it('should get slow requests', () => {
      // Add a slow request
      collector.startRequest('slow-req', { method: 'GET', path: '/slow' })
      collector.endRequest('slow-req', { statusCode: 200 })

      // Modify the duration to be slow
      const history = collector.getRequestHistory()
      const slowReq = history.find(req => req.requestId === 'slow-req')
      if (slowReq) {
        slowReq.duration = 1500
      }

      const slowRequests = collector.getSlowRequests(1000)
      expect(slowRequests).toHaveLength(1)
      expect(slowRequests[0].duration).toBeGreaterThan(1000)
    })
  })

  describe('Request Statistics', () => {
    beforeEach(() => {
      const response = { statusCode: 200 }
      const errorResponse = { statusCode: 500 }

      // Add requests with different durations
      collector.startRequest('req-1', { method: 'GET', path: '/test' })
      collector.endRequest('req-1', response)

      collector.startRequest('req-2', { method: 'GET', path: '/test' })
      collector.endRequest('req-2', response)

      collector.startRequest('req-3', { method: 'GET', path: '/test' })
      collector.endRequest('req-3', errorResponse, 'Error')

      // Modify durations for testing
      const history = collector.getRequestHistory()
      history[0].duration = 100 // Most recent
      history[1].duration = 200
      history[2].duration = 300
    })

    it('should calculate request statistics', () => {
      const stats = collector.getRequestStats()

      expect(stats.total).toBe(3)
      expect(stats.successful).toBe(2)
      expect(stats.failed).toBe(1)
      expect(stats.avgDuration).toBe(200) // (100 + 200 + 300) / 3
      expect(stats.minDuration).toBe(100)
      expect(stats.maxDuration).toBe(300)
      expect(stats.errorRate).toBeCloseTo(0.333, 2) // 1/3
    })

    it('should handle empty statistics', () => {
      collector.clearHistory()
      const stats = collector.getRequestStats()

      expect(stats.total).toBe(0)
      expect(stats.successful).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.avgDuration).toBe(0)
      expect(stats.requestsPerSecond).toBe(0)
      expect(stats.errorRate).toBe(0)
    })
  })

  describe('Top Requests', () => {
    beforeEach(() => {
      const response = { statusCode: 200 }

      // Add requests with different durations
      const requests = [
        { id: 'req-1', duration: 1000 },
        { id: 'req-2', duration: 500 },
        { id: 'req-3', duration: 1500 },
        { id: 'req-4', duration: 200 },
        { id: 'req-5', duration: 800 },
      ]

      requests.forEach(req => {
        collector.startRequest(req.id, { method: 'GET', path: '/test' })
        collector.endRequest(req.id, response)
      })

      // Update durations
      const history = collector.getRequestHistory()
      requests.forEach((req, index) => {
        history[index].duration = req.duration
      })
    })

    it('should get top slow requests', () => {
      const topSlow = collector.getTopSlowRequests(3)

      expect(topSlow).toHaveLength(3)
      expect(topSlow[0].duration).toBe(1500) // Slowest
      expect(topSlow[1].duration).toBe(1000)
      expect(topSlow[2].duration).toBe(800)
    })

    it('should get top error paths', () => {
      // Add some error requests
      const errorResponse = { statusCode: 500 }

      collector.startRequest('error-1', { method: 'GET', path: '/api/users' })
      collector.endRequest('error-1', errorResponse, 'Error 1')

      collector.startRequest('error-2', { method: 'GET', path: '/api/users' })
      collector.endRequest('error-2', errorResponse, 'Error 2')

      collector.startRequest('success-1', { method: 'GET', path: '/api/users' })
      collector.endRequest('success-1', { statusCode: 200 })

      collector.startRequest('error-3', { method: 'GET', path: '/api/posts' })
      collector.endRequest('error-3', errorResponse, 'Error 3')

      const topErrorPaths = collector.getTopErrorPaths()

      expect(topErrorPaths.length).toBeGreaterThan(0)
      const userPath = topErrorPaths.find(p => p.path === '/api/users')
      expect(userPath).toBeDefined()
      expect(userPath?.count).toBe(3)
      expect(userPath?.errorRate).toBeCloseTo(0.667, 2) // 2/3
    })
  })

  describe('Active Requests', () => {
    it('should track active request duration', () => {
      jest.useFakeTimers()

      const requestId = 'req-123'
      const request = { method: 'GET', path: '/test' }

      collector.startRequest(requestId, request)

      // Wait a bit
      const startDelay = 10
      jest.advanceTimersByTime(startDelay)

      const activeRequests = collector.getActiveRequests()
      expect(activeRequests).toHaveLength(1)
      expect(activeRequests[0].duration).toBeGreaterThanOrEqual(startDelay)

      jest.useRealTimers()
    })

    it('should handle multiple active requests', () => {
      collector.startRequest('req-1', { method: 'GET', path: '/test1' })
      collector.startRequest('req-2', { method: 'POST', path: '/test2' })
      collector.startRequest('req-3', { method: 'DELETE', path: '/test3' })

      expect(collector.getActiveRequestCount()).toBe(3)
      expect(collector.getActiveRequests()).toHaveLength(3)
    })
  })

  describe('Clear History', () => {
    it('should clear all history', () => {
      const response = { statusCode: 200 }

      collector.startRequest('req-1', { method: 'GET', path: '/test' })
      collector.endRequest('req-1', response)

      collector.startRequest('req-2', { method: 'GET', path: '/test' })
      collector.endRequest('req-2', response)

      expect(collector.getRequestHistory()).toHaveLength(2)

      collector.clearHistory()
      expect(collector.getRequestHistory()).toHaveLength(0)
      expect(collector.getActiveRequestCount()).toBe(0)
    })
  })
})
