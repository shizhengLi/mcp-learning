import { QualityMetrics, TechnicalDebtItem, QualityRecommendation, QualityThresholds } from './QualityMetricsCalculator';
import { TechnicalDebtAnalysis } from './TechnicalDebtAnalyzer';

export interface QualityScore {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    maintainability: number;
    complexity: number;
    security: number;
    performance: number;
    reliability: number;
    testability: number;
    documentation: number;
  };
  weightedScore: number;
  confidence: number;
  benchmark: {
    industry: number;
    project: number;
    team: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  nextSteps: string[];
}

export interface QualityBenchmark {
  name: string;
  score: number;
  category: string;
  description: string;
  threshold: number;
}

export interface QualityHistory {
  date: Date;
  score: QualityScore;
  metrics: QualityMetrics;
  debtAnalysis?: TechnicalDebtAnalysis;
}

export interface QualityReport {
  summary: {
    overallScore: number;
    grade: string;
    trend: string;
    confidence: number;
  };
  breakdown: QualityScore['breakdown'];
  benchmarks: {
    industry: number;
    project: number;
    team: number;
  };
  metrics: QualityMetrics;
  debtAnalysis?: TechnicalDebtAnalysis;
  recommendations: QualityRecommendation[];
  history: QualityHistory[];
  nextSteps: string[];
}

export class QualityScorer {
  private readonly weights = {
    maintainability: 0.25,
    complexity: 0.20,
    security: 0.20,
    performance: 0.15,
    reliability: 0.10,
    testability: 0.05,
    documentation: 0.05
  };

  private readonly benchmarks: QualityBenchmark[] = [
    {
      name: 'Industry Average',
      score: 72,
      category: 'overall',
      description: 'Average quality score across all projects',
      threshold: 70
    },
    {
      name: 'High-Performance Systems',
      score: 85,
      category: 'overall',
      description: 'Quality target for high-performance systems',
      threshold: 80
    },
    {
      name: 'Critical Systems',
      score: 90,
      category: 'overall',
      description: 'Quality target for critical systems',
      threshold: 85
    },
    {
      name: 'Maintainability Target',
      score: 80,
      category: 'maintainability',
      description: 'Target maintainability score',
      threshold: 75
    },
    {
      name: 'Security Compliance',
      score: 95,
      category: 'security',
      description: 'Security compliance requirements',
      threshold: 90
    },
    {
      name: 'Performance Standards',
      score: 85,
      category: 'performance',
      description: 'Performance quality standards',
      threshold: 80
    }
  ];

  calculateQualityScore(
    metrics: QualityMetrics,
    debtAnalysis?: TechnicalDebtAnalysis,
    previousScore?: QualityScore
  ): QualityScore {
    const breakdown = this.calculateBreakdown(metrics, debtAnalysis);
    const weightedScore = this.calculateWeightedScore(breakdown);
    const overallScore = this.normalizeScore(weightedScore);
    const grade = this.calculateGrade(overallScore);
    const confidence = this.calculateConfidence(metrics, debtAnalysis);
    const benchmark = this.calculateBenchmark(overallScore, metrics);
    const trend = this.calculateTrend(previousScore, overallScore);
    const recommendations = this.generateScoreRecommendations(breakdown, overallScore);
    const nextSteps = this.generateNextSteps(breakdown, grade);

    return {
      overallScore,
      grade,
      breakdown,
      weightedScore,
      confidence,
      benchmark,
      trend,
      recommendations,
      nextSteps
    };
  }

  private calculateBreakdown(
    metrics: QualityMetrics,
    debtAnalysis?: TechnicalDebtAnalysis
  ): QualityScore['breakdown'] {
    return {
      maintainability: this.calculateMaintainabilityScore(metrics),
      complexity: this.calculateComplexityScore(metrics),
      security: this.calculateSecurityScore(metrics, debtAnalysis),
      performance: this.calculatePerformanceScore(metrics),
      reliability: this.calculateReliabilityScore(metrics),
      testability: this.calculateTestabilityScore(metrics),
      documentation: this.calculateDocumentationScore(metrics)
    };
  }

  private calculateMaintainabilityScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for low maintainability index
    if (metrics.MaintainabilityIndex < 40) score -= 40;
    else if (metrics.MaintainabilityIndex < 60) score -= 20;
    else if (metrics.MaintainabilityIndex < 80) score -= 10;

    // Deduct for high technical debt
    if (metrics.technicalDebtRatio > 20) score -= 30;
    else if (metrics.technicalDebtRatio > 10) score -= 15;
    else if (metrics.technicalDebtRatio > 5) score -= 5;

    // Deduct for code smells
    if (metrics.codeSmells > 20) score -= 25;
    else if (metrics.codeSmells > 10) score -= 15;
    else if (metrics.codeSmells > 5) score -= 5;

    // Deduct for duplication
    if (metrics.duplicationRatio > 15) score -= 20;
    else if (metrics.duplicationRatio > 8) score -= 10;
    else if (metrics.duplicationRatio > 3) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateComplexityScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for high cyclomatic complexity
    if (metrics.cyclomaticComplexity > 20) score -= 40;
    else if (metrics.cyclomaticComplexity > 15) score -= 25;
    else if (metrics.cyclomaticComplexity > 10) score -= 15;
    else if (metrics.cyclomaticComplexity > 7) score -= 5;

    // Deduct for high cognitive complexity
    if (metrics.cognitiveComplexity > 25) score -= 30;
    else if (metrics.cognitiveComplexity > 18) score -= 20;
    else if (metrics.cognitiveComplexity > 12) score -= 10;
    else if (metrics.cognitiveComplexity > 8) score -= 5;

    // Deduct for high coupling
    if (metrics.coupling > 60) score -= 25;
    else if (metrics.coupling > 40) score -= 15;
    else if (metrics.coupling > 25) score -= 5;

    // Deduct for deep inheritance
    if (metrics.depthOfInheritance > 5) score -= 20;
    else if (metrics.depthOfInheritance > 3) score -= 10;
    else if (metrics.depthOfInheritance > 2) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateSecurityScore(
    metrics: QualityMetrics,
    debtAnalysis?: TechnicalDebtAnalysis
  ): number {
    let score = 100;

    // Deduct for security issues
    if (metrics.securityIssues > 10) score -= 50;
    else if (metrics.securityIssues > 5) score -= 30;
    else if (metrics.securityIssues > 2) score -= 15;
    else if (metrics.securityIssues > 0) score -= 5;

    // Deduct for vulnerability score
    if (metrics.vulnerabilityScore > 8) score -= 40;
    else if (metrics.vulnerabilityScore > 6) score -= 25;
    else if (metrics.vulnerabilityScore > 4) score -= 15;
    else if (metrics.vulnerabilityScore > 2) score -= 5;

    // Deduct for security vulnerabilities from debt analysis
    if (debtAnalysis) {
      const vulnerabilityCount = debtAnalysis.debtByCategory.vulnerabilities;
      if (vulnerabilityCount > 5) score -= 30;
      else if (vulnerabilityCount > 2) score -= 15;
      else if (vulnerabilityCount > 0) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculatePerformanceScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for poor algorithmic complexity
    if (metrics.algorithmicComplexity === 'O(n³)') score -= 40;
    else if (metrics.algorithmicComplexity === 'O(n²)') score -= 25;
    else if (metrics.algorithmicComplexity === 'O(n log n)') score -= 10;
    else if (metrics.algorithmicComplexity === 'O(n)') score -= 5;

    // Deduct for memory usage
    if (metrics.memoryUsage > 100) score -= 30;
    else if (metrics.memoryUsage > 50) score -= 15;
    else if (metrics.memoryUsage > 25) score -= 5;

    // Deduct for large files
    if (metrics.linesOfCode > 1000) score -= 20;
    else if (metrics.linesOfCode > 500) score -= 10;
    else if (metrics.linesOfCode > 200) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateReliabilityScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for bug indicators
    const bugIndicators = this.countBugIndicators(metrics);
    if (bugIndicators > 15) score -= 40;
    else if (bugIndicators > 8) score -= 25;
    else if (bugIndicators > 3) score -= 15;
    else if (bugIndicators > 0) score -= 5;

    // Deduct for error handling issues
    if (metrics.errorHandlingScore < 40) score -= 30;
    else if (metrics.errorHandlingScore < 60) score -= 15;
    else if (metrics.errorHandlingScore < 80) score -= 5;

    // Deduct for resource management issues
    if (metrics.resourceManagementScore < 50) score -= 25;
    else if (metrics.resourceManagementScore < 70) score -= 15;
    else if (metrics.resourceManagementScore < 85) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateTestabilityScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for low test coverage
    if (metrics.testCoverage < 40) score -= 40;
    else if (metrics.testCoverage < 60) score -= 25;
    else if (metrics.testCoverage < 80) score -= 15;
    else if (metrics.testCoverage < 90) score -= 5;

    // Deduct for poor test quality
    if (metrics.testQualityScore < 50) score -= 30;
    else if (metrics.testQualityScore < 70) score -= 20;
    else if (metrics.testQualityScore < 85) score -= 10;

    // Deduct for complex functions (hard to test)
    if (metrics.cyclomaticComplexity > 15) score -= 25;
    else if (metrics.cyclomaticComplexity > 10) score -= 15;
    else if (metrics.cyclomaticComplexity > 7) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateDocumentationScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for low comment percentage
    if (metrics.commentPercentage < 10) score -= 30;
    else if (metrics.commentPercentage < 20) score -= 20;
    else if (metrics.commentPercentage < 30) score -= 10;

    // Deduct for poor comment quality
    if (metrics.commentQualityScore < 40) score -= 25;
    else if (metrics.commentQualityScore < 60) score -= 15;
    else if (metrics.commentQualityScore < 80) score -= 5;

    // Deduct for naming issues
    if (metrics.namingConventionScore < 60) score -= 20;
    else if (metrics.namingConventionScore < 80) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateWeightedScore(breakdown: QualityScore['breakdown']): number {
    return (
      breakdown.maintainability * this.weights.maintainability +
      breakdown.complexity * this.weights.complexity +
      breakdown.security * this.weights.security +
      breakdown.performance * this.weights.performance +
      breakdown.reliability * this.weights.reliability +
      breakdown.testability * this.weights.testability +
      breakdown.documentation * this.weights.documentation
    );
  }

  private normalizeScore(score: number): number {
    return Math.round(score * 100) / 100;
  }

  private calculateGrade(score: number): QualityScore['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private calculateConfidence(
    metrics: QualityMetrics,
    debtAnalysis?: TechnicalDebtAnalysis
  ): number {
    let confidence = 100;

    // Reduce confidence for incomplete metrics
    if (!metrics.MaintainabilityIndex) confidence -= 20;
    if (!metrics.cyclomaticComplexity) confidence -= 15;
    if (!metrics.cognitiveComplexity) confidence -= 10;

    // Reduce confidence for missing debt analysis
    if (!debtAnalysis) confidence -= 25;

    // Reduce confidence for small code samples
    if (metrics.linesOfCode < 50) confidence -= 30;
    else if (metrics.linesOfCode < 100) confidence -= 15;

    return Math.max(0, Math.min(100, confidence));
  }

  private calculateBenchmark(
    overallScore: number,
    metrics: QualityMetrics
  ): QualityScore['benchmark'] {
    const industryBenchmark = this.benchmarks.find(b => b.category === 'overall')?.score || 72;
    const projectBenchmark = this.calculateProjectBenchmark(metrics);
    const teamBenchmark = this.calculateTeamBenchmark(metrics);

    return {
      industry: industryBenchmark,
      project: projectBenchmark,
      team: teamBenchmark
    };
  }

  private calculateProjectBenchmark(metrics: QualityMetrics): number {
    // Calculate project-specific benchmark based on project characteristics
    let benchmark = 75; // Base project benchmark

    // Adjust for project type
    if (metrics.algorithmicComplexity === 'O(n³)') benchmark += 5;
    if (metrics.securityIssues > 0) benchmark -= 5;
    if (metrics.linesOfCode > 1000) benchmark += 5;

    return Math.min(100, Math.max(50, benchmark));
  }

  private calculateTeamBenchmark(metrics: QualityMetrics): number {
    // Calculate team-specific benchmark based on historical performance
    // This would typically be based on team's historical quality data
    return 78; // Default team benchmark
  }

  private calculateTrend(
    previousScore: QualityScore | undefined,
    currentScore: number
  ): QualityScore['trend'] {
    if (!previousScore) return 'stable';

    const change = currentScore - previousScore.overallScore;
    const threshold = 2; // 2 point threshold for trend detection

    if (change > threshold) return 'improving';
    if (change < -threshold) return 'declining';
    return 'stable';
  }

  private generateScoreRecommendations(
    breakdown: QualityScore['breakdown'],
    overallScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on weakest areas
    const areas = Object.entries(breakdown).sort((a, b) => a[1] - b[1]);
    
    areas.slice(0, 3).forEach(([area, score]) => {
      if (score < 70) {
        recommendations.push(this.getAreaRecommendation(area, score));
      }
    });

    // Overall recommendations
    if (overallScore < 60) {
      recommendations.push('Critical: Major quality improvements needed across all areas');
    } else if (overallScore < 80) {
      recommendations.push('Moderate improvements needed to reach quality standards');
    }

    return recommendations;
  }

  private getAreaRecommendation(area: string, score: number): string {
    const recommendations: Record<string, string> = {
      maintainability: `Improve maintainability (current: ${score}): Refactor complex functions, reduce coupling, and improve code structure`,
      complexity: `Reduce complexity (current: ${score}): Break down large functions, simplify logic, and reduce nesting levels`,
      security: `Enhance security (current: ${score}): Address security vulnerabilities and implement secure coding practices`,
      performance: `Optimize performance (current: ${score}): Improve algorithms, reduce memory usage, and optimize data structures`,
      reliability: `Increase reliability (current: ${score}): Add error handling, improve resource management, and add defensive programming`,
      testability: `Improve testability (current: ${score}): Increase test coverage, write better tests, and improve code structure for testing`,
      documentation: `Enhance documentation (current: ${score}): Add comments, improve naming conventions, and document complex logic`
    };

    return recommendations[area] || `Improve ${area} (current: ${score})`;
  }

  private generateNextSteps(
    breakdown: QualityScore['breakdown'],
    grade: QualityScore['grade']
  ): string[] {
    const nextSteps: string[] = [];

    // Priority actions based on grade
    if (grade === 'F') {
      nextSteps.push('Immediate action required: Address critical quality issues');
      nextSteps.push('Conduct comprehensive code review and refactoring');
    } else if (grade === 'D') {
      nextSteps.push('Major refactoring needed: Focus on lowest scoring areas');
      nextSteps.push('Implement automated quality checks');
    } else if (grade === 'C') {
      nextSteps.push('Targeted improvements: Address specific weak areas');
      nextSteps.push('Establish quality improvement plan');
    } else if (grade === 'B') {
      nextSteps.push('Continuous improvement: Maintain and enhance quality');
      nextSteps.push('Focus on reaching A-grade quality');
    } else {
      nextSteps.push('Maintain excellence: Continue quality practices');
      nextSteps.push('Share best practices with team');
    }

    // Specific next steps based on weakest areas
    const weakestArea = Object.entries(breakdown).reduce((a, b) => a[1] < b[1] ? a : b)[0];
    nextSteps.push(this.getAreaNextStep(weakestArea));

    return nextSteps;
  }

  private getAreaNextStep(area: string): string {
    const nextSteps: Record<string, string> = {
      maintainability: 'Refactor the most complex functions first',
      complexity: 'Break down functions with cyclomatic complexity > 10',
      security: 'Conduct security audit and fix all vulnerabilities',
      performance: 'Profile and optimize slow-performing code sections',
      reliability: 'Add comprehensive error handling and logging',
      testability: 'Write unit tests for all critical functions',
      documentation: 'Document all public APIs and complex algorithms'
    };

    return nextSteps[area] || 'Create improvement plan for this area';
  }

  private countBugIndicators(metrics: QualityMetrics): number {
    // Count various bug indicators from metrics
    let count = 0;

    // High complexity indicates potential bugs
    if (metrics.cyclomaticComplexity > 15) count += 5;
    if (metrics.cognitiveComplexity > 20) count += 3;

    // Low maintainability indicates potential bugs
    if (metrics.MaintainabilityIndex < 50) count += 3;

    // Poor error handling indicates potential bugs
    if (metrics.errorHandlingScore < 60) count += 3;

    // Resource management issues indicate potential bugs
    if (metrics.resourceManagementScore < 70) count += 2;

    return count;
  }

  generateQualityReport(
    score: QualityScore,
    metrics: QualityMetrics,
    debtAnalysis?: TechnicalDebtAnalysis,
    history?: QualityHistory[]
  ): QualityReport {
    const summary = {
      overallScore: score.overallScore,
      grade: score.grade,
      trend: score.trend,
      confidence: score.confidence
    };

    const benchmarks = {
      industry: score.benchmark.industry,
      project: score.benchmark.project,
      team: score.benchmark.team
    };

    const recommendations = this.generateReportRecommendations(score, metrics);
    const nextSteps = this.generateReportNextSteps(score);

    return {
      summary,
      breakdown: score.breakdown,
      benchmarks,
      metrics,
      debtAnalysis,
      recommendations,
      history: history || [],
      nextSteps
    };
  }

  private generateReportRecommendations(
    score: QualityScore,
    metrics: QualityMetrics
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    // Critical issues
    if (score.overallScore < 60) {
      recommendations.push({
        id: `critical-quality-${Date.now()}`,
        type: 'refactor',
        priority: 'critical',
        title: 'Critical Quality Issues',
        description: 'Overall quality score is below acceptable levels. Immediate action required.',
        impact: {
          qualityScore: 30,
          maintainability: 25,
          performance: 15,
          security: 20
        },
        estimatedEffort: 40,
        filesAffected: [],
        category: 'quality',
        createdAt: new Date()
      });
    }

    // Security issues
    if (score.breakdown.security < 70) {
      recommendations.push({
        id: `security-improvement-${Date.now()}`,
        type: 'security',
        priority: 'high',
        title: 'Security Improvements Needed',
        description: 'Security score is below acceptable levels. Address security vulnerabilities.',
        impact: {
          qualityScore: 20,
          maintainability: 5,
          performance: 5,
          security: 30
        },
        estimatedEffort: 20,
        filesAffected: [],
        category: 'security',
        createdAt: new Date()
      });
    }

    // Performance issues
    if (score.breakdown.performance < 70) {
      recommendations.push({
        id: `performance-optimization-${Date.now()}`,
        type: 'optimization',
        priority: 'medium',
        title: 'Performance Optimization',
        description: 'Performance score needs improvement. Optimize algorithms and resource usage.',
        impact: {
          qualityScore: 15,
          maintainability: 5,
          performance: 25,
          security: 0
        },
        estimatedEffort: 15,
        filesAffected: [],
        category: 'performance',
        createdAt: new Date()
      });
    }

    return recommendations;
  }

  private generateReportNextSteps(score: QualityScore): string[] {
    const nextSteps: string[] = [];

    // Based on grade
    if (score.grade === 'F' || score.grade === 'D') {
      nextSteps.push('1. Create quality improvement plan with specific milestones');
      nextSteps.push('2. Assign dedicated resources for quality improvements');
      nextSteps.push('3. Implement automated quality gates in CI/CD pipeline');
    } else if (score.grade === 'C') {
      nextSteps.push('1. Focus on improving the lowest scoring areas first');
      nextSteps.push('2. Establish regular code review practices');
      nextSteps.push('3. Set up automated quality monitoring');
    } else {
      nextSteps.push('1. Continue current quality practices');
      nextSteps.push('2. Share best practices with team members');
      nextSteps.push('3. Monitor quality trends and address any declines');
    }

    return nextSteps;
  }

  compareQualityScores(scores: QualityScore[]): {
    comparison: Array<{
      date: Date;
      score: number;
      grade: string;
      change: number;
    }>;
    trend: 'improving' | 'stable' | 'declining';
    average: number;
    best: number;
    worst: number;
  } {
    if (scores.length === 0) {
      return {
        comparison: [],
        trend: 'stable',
        average: 0,
        best: 0,
        worst: 0
      };
    }

    const comparison = scores.map((score, index) => ({
      date: new Date(), // Would use actual date from score
      score: score.overallScore,
      grade: score.grade,
      change: index > 0 ? score.overallScore - scores[index - 1].overallScore : 0
    }));

    const trend = this.calculateOverallTrend(scores);
    const average = scores.reduce((sum, score) => sum + score.overallScore, 0) / scores.length;
    const best = Math.max(...scores.map(s => s.overallScore));
    const worst = Math.min(...scores.map(s => s.overallScore));

    return {
      comparison,
      trend,
      average: Math.round(average * 100) / 100,
      best,
      worst
    };
  }

  private calculateOverallTrend(scores: QualityScore[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 2) return 'stable';

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((sum, score) => sum + score.overallScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score.overallScore, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 2) return 'improving';
    if (change < -2) return 'declining';
    return 'stable';
  }
}