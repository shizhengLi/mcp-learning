import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PerformanceMetricsCollector } from '../metrics/PerformanceMetricsCollector';

// Mock process.memoryUsage and process.cpuUsage
const mockMemoryUsage = jest.fn();
const mockCpuUsage = jest.fn();
const mockUptime = jest.fn();

beforeAll(() => {
  Object.defineProperty(process, 'memoryUsage', {
    value: mockMemoryUsage,
    configurable: true,
  });
  Object.defineProperty(process, 'cpuUsage', {
    value: mockCpuUsage,
    configurable: true,
  });
  Object.defineProperty(process, 'uptime', {
    value: mockUptime,
    configurable: true,
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('PerformanceMetricsCollector', () => {
  let collector: PerformanceMetricsCollector;

  beforeEach(() => {
    mockMemoryUsage.mockReturnValue({
      heapUsed: 1000000,
      heapTotal: 2000000,
      external: 500000,
      rss: 3000000,
    });

    mockCpuUsage.mockReturnValue({
      user: 1000,
      system: 500,
    });

    mockUptime.mockReturnValue(3600); // 1 hour

    collector = new PerformanceMetricsCollector(100, 1000);
  });

  afterEach(() => {
    if (collector) {
      collector.stopCollection();
      collector.clearHistory();
    }
    jest.clearAllMocks();
  });

  describe('Metrics Collection', () => {
    it('should collect performance metrics', () => {
      const metrics = collector.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.memoryUsage.used).toBe(1000000);
      expect(metrics.memoryUsage.total).toBe(2000000);
      expect(metrics.memoryUsage.percentage).toBe(50); // (1000000 / 2000000) * 100
      expect(metrics.cpuUsage).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should add metrics to history', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();

      expect(history).toHaveLength(1);
      expect(history[0].memoryUsage.percentage).toBe(50);
    });

    it('should maintain history size', () => {
      const smallCollector = new PerformanceMetricsCollector(2, 1000);

      // Add 3 metrics
      smallCollector.collectMetrics();
      smallCollector.collectMetrics();
      smallCollector.collectMetrics();

      const history = smallCollector.getMetricsHistory();
      expect(history).toHaveLength(2);
    });

    it('should return limited history', () => {
      collector.collectMetrics();
      collector.collectMetrics();
      collector.collectMetrics();

      const limitedHistory = collector.getMetricsHistory(2);
      expect(limitedHistory).toHaveLength(2);
    });
  });

  describe('Latest Metrics', () => {
    it('should return latest metrics', () => {
      collector.collectMetrics();
      const latest = collector.getLatestMetrics();

      expect(latest).toBeDefined();
      expect(latest?.memoryUsage.percentage).toBe(50);
    });

    it('should return null when no metrics', () => {
      const latest = collector.getLatestMetrics();
      expect(latest).toBeNull();
    });
  });

  describe('Time Range Filtering', () => {
    beforeEach(() => {
      // Add metrics with different timestamps
      const now = Date.now();
      const past = now - 1800000; // 30 minutes ago

      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].timestamp = past;

      collector.collectMetrics();
    });

    it('should filter metrics by time range', () => {
      const now = Date.now();
      const startTime = now - 3600000; // 1 hour ago
      const endTime = now;

      const filtered = collector.getMetricsByTimeRange(startTime, endTime);
      expect(filtered).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const now = Date.now();
      const startTime = now - 1000; // 1 second ago
      const endTime = now - 500; // 500ms ago

      const filtered = collector.getMetricsByTimeRange(startTime, endTime);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Aggregated Metrics', () => {
    beforeEach(() => {
      // Add multiple metrics with different values
      collector.collectMetrics();
      
      // Modify memory usage for testing
      let history = collector.getMetricsHistory();
      // Make sure we have at least 3 metrics
      while (history.length < 3) {
        collector.collectMetrics();
        history = collector.getMetricsHistory();
      }
      
      history[0].memoryUsage.percentage = 40;
      history[0].cpuUsage = 20;

      history[1].memoryUsage.percentage = 60;
      history[1].cpuUsage = 30;

      history[2].memoryUsage.percentage = 80;
      history[2].cpuUsage = 40;
    });

    it('should calculate aggregated metrics', () => {
      const aggregated = collector.getAggregatedMetrics();

      expect(aggregated.avgMemoryUsage).toBe(60); // (40 + 60 + 80) / 3
      expect(aggregated.maxMemoryUsage).toBe(80);
      expect(aggregated.minMemoryUsage).toBe(40);
      expect(aggregated.avgCpuUsage).toBe(30); // (20 + 30 + 40) / 3
      expect(aggregated.maxCpuUsage).toBe(40);
      expect(aggregated.minCpuUsage).toBe(20);
      expect(aggregated.samples).toBe(3);
    });

    it('should handle empty aggregation', () => {
      collector.clearHistory();
      const aggregated = collector.getAggregatedMetrics();

      expect(aggregated.avgMemoryUsage).toBe(0);
      expect(aggregated.maxMemoryUsage).toBe(0);
      expect(aggregated.samples).toBe(0);
    });
  });

  describe('System Info', () => {
    it('should return system information', () => {
      const systemInfo = collector.getSystemInfo();

      expect(systemInfo.platform).toBeDefined();
      expect(systemInfo.arch).toBeDefined();
      expect(systemInfo.nodeVersion).toBeDefined();
      expect(systemInfo.totalMemory).toBeGreaterThan(0);
      expect(systemInfo.freeMemory).toBeGreaterThan(0);
      expect(systemInfo.cpuCount).toBeGreaterThan(0);
      expect(Array.isArray(systemInfo.loadAverage)).toBe(true);
    });
  });

  describe('Trends', () => {
    beforeEach(() => {
      const _now = Date.now();
      const timestamps = [
        _now - 2000, // 2 seconds ago
        _now - 1000, // 1 second ago
        _now,        // now
      ];

      collector.collectMetrics();
      collector.collectMetrics();
      collector.collectMetrics();

      const history = collector.getMetricsHistory();
      history.forEach((metric, index) => {
        metric.timestamp = timestamps[index];
        metric.memoryUsage.percentage = 40 + index * 20; // 40%, 60%, 80%
        metric.cpuUsage = 20 + index * 10; // 20%, 30%, 40%
      });
    });

    it('should get memory trend', () => {
      const trend = collector.getMemoryTrend();

      expect(trend).toHaveLength(3);
      expect(trend[0].memoryUsage).toBe(80); // Most recent
      expect(trend[1].memoryUsage).toBe(60);
      expect(trend[2].memoryUsage).toBe(40);
    });

    it('should get CPU trend', () => {
      const trend = collector.getCPUTrend();

      expect(trend).toHaveLength(3);
      expect(trend[0].cpuUsage).toBe(40); // Most recent
      expect(trend[1].cpuUsage).toBe(30);
      expect(trend[2].cpuUsage).toBe(20);
    });

    it('should filter trends by time range', () => {
      const trend = collector.getMemoryTrend(1500); // Last 1.5 seconds

      expect(trend).toHaveLength(2); // Only the last 2 data points
    });
  });

  describe('Alerts', () => {
    it('should generate critical memory alert', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].memoryUsage.percentage = 95;
      history[0].cpuUsage = 10; // Normal CPU usage

      const alerts = collector.getAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('memory');
      expect(alerts[0].level).toBe('critical');
      expect(alerts[0].message).toContain('critically high');
      expect(alerts[0].value).toBe(95);
    });

    it('should generate warning memory alert', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].memoryUsage.percentage = 85;
      history[0].cpuUsage = 10; // Normal CPU usage

      const alerts = collector.getAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('memory');
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].message).toContain('high');
    });

    it('should generate critical CPU alert', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].cpuUsage = 85;

      const alerts = collector.getAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('cpu');
      expect(alerts[0].level).toBe('critical');
      expect(alerts[0].value).toBe(85);
    });

    it('should generate warning CPU alert', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].cpuUsage = 65;

      const alerts = collector.getAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('cpu');
      expect(alerts[0].level).toBe('warning');
    });

    it('should generate multiple alerts', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].memoryUsage.percentage = 95;
      history[0].cpuUsage = 85;

      const alerts = collector.getAlerts();

      expect(alerts).toHaveLength(2);
      expect(alerts.some(a => a.type === 'memory')).toBe(true);
      expect(alerts.some(a => a.type === 'cpu')).toBe(true);
    });

    it('should return no alerts for healthy metrics', () => {
      collector.collectMetrics();
      const history = collector.getMetricsHistory();
      history[0].memoryUsage.percentage = 50;
      history[0].cpuUsage = 30;

      const alerts = collector.getAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should return no alerts when no metrics', () => {
      const alerts = collector.getAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Automatic Collection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start automatic collection', () => {
      const collectSpy = jest.spyOn(collector, 'collectMetrics');
      
      collector.startCollection();
      jest.advanceTimersByTime(1000);

      expect(collectSpy).toHaveBeenCalled();
    });

    it('should stop automatic collection', () => {
      const collectSpy = jest.spyOn(collector, 'collectMetrics');
      
      collector.startCollection();
      collector.stopCollection();
      jest.advanceTimersByTime(1000);

      expect(collectSpy).toHaveBeenCalledTimes(1); // Only the initial collection
    });

    it('should collect at specified interval', () => {
      const collectSpy = jest.spyOn(collector, 'collectMetrics');
      
      collector.startCollection();
      
      // Should collect immediately and then at intervals
      expect(collectSpy).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(1000);
      expect(collectSpy).toHaveBeenCalledTimes(2);
      
      jest.advanceTimersByTime(1000);
      expect(collectSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Clear History', () => {
    it('should clear all metrics history', () => {
      collector.collectMetrics();
      collector.collectMetrics();

      expect(collector.getMetricsHistory()).toHaveLength(2);

      collector.clearHistory();
      expect(collector.getMetricsHistory()).toHaveLength(0);
      expect(collector.getLatestMetrics()).toBeNull();
    });
  });
});