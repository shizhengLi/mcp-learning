import { describe, it, expect, beforeEach } from '@jest/globals'
import { PerformanceTester } from '../testing/PerformanceTester'

describe('PerformanceTester', () => {
  let tester: PerformanceTester

  beforeEach(() => {
    tester = new PerformanceTester({})
  })

  describe('Performance Testing', () => {
    it('should run load testing', async () => {
      const result = await tester.runTest('https://api.example.com/users', 'load', 100, 60)

      expect(result.summary).toBeDefined()
      expect(result.summary.testType).toBe('load')
      expect(result.summary.totalRequests).toBeGreaterThan(0)
      expect(result.summary.successfulRequests).toBeGreaterThan(0)
      expect(result.summary.failedRequests).toBeGreaterThanOrEqual(0)
      expect(result.summary.averageResponseTime).toBeGreaterThan(0)
      expect(result.summary.minResponseTime).toBeGreaterThan(0)
      expect(result.summary.maxResponseTime).toBeGreaterThan(0)
      expect(result.summary.throughput).toBeGreaterThan(0)
      expect(result.summary.errorRate).toBeGreaterThanOrEqual(0)

      expect(result.percentiles).toBeDefined()
      expect(result.percentiles.p50).toBeGreaterThan(0)
      expect(result.percentiles.p90).toBeGreaterThan(0)
      expect(result.percentiles.p95).toBeGreaterThan(0)
      expect(result.percentiles.p99).toBeGreaterThan(0)
      expect(result.percentiles.p50).toBeLessThanOrEqual(result.percentiles.p90)
      expect(result.percentiles.p90).toBeLessThanOrEqual(result.percentiles.p95)
      expect(result.percentiles.p95).toBeLessThanOrEqual(result.percentiles.p99)

      expect(result.timeline).toBeDefined()
      expect(Array.isArray(result.timeline)).toBe(true)
      expect(result.timeline.length).toBe(60)

      expect(result.bottlenecks).toBeDefined()
      expect(Array.isArray(result.bottlenecks)).toBe(true)
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should run stress testing', async () => {
      const result = await tester.runTest('https://api.example.com/users', 'stress', 500, 30)

      expect(result.summary.testType).toBe('stress')
      expect(result.summary.errorRate).toBeGreaterThan(0) // Stress tests should have some errors
    })

    it('should run spike testing', async () => {
      const result = await tester.runTest('https://api.example.com/users', 'spike', 1000, 15)

      expect(result.summary.testType).toBe('spike')
    })

    it('should use default parameters', async () => {
      const result = await tester.runTest('https://api.example.com/users')

      expect(result.summary.testType).toBe('load')
      expect(result.timeline.length).toBe(60)
    })

    it('should identify performance bottlenecks', async () => {
      const result = await tester.runTest('https://api.example.com/users', 'stress', 1000, 60)

      expect(result.bottlenecks.length).toBeGreaterThan(0)
      
      const bottleneck = result.bottlenecks[0]
      expect(bottleneck.type).toBeDefined()
      expect(bottleneck.description).toBeDefined()
      expect(['high', 'medium', 'low']).toContain(bottleneck.impact)
      expect(bottleneck.recommendation).toBeDefined()
    })

    it('should generate performance recommendations', async () => {
      const result = await tester.runTest('https://api.example.com/users', 'load', 100, 60)

      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(typeof result.recommendations[0]).toBe('string')
    })
  })

  describe('Performance Profiling', () => {
    it('should profile CPU performance', async () => {
      const result = await tester.profilePerformance('src/app.ts', 'cpu', 30)

      expect(result.profileType).toBe('cpu')
      expect(result.duration).toBe(30)
      expect(result.samples).toBeGreaterThan(0)
      expect(result.hotspots).toBeDefined()
      expect(Array.isArray(result.hotspots)).toBe(true)
      expect(result.hotspots.length).toBeGreaterThan(0)
      expect(result.callGraph).toBeDefined()
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)

      const hotspot = result.hotspots[0]
      expect(hotspot.function).toBeDefined()
      expect(hotspot.file).toBeDefined()
      expect(hotspot.line).toBeGreaterThan(0)
      expect(hotspot.time).toBeGreaterThan(0)
      expect(hotspot.percentage).toBeGreaterThan(0)
      expect(hotspot.percentage).toBeLessThanOrEqual(100)
    })

    it('should profile memory performance', async () => {
      const result = await tester.profilePerformance('src/app.ts', 'memory', 30)

      expect(result.profileType).toBe('memory')
      expect(result.hotspots).toBeDefined()
    })

    it('should profile I/O performance', async () => {
      const result = await tester.profilePerformance('src/app.ts', 'io', 30)

      expect(result.profileType).toBe('io')
      expect(result.hotspots).toBeDefined()
    })

    it('should use default profile type', async () => {
      const result = await tester.profilePerformance('src/app.ts')

      expect(result.profileType).toBe('cpu')
      expect(result.duration).toBe(30)
    })

    it('should generate profile recommendations', async () => {
      const result = await tester.profilePerformance('src/app.ts', 'cpu', 30)

      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.recommendations[0]).toContain('optimization')
    })
  })

  describe('Memory Analysis', () => {
    it('should analyze memory leaks', async () => {
      const result = await tester.analyzeMemory('src/app.ts', 'leak')

      expect(result.summary).toBeDefined()
      expect(result.summary.totalMemory).toBeGreaterThan(0)
      expect(result.summary.usedMemory).toBeGreaterThan(0)
      expect(result.summary.freeMemory).toBeGreaterThan(0)
      expect(result.summary.memoryUsage).toBeGreaterThan(0)
      expect(result.summary.memoryUsage).toBeLessThanOrEqual(100)
      expect(typeof result.summary.leaksDetected).toBe('boolean')

      expect(result.heapSnapshot).toBeDefined()
      expect(result.heapSnapshot.totalSize).toBeGreaterThan(0)
      expect(result.heapSnapshot.usedSize).toBeGreaterThan(0)
      expect(result.heapSnapshot.numberOfObjects).toBeGreaterThan(0)
      expect(result.heapSnapshot.largestObjects).toBeDefined()
      expect(Array.isArray(result.heapSnapshot.largestObjects)).toBe(true)

      expect(result.timeline).toBeDefined()
      expect(Array.isArray(result.timeline)).toBe(true)
      expect(result.timeline.length).toBe(60)

      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should analyze memory usage', async () => {
      const result = await tester.analyzeMemory('src/app.ts', 'usage')

      expect(result.summary).toBeDefined()
      expect(result.recommendations).toBeDefined()
    })

    it('should analyze memory fragmentation', async () => {
      const result = await tester.analyzeMemory('src/app.ts', 'fragmentation')

      expect(result.summary).toBeDefined()
      expect(result.recommendations).toBeDefined()
    })

    it('should use default analysis type', async () => {
      const result = await tester.analyzeMemory('src/app.ts')

      expect(result.summary).toBeDefined()
    })

    it('should generate memory recommendations based on usage', async () => {
      const result = await tester.analyzeMemory('src/app.ts', 'leak')

      if (result.summary.memoryUsage > 80) {
        expect(result.recommendations.some(r => r.includes('memory leaks') || r.includes('memory usage'))).toBe(true)
      }
    })
  })

  describe('Code Benchmarking', () => {
    it('should benchmark code with default parameters', async () => {
      const result = await tester.benchmarkCode('src/utils/helpers.ts')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      const benchmark = result[0]
      expect(benchmark.functionName).toBeDefined()
      expect(benchmark.iterations).toBe(1000)
      expect(benchmark.totalTime).toBeGreaterThan(0)
      expect(benchmark.averageTime).toBeGreaterThan(0)
      expect(benchmark.minTime).toBeGreaterThan(0)
      expect(benchmark.maxTime).toBeGreaterThan(0)
      expect(benchmark.minTime).toBeLessThanOrEqual(benchmark.averageTime)
      expect(benchmark.averageTime).toBeLessThanOrEqual(benchmark.maxTime)
      expect(benchmark.standardDeviation).toBeGreaterThan(0)
      expect(benchmark.percentiles).toBeDefined()
      expect(benchmark.memoryUsage).toBeDefined()
    })

    it('should benchmark code with custom parameters', async () => {
      const result = await tester.benchmarkCode('src/utils/helpers.ts', 2000, 200)

      expect(result.length).toBeGreaterThan(0)
      result.forEach(benchmark => {
        expect(benchmark.iterations).toBe(2000)
      })
    })

    it('should calculate percentiles correctly', async () => {
      const result = await tester.benchmarkCode('src/utils/helpers.ts', 100, 10)

      const benchmark = result[0]
      expect(benchmark.percentiles.p50).toBeGreaterThan(0)
      expect(benchmark.percentiles.p90).toBeGreaterThan(0)
      expect(benchmark.percentiles.p95).toBeGreaterThan(0)
      expect(benchmark.percentiles.p99).toBeGreaterThan(0)
      expect(benchmark.percentiles.p50).toBeLessThanOrEqual(benchmark.percentiles.p90)
      expect(benchmark.percentiles.p90).toBeLessThanOrEqual(benchmark.percentiles.p95)
      expect(benchmark.percentiles.p95).toBeLessThanOrEqual(benchmark.percentiles.p99)
    })

    it('should track memory usage during benchmarking', async () => {
      const result = await tester.benchmarkCode('src/utils/helpers.ts')

      const benchmark = result[0]
      expect(benchmark.memoryUsage.before).toBeGreaterThanOrEqual(0)
      expect(benchmark.memoryUsage.after).toBeGreaterThanOrEqual(0)
      expect(typeof benchmark.memoryUsage.delta).toBe('number')
    })
  })

  describe('Performance Optimization Suggestions', () => {
    it('should suggest performance optimizations', async () => {
      const result = await tester.suggestPerformanceOptimizations('src/app.ts')

      expect(result.optimizations).toBeDefined()
      expect(Array.isArray(result.optimizations)).toBe(true)
      expect(result.optimizations.length).toBeGreaterThan(0)
      expect(result.priorityActions).toBeDefined()
      expect(Array.isArray(result.priorityActions)).toBe(true)
      expect(result.priorityActions.length).toBeGreaterThan(0)

      const optimization = result.optimizations[0]
      expect(optimization.type).toBeDefined()
      expect(optimization.description).toBeDefined()
      expect(optimization.estimatedImprovement).toBeGreaterThan(0)
      expect(['low', 'medium', 'high']).toContain(optimization.effort)
      expect(['low', 'medium', 'high']).toContain(optimization.risk)
    })

    it('should provide actionable priority actions', async () => {
      const result = await tester.suggestPerformanceOptimizations('src/app.ts')

      expect(result.priorityActions.length).toBeGreaterThan(0)
      result.priorityActions.forEach(action => {
        expect(typeof action).toBe('string')
        expect(action.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid URL', async () => {
      const result = await tester.runTest('invalid-url', 'load', 100, 60)

      expect(result.summary).toBeDefined()
      expect(result.summary.testType).toBe('load')
    })

    it('should handle invalid test type', async () => {
      const result = await tester.runTest('https://api.example.com', 'invalid' as any, 100, 60)

      expect(result.summary).toBeDefined()
      expect(result.summary.testType).toBe('invalid') // Uses the provided type
    })

    it('should handle invalid concurrent users', async () => {
      const result = await tester.runTest('https://api.example.com', 'load', -100, 60)

      expect(result.summary).toBeDefined()
    })

    it('should handle invalid duration', async () => {
      const result = await tester.runTest('https://api.example.com', 'load', 100, -60)

      expect(result.summary).toBeDefined()
      expect(result.timeline.length).toBe(0)
    })

    it('should handle empty code path', async () => {
      const result = await tester.profilePerformance('', 'cpu', 30)

      expect(result.profileType).toBe('cpu')
      expect(result.hotspots).toBeDefined()
    })

    it('should handle invalid iterations', async () => {
      const result = await tester.benchmarkCode('src/app.ts', -100, 10)

      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle invalid warmup', async () => {
      const result = await tester.benchmarkCode('src/app.ts', 100, -10)

      expect(Array.isArray(result)).toBe(true)
    })
  })
})