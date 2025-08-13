import { describe, it, expect, beforeEach } from '@jest/globals'
import { CoverageAnalyzer } from '../testing/CoverageAnalyzer'

describe('CoverageAnalyzer', () => {
  let analyzer: CoverageAnalyzer

  beforeEach(() => {
    analyzer = new CoverageAnalyzer({})
  })

  describe('Coverage Analysis', () => {
    it('should analyze coverage with HTML format', async () => {
      const result = await analyzer.analyzeCoverage('/project', 'html', 80)

      expect(result.format).toBe('html')
      expect(result.projectPath).toBe('/project')
      expect(result.analysis).toBeDefined()
      expect(result.analysis.summary).toBeDefined()
      expect(result.analysis.summary.threshold).toBe(80)
      expect(result.htmlReport).toBeDefined()
      expect(result.generatedAt).toBeDefined()
    })

    it('should analyze coverage with JSON format', async () => {
      const result = await analyzer.analyzeCoverage('/project', 'json', 85)

      expect(result.format).toBe('json')
      expect(result.analysis.summary.threshold).toBe(85)
      expect(result.jsonReport).toBeDefined()
      expect(result.htmlReport).toBeUndefined()
      expect(result.lcovReport).toBeUndefined()
    })

    it('should analyze coverage with LCOV format', async () => {
      const result = await analyzer.analyzeCoverage('/project', 'lcov', 90)

      expect(result.format).toBe('lcov')
      expect(result.analysis.summary.threshold).toBe(90)
      expect(result.lcovReport).toBeDefined()
      expect(result.htmlReport).toBeUndefined()
      expect(result.jsonReport).toBeUndefined()
    })

    it('should use default threshold when not specified', async () => {
      const result = await analyzer.analyzeCoverage('/project', 'html')

      expect(result.analysis.summary.threshold).toBe(80)
    })

    it('should generate coverage analysis with valid structure', async () => {
      const result = await analyzer.analyzeCoverage('/project', 'html')

      expect(result.analysis.summary.totalLines).toBeGreaterThan(0)
      expect(result.analysis.summary.coveredLines).toBeGreaterThan(0)
      expect(result.analysis.summary.coveragePercentage).toBeGreaterThan(0)
      expect(result.analysis.summary.coveragePercentage).toBeLessThanOrEqual(100)
      expect(result.analysis.byFile).toBeDefined()
      expect(Array.isArray(result.analysis.byFile)).toBe(true)
      expect(result.analysis.byFunction).toBeDefined()
      expect(Array.isArray(result.analysis.byFunction)).toBe(true)
      expect(result.analysis.uncoveredCode).toBeDefined()
      expect(Array.isArray(result.analysis.uncoveredCode)).toBe(true)
      expect(result.analysis.recommendations).toBeDefined()
      expect(Array.isArray(result.analysis.recommendations)).toBe(true)
    })

    it('should determine if coverage meets threshold', async () => {
      const highCoverageResult = await analyzer.analyzeCoverage('/project', 'html', 50)
      expect(highCoverageResult.analysis.summary.meetsThreshold).toBe(true)

      const lowCoverageResult = await analyzer.analyzeCoverage('/project', 'html', 95)
      expect(lowCoverageResult.analysis.summary.meetsThreshold).toBeDefined()
    })
  })

  describe('Coverage Comparison', () => {
    it('should compare two coverage analyses', async () => {
      const baseAnalysis = {
        summary: { coveragePercentage: 75 },
        byFile: [
          { filePath: 'file1.ts', coveragePercentage: 80 },
          { filePath: 'file2.ts', coveragePercentage: 70 },
        ]
      }

      const newAnalysis = {
        summary: { coveragePercentage: 85 },
        byFile: [
          { filePath: 'file1.ts', coveragePercentage: 85 },
          { filePath: 'file2.ts', coveragePercentage: 75 },
        ]
      }

      const result = await analyzer.compareCoverage(baseAnalysis as any, newAnalysis as any)

      expect(result.comparison.overallChange).toBe(10)
      expect(result.comparison.byFileChanges).toHaveLength(2)
      expect(result.comparison.improvedFiles).toContain('file1.ts')
      expect(result.comparison.improvedFiles).toContain('file2.ts')
      expect(result.comparison.degradedFiles).toHaveLength(0)
      expect(result.impact).toBeDefined()
      expect(result.impact.riskLevel).toBeDefined()
      expect(result.impact.recommendations).toBeDefined()
      expect(Array.isArray(result.impact.recommendations)).toBe(true)
    })

    it('should handle coverage regression', async () => {
      const baseAnalysis = {
        summary: { coveragePercentage: 85 },
        byFile: [
          { filePath: 'file1.ts', coveragePercentage: 90 },
        ]
      }

      const newAnalysis = {
        summary: { coveragePercentage: 75 },
        byFile: [
          { filePath: 'file1.ts', coveragePercentage: 80 },
        ]
      }

      const result = await analyzer.compareCoverage(baseAnalysis as any, newAnalysis as any)

      expect(result.comparison.overallChange).toBe(-10)
      expect(result.comparison.degradedFiles).toContain('file1.ts')
      expect(result.comparison.improvedFiles).toHaveLength(0)
    })
  })

  describe('Coverage Improvements', () => {
    it('should suggest coverage improvements', async () => {
      const analysis = {
        summary: { coveragePercentage: 65 },
        byFile: [
          { filePath: 'file1.ts', coveragePercentage: 70, complexity: 12 },
          { filePath: 'file2.ts', coveragePercentage: 60, complexity: 8 },
        ],
        uncoveredCode: [
          { filePath: 'file1.ts' },
          { filePath: 'file2.ts' },
          { filePath: 'file3.ts' },
        ]
      }

      const result = await analyzer.suggestCoverageImprovements(analysis as any)

      expect(result.priorities).toBeDefined()
      expect(Array.isArray(result.priorities)).toBe(true)
      expect(result.priorities.length).toBeGreaterThan(0)
      expect(result.quickWins).toBeDefined()
      expect(Array.isArray(result.quickWins)).toBe(true)
      expect(result.quickWins.length).toBeGreaterThan(0)

      const priority = result.priorities[0]
      expect(priority.type).toBeDefined()
      expect(priority.priority).toBeDefined()
      expect(priority.description).toBeDefined()
      expect(priority.targetFiles).toBeDefined()
      expect(Array.isArray(priority.targetFiles)).toBe(true)
      expect(priority.estimatedEffort).toBeGreaterThan(0)
      expect(priority.potentialImprovement).toBeGreaterThan(0)
    })
  })

  describe('Coverage Trends', () => {
    it('should generate coverage trends from historical data', async () => {
      const historicalData = [
        {
          summary: { coveragePercentage: 70 },
          byFile: [
            { filePath: 'file1.ts', coveragePercentage: 75 },
            { filePath: 'file2.ts', coveragePercentage: 65 },
          ]
        },
        {
          summary: { coveragePercentage: 75 },
          byFile: [
            { filePath: 'file1.ts', coveragePercentage: 80 },
            { filePath: 'file2.ts', coveragePercentage: 70 },
          ]
        },
        {
          summary: { coveragePercentage: 80 },
          byFile: [
            { filePath: 'file1.ts', coveragePercentage: 85 },
            { filePath: 'file2.ts', coveragePercentage: 75 },
          ]
        }
      ]

      const result = await analyzer.generateCoverageTrends(historicalData as any)

      expect(result.trends).toBeDefined()
      expect(result.trends.overall).toBeDefined()
      expect(Array.isArray(result.trends.overall)).toBe(true)
      expect(result.trends.overall).toHaveLength(3)
      expect(result.trends.byFile).toBeDefined()
      expect(Array.isArray(result.trends.byFile)).toBe(true)
      expect(result.insights).toBeDefined()
      expect(result.insights.improving).toBeDefined()
      expect(result.insights.declining).toBeDefined()
      expect(result.insights.stable).toBeDefined()
      expect(result.insights.recommendations).toBeDefined()
      expect(Array.isArray(result.insights.recommendations)).toBe(true)
      expect(result.projections).toBeDefined()
      expect(result.projections.targetDate).toBeDefined()
      expect(result.projections.projectedCoverage).toBeGreaterThan(0)
      expect(result.projections.confidence).toBeGreaterThan(0)
      expect(result.projections.confidence).toBeLessThanOrEqual(100)
    })

    it('should handle empty historical data', async () => {
      const result = await analyzer.generateCoverageTrends([])

      expect(result.trends.overall).toHaveLength(0)
      expect(result.trends.byFile).toHaveLength(0)
      expect(result.insights.improving).toHaveLength(0)
      expect(result.insights.declining).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid project path', async () => {
      const result = await analyzer.analyzeCoverage('', 'html')

      expect(result.projectPath).toBe('')
      expect(result.analysis).toBeDefined()
    })

    it('should handle invalid threshold values', async () => {
      const result = await analyzer.analyzeCoverage('/project', 'html', -10)

      expect(result.analysis.summary.threshold).toBe(-10)
      expect(result.analysis.summary.meetsThreshold).toBeDefined()
    })

    it('should handle comparison with missing files', async () => {
      const baseAnalysis = {
        summary: { coveragePercentage: 75 },
        byFile: [
          { filePath: 'file1.ts', coveragePercentage: 80 },
        ]
      }

      const newAnalysis = {
        summary: { coveragePercentage: 85 },
        byFile: [
          { filePath: 'file2.ts', coveragePercentage: 90 },
        ]
      }

      const result = await analyzer.compareCoverage(baseAnalysis as any, newAnalysis as any)

      expect(result.comparison.byFileChanges).toHaveLength(1)
      expect(result.comparison.byFileChanges[0].filePath).toBe('file1.ts')
      expect(result.comparison.byFileChanges[0].newCoverage).toBe(0)
    })
  })
})