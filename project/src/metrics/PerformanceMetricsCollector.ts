import { PerformanceMetrics } from './types';
import * as os from 'os';

export class PerformanceMetricsCollector {
  private metrics: PerformanceMetrics[] = [];
  private maxHistorySize: number = 1000;
  private collectionInterval: number = 5000; // 5 seconds
  private intervalId?: NodeJS.Timeout;
  private startTime: number = Date.now();

  constructor(maxHistorySize: number = 1000, collectionInterval: number = 5000) {
    this.maxHistorySize = maxHistorySize;
    this.collectionInterval = collectionInterval;
  }

  startCollection(): void {
    if (this.intervalId) {
      this.stopCollection();
    }

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.collectionInterval);

    // Collect initial metrics
    this.collectMetrics();
  }

  stopCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as unknown as NodeJS.Timeout;
    }
  }

  collectMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = Date.now() - this.startTime;

    const metrics: PerformanceMetrics = {
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpuUsage: this.calculateCPUPercentage(cpuUsage),
      uptime,
      timestamp: Date.now(),
    };

    this.metrics.push(metrics);

    // Maintain history size
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.maxHistorySize);
    }

    return metrics;
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    const history = this.metrics.slice().reverse();
    return limit ? history.slice(0, limit) : history;
  }

  getMetricsByTimeRange(startTime: number, endTime: number): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.timestamp >= startTime && metric.timestamp <= endTime);
  }

  getAggregatedMetrics(timeRange: number = 3600000): {
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    minMemoryUsage: number;
    avgCpuUsage: number;
    maxCpuUsage: number;
    minCpuUsage: number;
    avgUptime: number;
    samples: number;
    timeRange: number;
  } {
    const now = Date.now();
    const startTime = now - timeRange;
    const relevantMetrics = this.metrics.filter(metric => metric.timestamp >= startTime);

    if (relevantMetrics.length === 0) {
      return {
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        minMemoryUsage: 0,
        avgCpuUsage: 0,
        maxCpuUsage: 0,
        minCpuUsage: 0,
        avgUptime: 0,
        samples: 0,
        timeRange,
      };
    }

    const memoryUsages = relevantMetrics.map(m => m.memoryUsage.percentage);
    const cpuUsages = relevantMetrics.map(m => m.cpuUsage);
    const uptimes = relevantMetrics.map(m => m.uptime);

    return {
      avgMemoryUsage: memoryUsages.reduce((sum, val) => sum + val, 0) / memoryUsages.length,
      maxMemoryUsage: Math.max(...memoryUsages),
      minMemoryUsage: Math.min(...memoryUsages),
      avgCpuUsage: cpuUsages.reduce((sum, val) => sum + val, 0) / cpuUsages.length,
      maxCpuUsage: Math.max(...cpuUsages),
      minCpuUsage: Math.min(...cpuUsages),
      avgUptime: uptimes.reduce((sum, val) => sum + val, 0) / uptimes.length,
      samples: relevantMetrics.length,
      timeRange,
    };
  }

  getSystemInfo(): {
    platform: string;
    arch: string;
    nodeVersion: string;
    totalMemory: number;
    freeMemory: number;
    cpuCount: number;
    loadAverage: number[];
  } {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
    };
  }

  getMemoryTrend(timeRange: number = 3600000): Array<{ timestamp: number; memoryUsage: number }> {
    const now = Date.now();
    const startTime = now - timeRange;
    const relevantMetrics = this.metrics.filter(metric => metric.timestamp >= startTime);

    return relevantMetrics.map(metric => ({
      timestamp: metric.timestamp,
      memoryUsage: metric.memoryUsage.percentage,
    }));
  }

  getCPUTrend(timeRange: number = 3600000): Array<{ timestamp: number; cpuUsage: number }> {
    const now = Date.now();
    const startTime = now - timeRange;
    const relevantMetrics = this.metrics.filter(metric => metric.timestamp >= startTime);

    return relevantMetrics.map(metric => ({
      timestamp: metric.timestamp,
      cpuUsage: metric.cpuUsage,
    }));
  }

  getAlerts(): Array<{
    type: 'memory' | 'cpu';
    level: 'warning' | 'critical';
    message: string;
    timestamp: number;
    value: number;
  }> {
    const alerts: Array<{
      type: 'memory' | 'cpu';
      level: 'warning' | 'critical';
      message: string;
      timestamp: number;
      value: number;
    }> = [];

    const latest = this.getLatestMetrics();
    if (!latest) return alerts;

    // Memory alerts
    if (latest.memoryUsage.percentage > 90) {
      alerts.push({
        type: 'memory',
        level: 'critical',
        message: `Memory usage critically high: ${latest.memoryUsage.percentage.toFixed(2)}%`,
        timestamp: latest.timestamp,
        value: latest.memoryUsage.percentage,
      });
    } else if (latest.memoryUsage.percentage > 80) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `Memory usage high: ${latest.memoryUsage.percentage.toFixed(2)}%`,
        timestamp: latest.timestamp,
        value: latest.memoryUsage.percentage,
      });
    }

    // CPU alerts
    if (latest.cpuUsage > 80) {
      alerts.push({
        type: 'cpu',
        level: 'critical',
        message: `CPU usage critically high: ${latest.cpuUsage.toFixed(2)}%`,
        timestamp: latest.timestamp,
        value: latest.cpuUsage,
      });
    } else if (latest.cpuUsage > 60) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `CPU usage high: ${latest.cpuUsage.toFixed(2)}%`,
        timestamp: latest.timestamp,
        value: latest.cpuUsage,
      });
    }

    return alerts;
  }

  clearHistory(): void {
    this.metrics = [];
  }

  private calculateCPUPercentage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified CPU usage calculation
    // In a real implementation, you'd track CPU usage over time
    const totalTicks = cpuUsage.user + cpuUsage.system;
    const elapsed = Date.now() - this.startTime;
    
    // Convert to percentage (rough approximation)
    return Math.min(100, (totalTicks / elapsed) * 100);
  }
}