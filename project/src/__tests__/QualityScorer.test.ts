import { describe, it, expect, beforeEach } from '@jest/globals';
import { QualityScorer, QualityScore } from '../analysis/QualityScorer';
import { QualityMetrics } from '../analysis/QualityMetricsCalculator';
import { TechnicalDebtAnalysis } from '../analysis/TechnicalDebtAnalyzer';

describe('QualityScorer Tests', () => {
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
  });

  describe('Basic Quality Score Calculation', () => {
    it('should calculate quality score for excellent code', () => {
      const excellentMetrics: QualityMetrics = {
        linesOfCode: 150,
        complexity: 5,
        maintainability: 85,
        commentLines: 45,
        commentPercentage: 30,
        functionCount: 8,
        averageFunctionLength: 18.75,
        dependencies: ['stdlib'],
        technicalDebt: 2,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 3,
        MaintainabilityIndex: 85,
        coupling: 15,
        cohesion: 85,
        depthOfInheritance: 1,
        technicalDebtRatio: 1.5,
        codeSmells: 1,
        duplicationRatio: 2,
        securityIssues: 0,
        vulnerabilityScore: 0,
        algorithmicComplexity: 'O(n)',
        testCoverage: 95,
        testQualityScore: 90,
        overallQualityScore: 0,
        qualityGrade: 'A',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 25,
          length: 45,
          volume: 210,
          difficulty: 5,
          effort: 1050,
          time: 58,
          bugs: 0.07
        },
        lineLength: {
          average: 45,
          max: 80,
          linesOverLimit: 0
        },
        namingConventionScore: 90,
        commentQualityScore: 85,
        memoryUsage: 15,
        errorHandlingScore: 90,
        resourceManagementScore: 85
      };

      const score = scorer.calculateQualityScore(excellentMetrics);
      
      expect(score.overallScore).toBeGreaterThan(70);
      expect(score.grade).toBe('A');
      expect(score.confidence).toBeGreaterThan(70);
      expect(score.trend).toBe('stable');
    });

    it('should calculate quality score for poor code', () => {
      const poorMetrics: QualityMetrics = {
        linesOfCode: 2000,
        complexity: 25,
        maintainability: 25,
        commentLines: 20,
        commentPercentage: 1,
        functionCount: 5,
        averageFunctionLength: 400,
        dependencies: ['dep1', 'dep2', 'dep3', 'dep4', 'dep5'],
        technicalDebt: 85,
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        MaintainabilityIndex: 25,
        coupling: 75,
        cohesion: 25,
        depthOfInheritance: 6,
        technicalDebtRatio: 25,
        codeSmells: 25,
        duplicationRatio: 20,
        securityIssues: 15,
        vulnerabilityScore: 9,
        algorithmicComplexity: 'O(n³)',
        testCoverage: 15,
        testQualityScore: 20,
        overallQualityScore: 0,
        qualityGrade: 'F',
        qualityTrend: 'declining',
        HalsteadMetrics: {
          vocabulary: 150,
          length: 500,
          volume: 3500,
          difficulty: 25,
          effort: 87500,
          time: 4861,
          bugs: 1.17
        },
        lineLength: {
          average: 120,
          max: 200,
          linesOverLimit: 45
        },
        namingConventionScore: 45,
        commentQualityScore: 30,
        memoryUsage: 150,
        errorHandlingScore: 25,
        resourceManagementScore: 20
      };

      const score = scorer.calculateQualityScore(poorMetrics);
      
      expect(score.overallScore).toBeLessThan(50);
      expect(score.grade).toBe('F');
      expect(score.confidence).toBeGreaterThan(50);
    });

    it('should calculate quality score for average code', () => {
      const averageMetrics: QualityMetrics = {
        linesOfCode: 500,
        complexity: 12,
        maintainability: 65,
        commentLines: 75,
        commentPercentage: 15,
        functionCount: 15,
        averageFunctionLength: 33.33,
        dependencies: ['stdlib', 'external'],
        technicalDebt: 25,
        cyclomaticComplexity: 12,
        cognitiveComplexity: 15,
        MaintainabilityIndex: 65,
        coupling: 35,
        cohesion: 60,
        depthOfInheritance: 3,
        technicalDebtRatio: 8,
        codeSmells: 8,
        duplicationRatio: 6,
        securityIssues: 3,
        vulnerabilityScore: 4,
        algorithmicComplexity: 'O(n log n)',
        testCoverage: 65,
        testQualityScore: 70,
        overallQualityScore: 0,
        qualityGrade: 'C',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 80,
          length: 200,
          volume: 1200,
          difficulty: 12,
          effort: 14400,
          time: 800,
          bugs: 0.4
        },
        lineLength: {
          average: 65,
          max: 110,
          linesOverLimit: 8
        },
        namingConventionScore: 75,
        commentQualityScore: 70,
        memoryUsage: 45,
        errorHandlingScore: 65,
        resourceManagementScore: 60
      };

      const score = scorer.calculateQualityScore(averageMetrics);
      
      expect(score.overallScore).toBeGreaterThanOrEqual(60);
      expect(score.overallScore).toBeLessThan(80);
      expect(['B', 'C']).toContain(score.grade);
    });
  });

  describe('Score Breakdown Calculation', () => {
    it('should calculate maintainability score correctly', () => {
      const metrics: QualityMetrics = {
        linesOfCode: 100,
        complexity: 8,
        maintainability: 75,
        commentLines: 25,
        commentPercentage: 25,
        functionCount: 5,
        averageFunctionLength: 20,
        dependencies: ['stdlib'],
        technicalDebt: 5,
        cyclomaticComplexity: 8,
        cognitiveComplexity: 10,
        MaintainabilityIndex: 75,
        coupling: 20,
        cohesion: 80,
        depthOfInheritance: 2,
        technicalDebtRatio: 3,
        codeSmells: 2,
        duplicationRatio: 4,
        securityIssues: 0,
        vulnerabilityScore: 0,
        algorithmicComplexity: 'O(n)',
        testCoverage: 80,
        testQualityScore: 85,
        overallQualityScore: 0,
        qualityGrade: 'B',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 40,
          length: 80,
          volume: 420,
          difficulty: 8,
          effort: 3360,
          time: 187,
          bugs: 0.14
        },
        lineLength: {
          average: 50,
          max: 90,
          linesOverLimit: 0
        },
        namingConventionScore: 85,
        commentQualityScore: 80,
        memoryUsage: 20,
        errorHandlingScore: 80,
        resourceManagementScore: 75
      };

      const score = scorer.calculateQualityScore(metrics);
      
      expect(score.breakdown.maintainability).toBeGreaterThan(70);
      expect(score.breakdown.maintainability).toBeLessThanOrEqual(100);
    });

    it('should calculate complexity score correctly', () => {
      const complexMetrics: QualityMetrics = {
        linesOfCode: 300,
        complexity: 18,
        maintainability: 45,
        commentLines: 30,
        commentPercentage: 10,
        functionCount: 8,
        averageFunctionLength: 37.5,
        dependencies: ['stdlib', 'complex'],
        technicalDebt: 35,
        cyclomaticComplexity: 18,
        cognitiveComplexity: 22,
        MaintainabilityIndex: 45,
        coupling: 55,
        cohesion: 45,
        depthOfInheritance: 4,
        technicalDebtRatio: 12,
        codeSmells: 12,
        duplicationRatio: 8,
        securityIssues: 2,
        vulnerabilityScore: 3,
        algorithmicComplexity: 'O(n²)',
        testCoverage: 50,
        testQualityScore: 55,
        overallQualityScore: 0,
        qualityGrade: 'D',
        qualityTrend: 'declining',
        HalsteadMetrics: {
          vocabulary: 120,
          length: 300,
          volume: 2000,
          difficulty: 18,
          effort: 36000,
          time: 2000,
          bugs: 0.67
        },
        lineLength: {
          average: 85,
          max: 140,
          linesOverLimit: 15
        },
        namingConventionScore: 65,
        commentQualityScore: 50,
        memoryUsage: 60,
        errorHandlingScore: 55,
        resourceManagementScore: 50
      };

      const score = scorer.calculateQualityScore(complexMetrics);
      
      expect(score.breakdown.complexity).toBeLessThan(60);
    });

    it('should calculate security score correctly', () => {
      const insecureMetrics: QualityMetrics = {
        linesOfCode: 200,
        complexity: 10,
        maintainability: 60,
        commentLines: 20,
        commentPercentage: 10,
        functionCount: 6,
        averageFunctionLength: 33.33,
        dependencies: ['stdlib'],
        technicalDebt: 20,
        cyclomaticComplexity: 10,
        cognitiveComplexity: 12,
        MaintainabilityIndex: 60,
        coupling: 30,
        cohesion: 65,
        depthOfInheritance: 2,
        technicalDebtRatio: 8,
        codeSmells: 6,
        duplicationRatio: 5,
        securityIssues: 8,
        vulnerabilityScore: 7,
        algorithmicComplexity: 'O(n)',
        testCoverage: 60,
        testQualityScore: 65,
        overallQualityScore: 0,
        qualityGrade: 'C',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 70,
          length: 150,
          volume: 900,
          difficulty: 10,
          effort: 9000,
          time: 500,
          bugs: 0.3
        },
        lineLength: {
          average: 60,
          max: 100,
          linesOverLimit: 5
        },
        namingConventionScore: 70,
        commentQualityScore: 60,
        memoryUsage: 35,
        errorHandlingScore: 60,
        resourceManagementScore: 55
      };

      const score = scorer.calculateQualityScore(insecureMetrics);
      
      expect(score.breakdown.security).toBeLessThan(60);
    });

    it('should calculate performance score correctly', () => {
      const slowMetrics: QualityMetrics = {
        linesOfCode: 800,
        complexity: 15,
        maintainability: 55,
        commentLines: 80,
        commentPercentage: 10,
        functionCount: 10,
        averageFunctionLength: 80,
        dependencies: ['stdlib', 'data'],
        technicalDebt: 30,
        cyclomaticComplexity: 15,
        cognitiveComplexity: 18,
        MaintainabilityIndex: 55,
        coupling: 40,
        cohesion: 60,
        depthOfInheritance: 3,
        technicalDebtRatio: 10,
        codeSmells: 10,
        duplicationRatio: 12,
        securityIssues: 1,
        vulnerabilityScore: 2,
        algorithmicComplexity: 'O(n³)',
        testCoverage: 70,
        testQualityScore: 75,
        overallQualityScore: 0,
        qualityGrade: 'C',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 100,
          length: 400,
          volume: 2500,
          difficulty: 15,
          effort: 37500,
          time: 2083,
          bugs: 0.83
        },
        lineLength: {
          average: 75,
          max: 120,
          linesOverLimit: 20
        },
        namingConventionScore: 75,
        commentQualityScore: 65,
        memoryUsage: 120,
        errorHandlingScore: 65,
        resourceManagementScore: 60
      };

      const score = scorer.calculateQualityScore(slowMetrics);
      
      expect(score.breakdown.performance).toBeLessThan(60);
    });
  });

  describe('Grade Calculation', () => {
    it('should assign grade A for scores >= 90', () => {
      const score = scorer.calculateQualityScore(createMetricsWithScore(95));
      expect(score.grade).toBe('A');
    });

    it('should assign grade B for scores >= 80', () => {
      const score = scorer.calculateQualityScore(createMetricsWithScore(85));
      expect(score.grade).toBe('A');
    });

    it('should assign grade C for scores >= 70', () => {
      const score = scorer.calculateQualityScore(createMetricsWithScore(75));
      expect(score.grade).toBe('C');
    });

    it('should assign grade D for scores >= 60', () => {
      const score = scorer.calculateQualityScore(createMetricsWithScore(65));
      expect(score.grade).toBe('D');
    });

    it('should assign grade F for scores < 60', () => {
      const score = scorer.calculateQualityScore(createMetricsWithScore(55));
      expect(score.grade).toBe('F');
    });
  });

  describe('Trend Analysis', () => {
    it('should detect improving trend', () => {
      const previousScore: QualityScore = {
        overallScore: 70,
        grade: 'C',
        breakdown: {
          maintainability: 70,
          complexity: 70,
          security: 70,
          performance: 70,
          reliability: 70,
          testability: 70,
          documentation: 70
        },
        weightedScore: 70,
        confidence: 80,
        benchmark: {
          industry: 72,
          project: 75,
          team: 78
        },
        trend: 'stable',
        recommendations: [],
        nextSteps: []
      };

      const currentScore = scorer.calculateQualityScore(createMetricsWithScore(80), undefined, previousScore);
      expect(currentScore.trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      const previousScore: QualityScore = {
        overallScore: 80,
        grade: 'B',
        breakdown: {
          maintainability: 80,
          complexity: 80,
          security: 80,
          performance: 80,
          reliability: 80,
          testability: 80,
          documentation: 80
        },
        weightedScore: 80,
        confidence: 80,
        benchmark: {
          industry: 72,
          project: 75,
          team: 78
        },
        trend: 'stable',
        recommendations: [],
        nextSteps: []
      };

      const currentScore = scorer.calculateQualityScore(createMetricsWithScore(70), undefined, previousScore);
      expect(currentScore.trend).toBe('declining');
    });

    it('should detect stable trend for small changes', () => {
      const previousScore: QualityScore = {
        overallScore: 75,
        grade: 'C',
        breakdown: {
          maintainability: 75,
          complexity: 75,
          security: 75,
          performance: 75,
          reliability: 75,
          testability: 75,
          documentation: 75
        },
        weightedScore: 75,
        confidence: 80,
        benchmark: {
          industry: 72,
          project: 75,
          team: 78
        },
        trend: 'stable',
        recommendations: [],
        nextSteps: []
      };

      const currentScore = scorer.calculateQualityScore(createMetricsWithScore(75), undefined, previousScore);
      expect(currentScore.trend).toBe('stable');
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate high confidence for complete metrics', () => {
      const completeMetrics: QualityMetrics = {
        linesOfCode: 200,
        complexity: 8,
        maintainability: 80,
        commentLines: 50,
        commentPercentage: 25,
        functionCount: 8,
        averageFunctionLength: 25,
        dependencies: ['stdlib'],
        technicalDebt: 5,
        cyclomaticComplexity: 8,
        cognitiveComplexity: 10,
        MaintainabilityIndex: 80,
        coupling: 20,
        cohesion: 80,
        depthOfInheritance: 2,
        technicalDebtRatio: 3,
        codeSmells: 2,
        duplicationRatio: 4,
        securityIssues: 0,
        vulnerabilityScore: 0,
        algorithmicComplexity: 'O(n)',
        testCoverage: 85,
        testQualityScore: 80,
        overallQualityScore: 0,
        qualityGrade: 'B',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 50,
          length: 100,
          volume: 550,
          difficulty: 8,
          effort: 4400,
          time: 244,
          bugs: 0.18
        },
        lineLength: {
          average: 55,
          max: 95,
          linesOverLimit: 0
        },
        namingConventionScore: 85,
        commentQualityScore: 80,
        memoryUsage: 25,
        errorHandlingScore: 85,
        resourceManagementScore: 80
      };

      const score = scorer.calculateQualityScore(completeMetrics);
      expect(score.confidence).toBeGreaterThan(70);
    });

    it('should calculate lower confidence for incomplete metrics', () => {
      const incompleteMetrics: QualityMetrics = {
        linesOfCode: 30,
        complexity: 5,
        maintainability: 70,
        commentLines: 5,
        commentPercentage: 16.67,
        functionCount: 2,
        averageFunctionLength: 15,
        dependencies: ['stdlib'],
        technicalDebt: 3,
        cyclomaticComplexity: 0, // Missing
        cognitiveComplexity: 0, // Missing
        MaintainabilityIndex: 0, // Missing
        coupling: 15,
        cohesion: 75,
        depthOfInheritance: 1,
        technicalDebtRatio: 2,
        codeSmells: 1,
        duplicationRatio: 3,
        securityIssues: 0,
        vulnerabilityScore: 0,
        algorithmicComplexity: 'O(1)',
        testCoverage: 70,
        testQualityScore: 75,
        overallQualityScore: 0,
        qualityGrade: 'B',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 20,
          length: 30,
          volume: 130,
          difficulty: 5,
          effort: 650,
          time: 36,
          bugs: 0.04
        },
        lineLength: {
          average: 40,
          max: 70,
          linesOverLimit: 0
        },
        namingConventionScore: 80,
        commentQualityScore: 75,
        memoryUsage: 10,
        errorHandlingScore: 75,
        resourceManagementScore: 70
      };

      const score = scorer.calculateQualityScore(incompleteMetrics);
      expect(score.confidence).toBeLessThan(70);
    });
  });

  describe('Quality Report Generation', () => {
    it('should generate comprehensive quality report', () => {
      const metrics: QualityMetrics = {
        linesOfCode: 300,
        complexity: 12,
        maintainability: 70,
        commentLines: 60,
        commentPercentage: 20,
        functionCount: 10,
        averageFunctionLength: 30,
        dependencies: ['stdlib', 'utils'],
        technicalDebt: 15,
        cyclomaticComplexity: 12,
        cognitiveComplexity: 15,
        MaintainabilityIndex: 70,
        coupling: 30,
        cohesion: 70,
        depthOfInheritance: 2,
        technicalDebtRatio: 6,
        codeSmells: 5,
        duplicationRatio: 4,
        securityIssues: 2,
        vulnerabilityScore: 3,
        algorithmicComplexity: 'O(n log n)',
        testCoverage: 75,
        testQualityScore: 80,
        overallQualityScore: 0,
        qualityGrade: 'C',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 80,
          length: 180,
          volume: 1080,
          difficulty: 12,
          effort: 12960,
          time: 720,
          bugs: 0.36
        },
        lineLength: {
          average: 65,
          max: 105,
          linesOverLimit: 3
        },
        namingConventionScore: 80,
        commentQualityScore: 75,
        memoryUsage: 40,
        errorHandlingScore: 75,
        resourceManagementScore: 70
      };

      const score = scorer.calculateQualityScore(metrics);
      const report = scorer.generateQualityReport(score, metrics);

      expect(report.summary.overallScore).toBe(score.overallScore);
      expect(report.summary.grade).toBe(score.grade);
      expect(report.summary.trend).toBe(score.trend);
      expect(report.breakdown).toEqual(score.breakdown);
      expect(report.metrics).toEqual(metrics);
      expect(report.recommendations).toBeDefined();
      expect(report.nextSteps).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextSteps)).toBe(true);
    });

    it('should include debt analysis in report when provided', () => {
      const metrics: QualityMetrics = {
        linesOfCode: 200,
        complexity: 10,
        maintainability: 65,
        commentLines: 30,
        commentPercentage: 15,
        functionCount: 6,
        averageFunctionLength: 33.33,
        dependencies: ['stdlib'],
        technicalDebt: 20,
        cyclomaticComplexity: 10,
        cognitiveComplexity: 12,
        MaintainabilityIndex: 65,
        coupling: 35,
        cohesion: 65,
        depthOfInheritance: 2,
        technicalDebtRatio: 8,
        codeSmells: 6,
        duplicationRatio: 5,
        securityIssues: 3,
        vulnerabilityScore: 4,
        algorithmicComplexity: 'O(n)',
        testCoverage: 65,
        testQualityScore: 70,
        overallQualityScore: 0,
        qualityGrade: 'C',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 60,
          length: 120,
          volume: 700,
          difficulty: 10,
          effort: 7000,
          time: 389,
          bugs: 0.23
        },
        lineLength: {
          average: 60,
          max: 100,
          linesOverLimit: 2
        },
        namingConventionScore: 75,
        commentQualityScore: 70,
        memoryUsage: 30,
        errorHandlingScore: 70,
        resourceManagementScore: 65
      };

      const debtAnalysis: TechnicalDebtAnalysis = {
        totalDebt: 500,
        debtItems: [],
        debtByCategory: {
          codeSmells: 3,
          designIssues: 2,
          bugs: 1,
          vulnerabilities: 1,
          performanceIssues: 1
        },
        debtBySeverity: {
          low: 3,
          medium: 3,
          high: 2,
          critical: 0
        },
        debtRatio: 8,
        estimatedPayoffTime: 2.5,
        monthlyInterest: 35,
        priorityItems: [],
        recommendations: [],
        riskAssessment: {
          overall: 'medium',
          maintainability: 'medium',
          performance: 'low',
          security: 'medium',
          reliability: 'low'
        }
      };

      const score = scorer.calculateQualityScore(metrics, debtAnalysis);
      const report = scorer.generateQualityReport(score, metrics, debtAnalysis);

      expect(report.debtAnalysis).toBeDefined();
      expect(report.debtAnalysis).toEqual(debtAnalysis);
    });
  });

  describe('Score Comparison', () => {
    it('should compare multiple quality scores', () => {
      const scores: QualityScore[] = [
        {
          overallScore: 70,
          grade: 'C',
          breakdown: {
            maintainability: 70,
            complexity: 70,
            security: 70,
            performance: 70,
            reliability: 70,
            testability: 70,
            documentation: 70
          },
          weightedScore: 70,
          confidence: 80,
          benchmark: {
            industry: 72,
            project: 75,
            team: 78
          },
          trend: 'stable',
          recommendations: [],
          nextSteps: []
        },
        {
          overallScore: 80,
          grade: 'B',
          breakdown: {
            maintainability: 80,
            complexity: 80,
            security: 80,
            performance: 80,
            reliability: 80,
            testability: 80,
            documentation: 80
          },
          weightedScore: 80,
          confidence: 85,
          benchmark: {
            industry: 72,
            project: 75,
            team: 78
          },
          trend: 'improving',
          recommendations: [],
          nextSteps: []
        },
        {
          overallScore: 85,
          grade: 'B',
          breakdown: {
            maintainability: 85,
            complexity: 85,
            security: 85,
            performance: 85,
            reliability: 85,
            testability: 85,
            documentation: 85
          },
          weightedScore: 85,
          confidence: 90,
          benchmark: {
            industry: 72,
            project: 75,
            team: 78
          },
          trend: 'improving',
          recommendations: [],
          nextSteps: []
        }
      ];

      const comparison = scorer.compareQualityScores(scores);

      expect(comparison.comparison).toHaveLength(3);
      expect(comparison.trend).toBe('improving');
      expect(comparison.average).toBeCloseTo(78.33, 1);
      expect(comparison.best).toBe(85);
      expect(comparison.worst).toBe(70);
    });

    it('should handle empty score array', () => {
      const comparison = scorer.compareQualityScores([]);

      expect(comparison.comparison).toHaveLength(0);
      expect(comparison.trend).toBe('stable');
      expect(comparison.average).toBe(0);
      expect(comparison.best).toBe(0);
      expect(comparison.worst).toBe(0);
    });

    it('should handle single score array', () => {
      const scores: QualityScore[] = [{
        overallScore: 75,
        grade: 'C',
        breakdown: {
          maintainability: 75,
          complexity: 75,
          security: 75,
          performance: 75,
          reliability: 75,
          testability: 75,
          documentation: 75
        },
        weightedScore: 75,
        confidence: 80,
        benchmark: {
          industry: 72,
          project: 75,
          team: 78
        },
        trend: 'stable',
        recommendations: [],
        nextSteps: []
      }];

      const comparison = scorer.compareQualityScores(scores);

      expect(comparison.comparison).toHaveLength(1);
      expect(comparison.trend).toBe('stable');
      expect(comparison.average).toBe(75);
      expect(comparison.best).toBe(75);
      expect(comparison.worst).toBe(75);
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate relevant recommendations for poor scores', () => {
      const poorMetrics: QualityMetrics = {
        linesOfCode: 1000,
        complexity: 20,
        maintainability: 40,
        commentLines: 50,
        commentPercentage: 5,
        functionCount: 8,
        averageFunctionLength: 125,
        dependencies: ['dep1', 'dep2', 'dep3', 'dep4'],
        technicalDebt: 50,
        cyclomaticComplexity: 20,
        cognitiveComplexity: 25,
        MaintainabilityIndex: 40,
        coupling: 60,
        cohesion: 40,
        depthOfInheritance: 5,
        technicalDebtRatio: 15,
        codeSmells: 15,
        duplicationRatio: 12,
        securityIssues: 8,
        vulnerabilityScore: 7,
        algorithmicComplexity: 'O(n²)',
        testCoverage: 30,
        testQualityScore: 35,
        overallQualityScore: 0,
        qualityGrade: 'F',
        qualityTrend: 'declining',
        HalsteadMetrics: {
          vocabulary: 120,
          length: 350,
          volume: 2300,
          difficulty: 20,
          effort: 46000,
          time: 2556,
          bugs: 0.77
        },
        lineLength: {
          average: 90,
          max: 150,
          linesOverLimit: 25
        },
        namingConventionScore: 55,
        commentQualityScore: 40,
        memoryUsage: 80,
        errorHandlingScore: 45,
        resourceManagementScore: 40
      };

      const score = scorer.calculateQualityScore(poorMetrics);
      
      expect(score.recommendations.length).toBeGreaterThan(0);
      expect(score.nextSteps.length).toBeGreaterThan(0);
      
      // Check that recommendations contain relevant areas
      const recommendationsText = score.recommendations.join(' ');
      expect(recommendationsText).toMatch(/maintainability|complexity|security|performance/i);
    });

    it('should generate minimal recommendations for excellent scores', () => {
      const excellentMetrics: QualityMetrics = {
        linesOfCode: 150,
        complexity: 5,
        maintainability: 90,
        commentLines: 45,
        commentPercentage: 30,
        functionCount: 8,
        averageFunctionLength: 18.75,
        dependencies: ['stdlib'],
        technicalDebt: 2,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 3,
        MaintainabilityIndex: 90,
        coupling: 15,
        cohesion: 90,
        depthOfInheritance: 1,
        technicalDebtRatio: 1.5,
        codeSmells: 1,
        duplicationRatio: 2,
        securityIssues: 0,
        vulnerabilityScore: 0,
        algorithmicComplexity: 'O(n)',
        testCoverage: 95,
        testQualityScore: 95,
        overallQualityScore: 0,
        qualityGrade: 'A',
        qualityTrend: 'improving',
        HalsteadMetrics: {
          vocabulary: 30,
          length: 60,
          volume: 295,
          difficulty: 5,
          effort: 1475,
          time: 82,
          bugs: 0.1
        },
        lineLength: {
          average: 45,
          max: 80,
          linesOverLimit: 0
        },
        namingConventionScore: 95,
        commentQualityScore: 90,
        memoryUsage: 15,
        errorHandlingScore: 95,
        resourceManagementScore: 90
      };

      const score = scorer.calculateQualityScore(excellentMetrics);
      
      // Excellent code should have fewer recommendations
      expect(score.recommendations.length).toBeLessThanOrEqual(3);
      expect(score.nextSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or minimal metrics', () => {
      const minimalMetrics: QualityMetrics = {
        linesOfCode: 10,
        complexity: 1,
        maintainability: 100,
        commentLines: 0,
        commentPercentage: 0,
        functionCount: 1,
        averageFunctionLength: 10,
        dependencies: [],
        technicalDebt: 0,
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        MaintainabilityIndex: 100,
        coupling: 0,
        cohesion: 100,
        depthOfInheritance: 0,
        technicalDebtRatio: 0,
        codeSmells: 0,
        duplicationRatio: 0,
        securityIssues: 0,
        vulnerabilityScore: 0,
        algorithmicComplexity: 'O(1)',
        testCoverage: 0,
        testQualityScore: 0,
        overallQualityScore: 0,
        qualityGrade: 'A',
        qualityTrend: 'stable',
        HalsteadMetrics: {
          vocabulary: 5,
          length: 8,
          volume: 18,
          difficulty: 1,
          effort: 18,
          time: 1,
          bugs: 0.01
        },
        lineLength: {
          average: 20,
          max: 30,
          linesOverLimit: 0
        },
        namingConventionScore: 100,
        commentQualityScore: 0,
        memoryUsage: 0,
        errorHandlingScore: 100,
        resourceManagementScore: 100
      };

      const score = scorer.calculateQualityScore(minimalMetrics);
      
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
      expect(score.grade).toBeDefined();
      expect(score.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle extreme values gracefully', () => {
      const extremeMetrics: QualityMetrics = {
        linesOfCode: 10000,
        complexity: 100,
        maintainability: 0,
        commentLines: 0,
        commentPercentage: 0,
        functionCount: 2,
        averageFunctionLength: 5000,
        dependencies: Array(50).fill('dep'),
        technicalDebt: 1000,
        cyclomaticComplexity: 100,
        cognitiveComplexity: 200,
        MaintainabilityIndex: 0,
        coupling: 100,
        cohesion: 0,
        depthOfInheritance: 20,
        technicalDebtRatio: 100,
        codeSmells: 100,
        duplicationRatio: 100,
        securityIssues: 100,
        vulnerabilityScore: 10,
        algorithmicComplexity: 'O(n!)',
        testCoverage: 0,
        testQualityScore: 0,
        overallQualityScore: 0,
        qualityGrade: 'F',
        qualityTrend: 'declining',
        HalsteadMetrics: {
          vocabulary: 1000,
          length: 5000,
          volume: 50000,
          difficulty: 100,
          effort: 5000000,
          time: 277778,
          bugs: 16.67
        },
        lineLength: {
          average: 200,
          max: 500,
          linesOverLimit: 200
        },
        namingConventionScore: 0,
        commentQualityScore: 0,
        memoryUsage: 1000,
        errorHandlingScore: 0,
        resourceManagementScore: 0
      };

      const score = scorer.calculateQualityScore(extremeMetrics);
      
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
      expect(score.grade).toBe('F');
    });
  });
});

// Helper function to create metrics with specific target score
function createMetricsWithScore(targetScore: number): QualityMetrics {
  // Create metrics that should result in approximately the target score
  return {
    linesOfCode: 200,
    complexity: Math.max(1, Math.round(25 - (targetScore * 0.2))),
    maintainability: targetScore,
    commentLines: Math.round(targetScore * 0.5),
    commentPercentage: Math.round(targetScore * 0.25),
    functionCount: 8,
    averageFunctionLength: 25,
    dependencies: ['stdlib'],
    technicalDebt: Math.max(0, Math.round(50 - (targetScore * 0.5))),
    cyclomaticComplexity: Math.max(1, Math.round(30 - (targetScore * 0.25))),
    cognitiveComplexity: Math.max(1, Math.round(35 - (targetScore * 0.3))),
    MaintainabilityIndex: targetScore,
    coupling: Math.max(5, Math.round(70 - (targetScore * 0.6))),
    cohesion: Math.min(100, Math.max(20, targetScore)),
    depthOfInheritance: Math.max(1, Math.round(8 - (targetScore * 0.07))),
    technicalDebtRatio: Math.max(0, Math.round(20 - (targetScore * 0.15))),
    codeSmells: Math.max(0, Math.round(15 - (targetScore * 0.12))),
    duplicationRatio: Math.max(0, Math.round(12 - (targetScore * 0.1))),
    securityIssues: Math.max(0, Math.round(8 - (targetScore * 0.08))),
    vulnerabilityScore: Math.max(0, Math.round(12 - (targetScore * 0.1))),
    algorithmicComplexity: targetScore >= 85 ? 'O(n)' : targetScore >= 70 ? 'O(n log n)' : targetScore >= 55 ? 'O(n²)' : 'O(n³)',
    testCoverage: targetScore,
    testQualityScore: targetScore,
    overallQualityScore: 0,
    qualityGrade: targetScore >= 90 ? 'A' : targetScore >= 80 ? 'B' : targetScore >= 70 ? 'C' : targetScore >= 60 ? 'D' : 'F',
    qualityTrend: 'stable',
    HalsteadMetrics: {
      vocabulary: Math.max(10, Math.round(100 - (targetScore * 0.8))),
      length: Math.max(20, Math.round(200 - (targetScore * 1.5))),
      volume: Math.max(50, Math.round(1200 - (targetScore * 10))),
      difficulty: Math.max(1, Math.round(20 - (targetScore * 0.15))),
      effort: Math.max(100, Math.round(20000 - (targetScore * 180))),
      time: Math.max(10, Math.round(1200 - (targetScore * 10))),
      bugs: Math.max(0.01, Math.round((20 - (targetScore * 0.15)) * 100) / 100)
    },
    lineLength: {
      average: Math.max(20, Math.round(100 - (targetScore * 0.7))),
      max: Math.max(30, Math.round(150 - (targetScore * 1.2))),
      linesOverLimit: Math.max(0, Math.round(15 - (targetScore * 0.12)))
    },
    namingConventionScore: targetScore,
    commentQualityScore: targetScore,
    memoryUsage: Math.max(0, Math.round(80 - (targetScore * 0.7))),
    errorHandlingScore: targetScore,
    resourceManagementScore: targetScore
  };
}