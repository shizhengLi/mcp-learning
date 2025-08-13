import { QualityMetrics } from './QualityMetricsCalculator'
import { QualityScore } from './QualityScorer'
import { TechnicalDebtAnalysis } from './TechnicalDebtAnalyzer'

export interface TrendDataPoint {
  date: Date
  metrics: QualityMetrics
  score: QualityScore
  debtAnalysis?: TechnicalDebtAnalysis
}

export interface TrendAnalysis {
  period: {
    start: Date
    end: Date
    duration: number // in days
  }
  metrics: {
    qualityScore: {
      values: number[]
      trend: 'improving' | 'stable' | 'declining'
      change: number // percentage change
      volatility: number // standard deviation
    }
    maintainability: {
      values: number[]
      trend: 'improving' | 'stable' | 'declining'
      change: number
      volatility: number
    }
    complexity: {
      values: number[]
      trend: 'improving' | 'stable' | 'declining'
      change: number
      volatility: number
    }
    technicalDebt: {
      values: number[]
      trend: 'improving' | 'stable' | 'declining'
      change: number
      volatility: number
    }
    testCoverage: {
      values: number[]
      trend: 'improving' | 'stable' | 'declining'
      change: number
      volatility: number
    }
  }
  patterns: {
    cyclicBehavior: boolean
    seasonalVariation: boolean
    outliers: Array<{
      date: Date
      metric: string
      value: number
      deviation: number
    }>
  }
  predictions: {
    nextWeek: {
      qualityScore: number
      confidence: number
    }
    nextMonth: {
      qualityScore: number
      confidence: number
    }
    nextQuarter: {
      qualityScore: number
      confidence: number
    }
  }
  insights: {
    summary: string
    keyFindings: string[]
    recommendations: string[]
    riskAssessment: 'low' | 'medium' | 'high'
  }
}

export interface TrendComparison {
  currentPeriod: TrendAnalysis
  previousPeriod: TrendAnalysis | undefined
  comparison: {
    qualityScoreChange: number
    maintainabilityChange: number
    complexityChange: number
    technicalDebtChange: number
    testCoverageChange: number
  }
  benchmarks: {
    industryAverage: number
    teamAverage: number
    projectTarget: number
  }
}

export class QualityTrendAnalyzer {
  private readonly trendThresholds = {
    significantChange: 5, // 5% change considered significant
    highVolatility: 15, // 15% standard deviation considered high
    outlierThreshold: 2.5, // 2.5 standard deviations for outlier detection
  }

  analyzeTrends(
    historicalData: TrendDataPoint[],
    options: {
      period?: number // days to analyze, default 30
      includePredictions?: boolean
      benchmarkData?: {
        industryAverage: number
        teamAverage: number
        projectTarget: number
      }
    } = {}
  ): TrendAnalysis {
    const period = options.period || 30

    // Sort data by date and take the most recent 'period' days
    const sortedData = [...historicalData].sort((a, b) => b.date.getTime() - a.date.getTime())
    const relevantData = sortedData
      .slice(0, Math.max(2, Math.min(period, sortedData.length)))
      .reverse()

    if (relevantData.length < 2) {
      throw new Error('Insufficient data for trend analysis. Need at least 2 data points.')
    }

    const analysisPeriod = {
      start: relevantData[0].date,
      end: relevantData[relevantData.length - 1].date,
      duration: period,
    }

    const metrics = this.calculateMetricTrends(relevantData)
    const patterns = this.identifyPatterns(relevantData, metrics)
    const predictions = options.includePredictions
      ? this.generatePredictions(relevantData, metrics)
      : this.getDefaultPredictions()
    const insights = this.generateInsights(metrics, patterns, predictions)

    return {
      period: analysisPeriod,
      metrics,
      patterns,
      predictions,
      insights,
    }
  }

  compareTrends(
    currentAnalysis: TrendAnalysis,
    previousAnalysis?: TrendAnalysis,
    benchmarkData?: {
      industryAverage: number
      teamAverage: number
      projectTarget: number
    }
  ): TrendComparison {
    const comparison = {
      qualityScoreChange: this.calculatePercentageChange(
        currentAnalysis.metrics.qualityScore.values,
        previousAnalysis?.metrics.qualityScore.values
      ),
      maintainabilityChange: this.calculatePercentageChange(
        currentAnalysis.metrics.maintainability.values,
        previousAnalysis?.metrics.maintainability.values
      ),
      complexityChange: this.calculatePercentageChange(
        currentAnalysis.metrics.complexity.values,
        previousAnalysis?.metrics.complexity.values
      ),
      technicalDebtChange: this.calculatePercentageChange(
        currentAnalysis.metrics.technicalDebt.values,
        previousAnalysis?.metrics.technicalDebt.values
      ),
      testCoverageChange: this.calculatePercentageChange(
        currentAnalysis.metrics.testCoverage.values,
        previousAnalysis?.metrics.testCoverage.values
      ),
    }

    const benchmarks = {
      industryAverage: benchmarkData?.industryAverage || 72,
      teamAverage: benchmarkData?.teamAverage || 75,
      projectTarget: benchmarkData?.projectTarget || 80,
    }

    return {
      currentPeriod: currentAnalysis,
      previousPeriod: previousAnalysis,
      comparison,
      benchmarks,
    }
  }

  private calculateMetricTrends(data: TrendDataPoint[]) {
    const qualityScores = data.map(point => point.score.overallScore)
    const maintainabilityScores = data.map(point => point.metrics.maintainability)
    const complexityScores = data.map(point => point.metrics.complexity)
    const technicalDebtScores = data.map(point => point.metrics.technicalDebt)
    const testCoverageScores = data.map(point => point.metrics.testCoverage || 0)

    return {
      qualityScore: {
        values: qualityScores,
        trend: this.calculateTrend(qualityScores),
        change: this.calculatePercentageChange(qualityScores),
        volatility: this.calculateVolatility(qualityScores),
      },
      maintainability: {
        values: maintainabilityScores,
        trend: this.calculateTrend(maintainabilityScores),
        change: this.calculatePercentageChange(maintainabilityScores),
        volatility: this.calculateVolatility(maintainabilityScores),
      },
      complexity: {
        values: complexityScores,
        trend: this.calculateTrend(complexityScores.map(c => -c)), // Invert for complexity (lower is better)
        change: -this.calculatePercentageChange(complexityScores), // Invert change
        volatility: this.calculateVolatility(complexityScores),
      },
      technicalDebt: {
        values: technicalDebtScores,
        trend: this.calculateTrend(technicalDebtScores.map(d => -d)), // Invert for debt (lower is better)
        change: -this.calculatePercentageChange(technicalDebtScores), // Invert change
        volatility: this.calculateVolatility(technicalDebtScores),
      },
      testCoverage: {
        values: testCoverageScores,
        trend: this.calculateTrend(testCoverageScores),
        change: this.calculatePercentageChange(testCoverageScores),
        volatility: this.calculateVolatility(testCoverageScores),
      },
    }
  }

  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable'

    // Use linear regression to determine trend
    const n = values.length
    const xValues = Array.from({ length: n }, (_, i) => i)
    const yValues = values

    const sumX = xValues.reduce((a, b) => a + b, 0)
    const sumY = yValues.reduce((a, b) => a + b, 0)
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    // Determine trend based on slope and significance
    if (Math.abs(slope) < 0.1) return 'stable'
    return slope > 0 ? 'improving' : 'declining'
  }

  private calculatePercentageChange(currentValues: number[], previousValues?: number[]): number {
    if (!previousValues || previousValues.length === 0) {
      // If no previous values, calculate change from first to last in current period
      if (currentValues.length < 2) return 0
      const first = currentValues[0]
      const last = currentValues[currentValues.length - 1]
      return first === 0 ? 0 : ((last - first) / first) * 100
    }

    const currentAvg = currentValues.reduce((a, b) => a + b, 0) / currentValues.length
    const previousAvg = previousValues.reduce((a, b) => a + b, 0) / previousValues.length

    if (previousAvg === 0) return currentAvg > 0 ? 100 : 0

    return ((currentAvg - previousAvg) / previousAvg) * 100
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length

    return Math.sqrt(variance)
  }

  private identifyPatterns(data: TrendDataPoint[], metrics: TrendAnalysis['metrics']) {
    const outliers: Array<{
      date: Date
      metric: string
      value: number
      deviation: number
    }> = []

    // Check for outliers in each metric
    Object.entries(metrics).forEach(([metricName, metricData]) => {
      const values = metricData.values
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const stdDev = this.calculateVolatility(values)

      values.forEach((value, index) => {
        const zScore = Math.abs((value - mean) / stdDev)
        if (zScore > this.trendThresholds.outlierThreshold) {
          outliers.push({
            date: data[index].date,
            metric: metricName,
            value,
            deviation: zScore,
          })
        }
      })
    })

    // Detect cyclic behavior (simplified)
    const qualityValues = metrics.qualityScore.values
    const cyclicBehavior = this.detectCycles(qualityValues)

    // Detect seasonal variation (simplified - would need more data for accurate detection)
    const seasonalVariation = data.length >= 90 // Assume seasonal if we have >= 3 months of data

    return {
      cyclicBehavior,
      seasonalVariation,
      outliers,
    }
  }

  private detectCycles(values: number[]): boolean {
    if (values.length < 10) return false

    // Simple cycle detection using autocorrelation
    const maxLag = Math.min(values.length / 4, 30)
    const mean = values.reduce((a, b) => a + b, 0) / values.length

    let maxCorrelation = 0
    for (let lag = 2; lag <= maxLag; lag++) {
      let correlation = 0
      for (let i = lag; i < values.length; i++) {
        correlation += (values[i] - mean) * (values[i - lag] - mean)
      }
      correlation /= values.length - lag

      if (Math.abs(correlation) > Math.abs(maxCorrelation)) {
        maxCorrelation = correlation
      }
    }

    return Math.abs(maxCorrelation) > 0.3 // Threshold for cycle detection
  }

  private generatePredictions(_data: TrendDataPoint[], metrics: TrendAnalysis['metrics']) {
    // Simple linear regression prediction
    const qualityValues = metrics.qualityScore.values
    const n = qualityValues.length

    if (n < 3) {
      return this.getDefaultPredictions()
    }

    const xValues = Array.from({ length: n }, (_, i) => i)
    const yValues = qualityValues

    const sumX = xValues.reduce((a, b) => a + b, 0)
    const sumY = yValues.reduce((a, b) => a + b, 0)
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const predict = (daysAhead: number) => {
      const predictedValue = intercept + slope * (n + daysAhead - 1)
      return Math.max(0, Math.min(100, predictedValue)) // Clamp to 0-100 range
    }

    // Calculate confidence based on volatility and data consistency
    const volatility = metrics.qualityScore.volatility
    const rSquared = this.calculateRSquared(xValues, yValues, slope, intercept)
    const confidence = Math.max(0.1, Math.min(0.9, rSquared - volatility / 100))

    return {
      nextWeek: {
        qualityScore: predict(7),
        confidence,
      },
      nextMonth: {
        qualityScore: predict(30),
        confidence,
      },
      nextQuarter: {
        qualityScore: predict(90),
        confidence,
      },
    }
  }

  private calculateRSquared(
    xValues: number[],
    yValues: number[],
    slope: number,
    intercept: number
  ): number {
    const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length

    const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0)
    const residualSumSquares = yValues.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept
      return sum + Math.pow(y - predicted, 2)
    }, 0)

    return totalSumSquares === 0 ? 0 : 1 - residualSumSquares / totalSumSquares
  }

  private getDefaultPredictions() {
    return {
      nextWeek: { qualityScore: 75, confidence: 0.5 },
      nextMonth: { qualityScore: 75, confidence: 0.4 },
      nextQuarter: { qualityScore: 75, confidence: 0.3 },
    }
  }

  private generateInsights(
    metrics: TrendAnalysis['metrics'],
    patterns: TrendAnalysis['patterns'],
    predictions: TrendAnalysis['predictions']
  ) {
    const keyFindings: string[] = []
    const recommendations: string[] = []

    // Analyze overall quality trend
    const qualityTrend = metrics.qualityScore.trend
    const qualityChange = metrics.qualityScore.change

    // Always add key finding for significant trends
    if (Math.abs(qualityChange) > this.trendThresholds.significantChange) {
      keyFindings.push(
        `Quality score is ${qualityTrend} with ${Math.abs(qualityChange).toFixed(1)}% change`
      )
    } else {
      keyFindings.push(
        `Quality score is ${qualityTrend} (${Math.abs(qualityChange).toFixed(1)}% change)`
      )
    }

    if (qualityTrend === 'declining') {
      recommendations.push('Investigate root causes of quality decline')
      recommendations.push('Implement additional quality gates')
    } else if (qualityTrend === 'improving') {
      recommendations.push('Continue current quality improvement practices')
      recommendations.push('Document successful practices for future reference')
    }

    // Analyze volatility
    if (metrics.qualityScore.volatility > this.trendThresholds.highVolatility) {
      keyFindings.push('High volatility in quality scores detected')
      recommendations.push('Standardize development processes')
      recommendations.push('Implement more consistent code reviews')
    }

    // Analyze technical debt
    if (metrics.technicalDebt.trend === 'declining') {
      keyFindings.push('Technical debt is increasing')
      recommendations.push('Schedule dedicated debt reduction sprints')
      recommendations.push('Establish debt repayment thresholds')
    }

    // Analyze outliers
    if (patterns.outliers.length > 0) {
      keyFindings.push(`${patterns.outliers.length} outlier events detected`)
      recommendations.push('Investigate causes of outlier events')
      recommendations.push('Implement monitoring for early detection')
    }

    // Analyze predictions
    if (predictions.nextMonth.qualityScore < 70) {
      recommendations.push('Proactive measures needed to prevent quality decline')
    }

    // Ensure we have at least some findings and recommendations
    if (keyFindings.length === 0) {
      keyFindings.push('Quality metrics analyzed successfully')
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring quality metrics')
    }

    // Analyze predictions
    if (predictions.nextMonth.qualityScore < 70) {
      recommendations.push('Proactive measures needed to prevent quality decline')
    }

    // Generate summary
    const summary = this.generateSummary(metrics, patterns, keyFindings)

    // Risk assessment
    let riskAssessment: 'low' | 'medium' | 'high' = 'low'
    if (qualityTrend === 'declining' && Math.abs(qualityChange) > 10) riskAssessment = 'high'
    else if (qualityTrend === 'declining' || metrics.qualityScore.volatility > 20)
      riskAssessment = 'medium'

    return {
      summary,
      keyFindings,
      recommendations,
      riskAssessment,
    }
  }

  private generateSummary(
    metrics: TrendAnalysis['metrics'],
    patterns: TrendAnalysis['patterns'],
    keyFindings: string[]
  ): string {
    const qualityTrend = metrics.qualityScore.trend
    const currentQuality = metrics.qualityScore.values[metrics.qualityScore.values.length - 1]

    let summary = `Quality is ${qualityTrend} with current score of ${currentQuality.toFixed(1)}. `

    if (patterns.cyclicBehavior) {
      summary += 'Cyclic behavior detected in quality metrics. '
    }

    if (patterns.outliers.length > 0) {
      summary += `${patterns.outliers.length} outlier events identified. `
    }

    if (keyFindings.length > 0) {
      summary += `Key findings include: ${keyFindings.slice(0, 2).join(', ')}.`
    }

    return summary
  }

  // Utility method to add new data points to historical data
  addDataPoint(
    historicalData: TrendDataPoint[],
    newDataPoint: TrendDataPoint,
    maxDataPoints: number = 365 // Keep 1 year of data by default
  ): TrendDataPoint[] {
    const updatedData = [...historicalData, newDataPoint].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )

    // Remove oldest data points if we exceed the limit
    if (updatedData.length > maxDataPoints) {
      return updatedData.slice(-maxDataPoints)
    }

    return updatedData
  }

  // Export trend data for external analysis
  exportTrendData(analysis: TrendAnalysis): string {
    return JSON.stringify(
      {
        period: analysis.period,
        metrics: analysis.metrics,
        patterns: analysis.patterns,
        predictions: analysis.predictions,
        insights: analysis.insights,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    )
  }

  // Import trend data from external source
  importTrendData(jsonData: string): TrendAnalysis {
    try {
      const data = JSON.parse(jsonData)
      // Validate the imported data structure
      if (!data.period || !data.metrics || !data.insights) {
        throw new Error('Invalid trend data format')
      }
      return data as TrendAnalysis
    } catch (error) {
      throw new Error(`Failed to import trend data: ${error}`)
    }
  }
}
