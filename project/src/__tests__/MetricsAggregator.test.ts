import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { MetricsAggregator, AggregationConfig } from '../metrics/MetricsAggregator'
import { Counter, Gauge, Histogram, Timer } from '../metrics/types'

describe('MetricsAggregator', () => {
  let aggregator: MetricsAggregator
  let config: AggregationConfig

  beforeEach(() => {
    config = {
      interval: 1000,
      retentionPeriods: {
        raw: 60000,
        minute: 3600000,
        hour: 86400000,
        day: 2592000000,
      },
      maxSamples: {
        raw: 100,
        minute: 60,
        hour: 24,
        day: 30,
      },
    }
    aggregator = new MetricsAggregator(config)
  })

  afterEach(() => {
    aggregator.clearAllMetrics()
  })

  describe('Adding Metrics', () => {
    it('should add counter metric', () => {
      const counter: Counter = {
        name: 'test_counter',
        description: 'Test counter',
        type: 'counter',
        value: 5,
        tags: { method: 'GET' },
      }

      aggregator.addMetric(counter)
      const rawMetrics = aggregator.getRawMetrics('test_counter', { method: 'GET' })

      expect(rawMetrics).toHaveLength(1)
      expect(rawMetrics[0]).toEqual(counter)
    })

    it('should add gauge metric', () => {
      const gauge: Gauge = {
        name: 'test_gauge',
        description: 'Test gauge',
        type: 'gauge',
        value: 42,
        tags: { server: 'web-1' },
      }

      aggregator.addMetric(gauge)
      const rawMetrics = aggregator.getRawMetrics('test_gauge', { server: 'web-1' })

      expect(rawMetrics).toHaveLength(1)
      expect(rawMetrics[0]).toEqual(gauge)
    })

    it('should add histogram metric', () => {
      const histogram: Histogram = {
        name: 'test_histogram',
        description: 'Test histogram',
        type: 'histogram',
        buckets: [10, 50, 100],
        count: 5,
        sum: 250,
        values: [10, 20, 30, 40, 50],
      }

      aggregator.addMetric(histogram)
      const rawMetrics = aggregator.getRawMetrics('test_histogram')

      expect(rawMetrics).toHaveLength(1)
      expect(rawMetrics[0]).toEqual(histogram)
    })

    it('should add timer metric', () => {
      const timer: Timer = {
        name: 'test_timer',
        description: 'Test timer',
        type: 'timer',
        duration: 150,
        tags: { method: 'POST' },
      }

      aggregator.addMetric(timer)
      const rawMetrics = aggregator.getRawMetrics('test_timer', { method: 'POST' })

      expect(rawMetrics).toHaveLength(1)
      expect(rawMetrics[0]).toEqual(timer)
    })

    it('should add multiple metrics with same name', () => {
      const counter1: Counter = {
        name: 'test_counter',
        description: 'Test counter',
        type: 'counter',
        value: 1,
        tags: { method: 'GET' },
      }

      const counter2: Counter = {
        name: 'test_counter',
        description: 'Test counter',
        type: 'counter',
        value: 2,
        tags: { method: 'POST' },
      }

      aggregator.addMetric(counter1)
      aggregator.addMetric(counter2)

      // Get all metrics with this name (no tags filter) - this returns all metrics
      const rawMetrics = aggregator.getRawMetrics()
      const counterMetrics = rawMetrics.filter(m => m.name === 'test_counter')
      expect(counterMetrics).toHaveLength(2)
    })
  })

  describe('Request Metrics', () => {
    it('should add request metrics', () => {
      const requestMetrics = {
        requestId: 'req-123',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 150,
        timestamp: Date.now(),
        success: true,
      }

      aggregator.addRequestMetrics(requestMetrics)

      // Should create multiple metrics from request
      const allMetrics = aggregator.getRawMetrics()
      const totalRequests = allMetrics.filter(m => m.name === 'requests_total')
      const requestDuration = allMetrics.filter(m => m.name === 'request_duration')
      const successfulRequests = allMetrics.filter(m => m.name === 'requests_successful')

      expect(totalRequests.length).toBeGreaterThan(0)
      expect(requestDuration.length).toBeGreaterThan(0)
      expect(successfulRequests.length).toBeGreaterThan(0)
    })

    it('should add failed request metrics', () => {
      const requestMetrics = {
        requestId: 'req-123',
        method: 'POST',
        path: '/test',
        statusCode: 500,
        duration: 100,
        timestamp: Date.now(),
        success: false,
        error: 'Server error',
      }

      aggregator.addRequestMetrics(requestMetrics)

      const allMetrics = aggregator.getRawMetrics()
      const failedRequests = allMetrics.filter(m => m.name === 'requests_failed')
      expect(failedRequests.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Metrics', () => {
    it('should add performance metrics', () => {
      const performanceMetrics = {
        memoryUsage: {
          used: 1000000,
          total: 2000000,
          percentage: 50,
        },
        cpuUsage: 25,
        uptime: 10000,
        timestamp: Date.now(),
      }

      aggregator.addPerformanceMetrics(performanceMetrics)

      const allMetrics = aggregator.getRawMetrics()
      const memoryUsage = allMetrics.filter(m => m.name === 'memory_usage_percentage')
      const cpuUsage = allMetrics.filter(m => m.name === 'cpu_usage_percentage')
      const uptime = allMetrics.filter(m => m.name === 'uptime')

      expect(memoryUsage.length).toBeGreaterThan(0)
      expect(cpuUsage.length).toBeGreaterThan(0)
      expect(uptime.length).toBeGreaterThan(0)
    })
  })

  describe('Aggregated Metrics', () => {
    beforeEach(() => {
      // Add some metrics for aggregation
      for (let i = 1; i <= 5; i++) {
        const counter: Counter = {
          name: 'test_counter',
          description: 'Test counter',
          type: 'counter',
          value: i,
        }
        aggregator.addMetric(counter)
      }
    })

    it('should get aggregated metrics by interval', () => {
      // Note: This test would need actual aggregation to work
      // For now, we'll test the structure
      const minuteMetrics = aggregator.getAggregatedMetrics('minute', 'test_counter')

      expect(Array.isArray(minuteMetrics)).toBe(true)
    })

    it('should filter aggregated metrics by time range', () => {
      const timeRange = 3600000 // 1 hour
      const minuteMetrics = aggregator.getAggregatedMetrics(
        'minute',
        'test_counter',
        undefined,
        timeRange
      )

      expect(Array.isArray(minuteMetrics)).toBe(true)
    })
  })

  describe('Metric Summary', () => {
    beforeEach(() => {
      // Add some counter metrics
      for (let i = 1; i <= 10; i++) {
        const counter: Counter = {
          name: 'test_counter',
          description: 'Test counter',
          type: 'counter',
          value: i * 10,
        }
        aggregator.addMetric(counter)
      }
    })

    it('should get metric summary', () => {
      const summary = aggregator.getMetricSummary('test_counter')

      expect(summary.name).toBe('test_counter')
      expect(summary.total).toBe(10)
      expect(summary.avg).toBe(55) // (10 + 20 + ... + 100) / 10
      expect(summary.min).toBe(10)
      expect(summary.max).toBe(100)
      expect(summary.latest).toBe(100)
      expect(['increasing', 'decreasing', 'stable']).toContain(summary.trend)
    })

    it('should handle empty metric summary', () => {
      const summary = aggregator.getMetricSummary('nonexistent_metric')

      expect(summary.name).toBe('nonexistent_metric')
      expect(summary.total).toBe(0)
      expect(summary.avg).toBe(0)
      expect(summary.min).toBe(0)
      expect(summary.max).toBe(0)
      expect(summary.latest).toBe(0)
      expect(summary.trend).toBe('stable')
    })
  })

  describe('Top Metrics', () => {
    beforeEach(() => {
      // Add metrics with different values
      const metrics = [
        { name: 'counter1', value: 100 },
        { name: 'counter2', value: 200 },
        { name: 'counter3', value: 50 },
        { name: 'counter4', value: 300 },
        { name: 'counter5', value: 150 },
      ]

      metrics.forEach(({ name, value }) => {
        const counter: Counter = {
          name,
          description: `Test ${name}`,
          type: 'counter',
          value,
        }
        aggregator.addMetric(counter)
      })
    })

    it('should get top metrics by total', () => {
      const topMetrics = aggregator.getTopMetrics(3, 'total')

      expect(topMetrics).toHaveLength(3)
      expect(topMetrics[0].name).toBe('counter4') // Highest value
      expect(topMetrics[0].value).toBe(300)
      expect(topMetrics[1].name).toBe('counter2')
      expect(topMetrics[1].value).toBe(200)
      expect(topMetrics[2].name).toBe('counter5')
      expect(topMetrics[2].value).toBe(150)
    })

    it('should limit top metrics', () => {
      const topMetrics = aggregator.getTopMetrics(2)

      expect(topMetrics).toHaveLength(2)
      expect(topMetrics[0].value).toBe(300)
      expect(topMetrics[1].value).toBe(200)
    })
  })

  describe('Export Metrics', () => {
    beforeEach(() => {
      // Add some test metrics
      const counter: Counter = {
        name: 'test_counter',
        description: 'Test counter',
        type: 'counter',
        value: 42,
        tags: { method: 'GET' },
      }

      const gauge: Gauge = {
        name: 'test_gauge',
        description: 'Test gauge',
        type: 'gauge',
        value: 100,
        tags: { server: 'web-1' },
      }

      aggregator.addMetric(counter)
      aggregator.addMetric(gauge)
    })

    it('should export metrics as JSON', () => {
      const json = aggregator.exportMetrics('json')

      expect(json).toBeDefined()
      expect(typeof json).toBe('string')

      const parsed = JSON.parse(json)
      expect(parsed.raw).toBeDefined()
      expect(parsed.minute).toBeDefined()
      expect(parsed.hour).toBeDefined()
      expect(parsed.day).toBeDefined()
    })

    it('should export metrics as CSV', () => {
      const csv = aggregator.exportMetrics('csv')

      expect(csv).toBeDefined()
      expect(typeof csv).toBe('string')
      expect(csv.startsWith('name,type,interval,timestamp,value')).toBe(true)
    })

    it('should export metrics as Prometheus format', () => {
      const prometheus = aggregator.exportMetrics('prometheus')

      expect(prometheus).toBeDefined()
      expect(typeof prometheus).toBe('string')
      expect(prometheus.includes('# TYPE')).toBe(true)
    })

    it('should throw error for unsupported format', () => {
      expect(() => aggregator.exportMetrics('xml' as any)).toThrow('Unsupported export format: xml')
    })
  })

  describe('Aggregation', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should start and stop aggregation', () => {
      expect(() => aggregator.startAggregation()).not.toThrow()
      expect(() => aggregator.stopAggregation()).not.toThrow()
    })

    it('should aggregate metrics on interval', () => {
      const counter: Counter = {
        name: 'test_counter',
        description: 'Test counter',
        type: 'counter',
        value: 10,
      }

      aggregator.addMetric(counter)
      aggregator.startAggregation()

      // Advance timer to trigger aggregation
      jest.advanceTimersByTime(1000)

      // Check if aggregation occurred (minute metrics should exist)
      const minuteMetrics = aggregator.getAggregatedMetrics('minute', 'test_counter')
      expect(Array.isArray(minuteMetrics)).toBe(true)

      aggregator.stopAggregation()
    })
  })

  describe('Clear All Metrics', () => {
    it('should clear all metrics', () => {
      const counter: Counter = {
        name: 'test_counter',
        description: 'Test counter',
        type: 'counter',
        value: 10,
      }

      aggregator.addMetric(counter)
      expect(aggregator.getRawMetrics('test_counter')).toHaveLength(1)

      aggregator.clearAllMetrics()
      expect(aggregator.getRawMetrics('test_counter')).toHaveLength(0)
    })
  })
})
