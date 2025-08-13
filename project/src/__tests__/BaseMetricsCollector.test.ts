import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseMetricsCollector } from '../metrics/BaseMetricsCollector';
import { MetricsConfig } from '../metrics/types';

describe('BaseMetricsCollector', () => {
  let metricsCollector: BaseMetricsCollector;
  let config: MetricsConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      interval: 60000,
      retentionPeriod: 3600000,
      maxSamples: 1000,
      buckets: [10, 50, 100, 250, 500, 1000],
    };
    metricsCollector = new BaseMetricsCollector(config);
  });

  afterEach(() => {
    metricsCollector.reset();
  });

  describe('Counter Metrics', () => {
    it('should increment counter', () => {
      metricsCollector.incrementCounter('test_counter');
      const metrics = metricsCollector.getMetrics();
      
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test_counter');
      expect(metrics[0].type).toBe('counter');
      expect((metrics[0] as any).value).toBe(1);
    });

    it('should increment counter with custom value', () => {
      metricsCollector.incrementCounter('test_counter', 5);
      const metrics = metricsCollector.getMetrics();
      
      expect((metrics[0] as any).value).toBe(5);
    });

    it('should increment counter with tags', () => {
      metricsCollector.incrementCounter('test_counter', 1, { method: 'GET', path: '/test' });
      const metrics = metricsCollector.getMetrics();
      
      expect(metrics[0].tags).toEqual({ method: 'GET', path: '/test' });
    });

    it('should handle multiple counter increments', () => {
      metricsCollector.incrementCounter('test_counter', 1);
      metricsCollector.incrementCounter('test_counter', 2);
      metricsCollector.incrementCounter('test_counter', 3);
      
      const metrics = metricsCollector.getMetrics();
      expect((metrics[0] as any).value).toBe(6);
    });
  });

  describe('Gauge Metrics', () => {
    it('should set gauge value', () => {
      metricsCollector.setGauge('test_gauge', 42);
      const metrics = metricsCollector.getMetrics();
      
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test_gauge');
      expect(metrics[0].type).toBe('gauge');
      expect((metrics[0] as any).value).toBe(42);
    });

    it('should update gauge value', () => {
      metricsCollector.setGauge('test_gauge', 10);
      metricsCollector.setGauge('test_gauge', 20);
      
      const metrics = metricsCollector.getMetrics();
      expect((metrics[0] as any).value).toBe(20);
    });

    it('should set gauge with tags', () => {
      metricsCollector.setGauge('test_gauge', 100, { server: 'web-1' });
      const metrics = metricsCollector.getMetrics();
      
      expect(metrics[0].tags).toEqual({ server: 'web-1' });
    });
  });

  describe('Timer Metrics', () => {
    it('should record timer', () => {
      metricsCollector.recordTimer('test_timer', 150);
      const metrics = metricsCollector.getMetrics();
      
      const timer = metrics.find(m => m.name === 'test_timer' && m.type === 'timer');
      expect(timer).toBeDefined();
      expect((timer as any)?.duration).toBe(150);
    });

    it('should record multiple timers', () => {
      metricsCollector.recordTimer('test_timer', 100);
      metricsCollector.recordTimer('test_timer', 200);
      metricsCollector.recordTimer('test_timer', 300);
      
      const allMetrics = metricsCollector.getMetrics();
      const timers = allMetrics.filter((m: any) => m.name === 'test_timer' && m.type === 'timer');
      expect(timers).toHaveLength(3);
    });

    it('should also create histogram for timer', () => {
      metricsCollector.recordTimer('test_timer', 150);
      
      const histogram = metricsCollector.getMetrics().find(m => m.name === 'test_timer' && m.type === 'histogram') as any;
      expect(histogram).toBeDefined();
      expect(histogram?.sum).toBe(150);
      expect(histogram?.count).toBe(1);
    });
  });

  describe('Histogram Metrics', () => {
    it('should record histogram value', () => {
      metricsCollector.recordHistogram('test_histogram', 75);
      const metrics = metricsCollector.getMetrics();
      
      const histogram = metrics.find(m => m.name === 'test_histogram' && m.type === 'histogram') as any;
      expect(histogram).toBeDefined();
      expect(histogram?.sum).toBe(75);
      expect(histogram?.count).toBe(1);
      expect(histogram?.values).toContain(75);
    });

    it('should aggregate multiple histogram values', () => {
      metricsCollector.recordHistogram('test_histogram', 10);
      metricsCollector.recordHistogram('test_histogram', 20);
      metricsCollector.recordHistogram('test_histogram', 30);
      
      const histogram = metricsCollector.getMetrics().find(m => m.name === 'test_histogram' && m.type === 'histogram') as any;
      expect(histogram?.sum).toBe(60);
      expect(histogram?.count).toBe(3);
      expect(histogram?.values).toEqual([10, 20, 30]);
    });
  });

  describe('Request Metrics', () => {
    it('should record request metrics', () => {
      const requestMetrics = {
        requestId: 'req-123',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 150,
        timestamp: Date.now(),
        success: true,
      };

      metricsCollector.recordRequest(requestMetrics);
      const recorded = metricsCollector.getRequestMetrics();
      
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toEqual(requestMetrics);
    });

    it('should update counters when recording request', () => {
      const requestMetrics = {
        requestId: 'req-123',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 150,
        timestamp: Date.now(),
        success: true,
      };

      metricsCollector.recordRequest(requestMetrics);
      const metrics = metricsCollector.getMetrics();
      
      expect(metrics.some(m => m.name === 'requests_total')).toBe(true);
      expect(metrics.some(m => m.name === 'requests_successful')).toBe(true);
    });

    it('should record failed request', () => {
      const requestMetrics = {
        requestId: 'req-123',
        method: 'POST',
        path: '/test',
        statusCode: 500,
        duration: 100,
        timestamp: Date.now(),
        success: false,
        error: 'Internal server error',
      };

      metricsCollector.recordRequest(requestMetrics);
      const recorded = metricsCollector.getRequestMetrics();
      
      expect(recorded[0].success).toBe(false);
      expect(recorded[0].error).toBe('Internal server error');
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics', () => {
      const performanceMetrics = {
        memoryUsage: {
          used: 1000000,
          total: 2000000,
          percentage: 50,
        },
        cpuUsage: 25,
        uptime: 10000,
        timestamp: Date.now(),
      };

      metricsCollector.recordPerformance(performanceMetrics);
      const recorded = metricsCollector.getMetrics();
      
      expect(recorded.some(m => m.name === 'memory_used')).toBe(true);
      expect(recorded.some(m => m.name === 'memory_total')).toBe(true);
      expect(recorded.some(m => m.name === 'memory_percentage')).toBe(true);
      expect(recorded.some(m => m.name === 'cpu_usage')).toBe(true);
      expect(recorded.some(m => m.name === 'uptime')).toBe(true);
    });
  });

  describe('Server Metrics', () => {
    it('should calculate server metrics', () => {
      // Add some request metrics
      const now = Date.now();
      metricsCollector.recordRequest({
        requestId: 'req-1',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 100,
        timestamp: now,
        success: true,
      });

      metricsCollector.recordRequest({
        requestId: 'req-2',
        method: 'POST',
        path: '/test',
        statusCode: 400,
        duration: 200,
        timestamp: now,
        success: false,
      });

      const serverMetrics = metricsCollector.getServerMetrics();
      
      expect(serverMetrics.requests.total).toBe(2);
      expect(serverMetrics.requests.successful).toBe(1);
      expect(serverMetrics.requests.failed).toBe(1);
      expect(serverMetrics.responseTime.min).toBe(100);
      expect(serverMetrics.responseTime.max).toBe(200);
      expect(serverMetrics.responseTime.avg).toBe(150);
    });

    it('should handle empty request metrics', () => {
      const serverMetrics = metricsCollector.getServerMetrics();
      
      expect(serverMetrics.requests.total).toBe(0);
      expect(serverMetrics.requests.successful).toBe(0);
      expect(serverMetrics.requests.failed).toBe(0);
      expect(serverMetrics.responseTime.min).toBe(0);
      expect(serverMetrics.responseTime.max).toBe(0);
      expect(serverMetrics.responseTime.avg).toBe(0);
    });
  });

  describe('Aggregated Metrics', () => {
    it('should get aggregated metrics', () => {
      const now = Date.now();
      const past = now - 1800000; // 30 minutes ago

      metricsCollector.recordRequest({
        requestId: 'req-1',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 100,
        timestamp: now,
        success: true,
      });

      metricsCollector.recordRequest({
        requestId: 'req-2',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 200,
        timestamp: past,
        success: true,
      });

      const aggregated = metricsCollector.getAggregatedMetrics(3600000); // 1 hour
      
      expect(aggregated.requests.total).toBe(2);
      expect(aggregated.requests.successful).toBe(2);
      expect(aggregated.requests.failed).toBe(0);
      expect(aggregated.requests.avgDuration).toBe(150);
    });
  });

  describe('Disabled Metrics', () => {
    beforeEach(() => {
      config.enabled = false;
      metricsCollector = new BaseMetricsCollector(config);
    });

    it('should not record metrics when disabled', () => {
      metricsCollector.incrementCounter('test_counter');
      metricsCollector.setGauge('test_gauge', 42);
      metricsCollector.recordTimer('test_timer', 100);
      
      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(0);
    });

    it('should not record request metrics when disabled', () => {
      const requestMetrics = {
        requestId: 'req-123',
        method: 'GET',
        path: '/test',
        statusCode: 200,
        duration: 150,
        timestamp: Date.now(),
        success: true,
      };

      metricsCollector.recordRequest(requestMetrics);
      const recorded = metricsCollector.getRequestMetrics();
      
      expect(recorded).toHaveLength(0);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      metricsCollector.incrementCounter('test_counter');
      metricsCollector.setGauge('test_gauge', 42);
      metricsCollector.recordTimer('test_timer', 100);
      
      metricsCollector.reset();
      
      expect(metricsCollector.getMetrics()).toHaveLength(0);
      expect(metricsCollector.getRequestMetrics()).toHaveLength(0);
    });
  });
});