import {
  QualityMetrics,
  TechnicalDebtItem,
  QualityRecommendation,
} from './QualityMetricsCalculator'

export interface TechnicalDebtAnalysis {
  totalDebt: number
  debtItems: TechnicalDebtItem[]
  debtByCategory: {
    codeSmells: number
    designIssues: number
    bugs: number
    vulnerabilities: number
    performanceIssues: number
  }
  debtBySeverity: {
    low: number
    medium: number
    high: number
    critical: number
  }
  debtRatio: number
  estimatedPayoffTime: number // in months
  monthlyInterest: number
  priorityItems: TechnicalDebtItem[]
  recommendations: QualityRecommendation[]
  riskAssessment: {
    overall: 'low' | 'medium' | 'high'
    maintainability: 'low' | 'medium' | 'high'
    performance: 'low' | 'medium' | 'high'
    security: 'low' | 'medium' | 'high'
    reliability: 'low' | 'medium' | 'high'
  }
}

export interface DebtTrend {
  period: string
  debtHistory: Array<{
    date: Date
    totalDebt: number
    debtRatio: number
    itemCount: number
  }>
  trend: 'increasing' | 'stable' | 'decreasing'
  projectedDebt: {
    nextMonth: number
    nextQuarter: number
    nextYear: number
  }
  riskProjection: 'low' | 'medium' | 'high'
}

export class TechnicalDebtAnalyzer {
  private readonly interestRates = {
    code_smell: 0.05, // 5% monthly interest
    design_issue: 0.08, // 8% monthly interest
    bug: 0.15, // 15% monthly interest
    vulnerability: 0.25, // 25% monthly interest
    performance_issue: 0.1, // 10% monthly interest
  }

  private readonly severityMultipliers = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 5,
  }

  async analyzeTechnicalDebt(
    code: string,
    language: string,
    filePath: string,
    qualityMetrics: QualityMetrics
  ): Promise<TechnicalDebtAnalysis> {
    const debtItems = await this.identifyDebtItems(code, language, filePath, qualityMetrics)
    const totalDebt = this.calculateTotalDebt(debtItems)
    const debtByCategory = this.categorizeDebtByType(debtItems)
    const debtBySeverity = this.categorizeDebtBySeverity(debtItems)
    const debtRatio = this.calculateDebtRatio(debtItems, code)
    const estimatedPayoffTime = this.estimatePayoffTime(debtItems)
    const monthlyInterest = this.calculateMonthlyInterest(debtItems)
    const priorityItems = this.identifyPriorityItems(debtItems)
    const recommendations = this.generateDebtRecommendations(debtItems, code, language)
    const riskAssessment = this.assessDebtRisk(debtItems, qualityMetrics)

    return {
      totalDebt,
      debtItems,
      debtByCategory,
      debtBySeverity,
      debtRatio,
      estimatedPayoffTime,
      monthlyInterest,
      priorityItems,
      recommendations,
      riskAssessment,
    }
  }

  private async identifyDebtItems(
    code: string,
    language: string,
    filePath: string,
    qualityMetrics: QualityMetrics
  ): Promise<TechnicalDebtItem[]> {
    const debtItems: TechnicalDebtItem[] = []
    const _lines = code.split('\n')

    // Code Smells
    debtItems.push(...this.identifyCodeSmells(code, language, filePath, _lines))

    // Design Issues
    debtItems.push(...this.identifyDesignIssues(code, language, filePath, qualityMetrics))

    // Bugs
    debtItems.push(...this.identifyBugs(code, language, filePath, _lines))

    // Vulnerabilities
    debtItems.push(...this.identifyVulnerabilities(code, language, filePath, _lines))

    // Performance Issues
    debtItems.push(
      ...this.identifyPerformanceIssues(code, language, filePath, _lines, qualityMetrics)
    )

    return debtItems
  }

  private identifyCodeSmells(
    code: string,
    language: string,
    filePath: string,
    lines: string[]
  ): TechnicalDebtItem[] {
    const items: TechnicalDebtItem[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Long lines
      if (trimmed.length > 120) {
        items.push(
          this.createDebtItem(
            'code_smell',
            'low',
            `Line too long (${trimmed.length} characters)`,
            filePath,
            index + 1,
            1,
            0.05
          )
        )
      }

      // TODO comments
      if (trimmed.match(/\bTODO\b/)) {
        items.push(
          this.createDebtItem(
            'code_smell',
            'medium',
            'TODO comment found - incomplete implementation',
            filePath,
            index + 1,
            3,
            0.1
          )
        )
      }

      // FIXME comments
      if (trimmed.match(/\bFIXME\b/)) {
        items.push(
          this.createDebtItem(
            'code_smell',
            'high',
            'FIXME comment found - known issue to fix',
            filePath,
            index + 1,
            5,
            0.15
          )
        )
      }

      // Magic numbers
      if (
        trimmed.match(/\b[2-9]\d{2,}\b/) &&
        !trimmed.includes('port') &&
        !trimmed.includes('http')
      ) {
        items.push(
          this.createDebtItem(
            'code_smell',
            'low',
            'Magic number detected - should use named constant',
            filePath,
            index + 1,
            1,
            0.03
          )
        )
      }

      // Dead code (simplified detection)
      if (trimmed.match(/\b(console\.log|debugger|alert)\b/)) {
        items.push(
          this.createDebtItem(
            'code_smell',
            'medium',
            'Debug code found - should be removed in production',
            filePath,
            index + 1,
            2,
            0.08
          )
        )
      }
    })

    // Complex functions
    const functions = this.extractFunctions(code, language)
    functions.forEach(func => {
      if (func.complexity > 15) {
        items.push(
          this.createDebtItem(
            'code_smell',
            'high',
            `Function "${func.name}" is too complex (complexity: ${func.complexity})`,
            filePath,
            func.line,
            8,
            0.12
          )
        )
      }
    })

    return items
  }

  private identifyDesignIssues(
    _code: string,
    _language: string,
    filePath: string,
    qualityMetrics: QualityMetrics
  ): TechnicalDebtItem[] {
    const items: TechnicalDebtItem[] = []

    // High coupling
    if (qualityMetrics.coupling > 50) {
      items.push(
        this.createDebtItem(
          'design_issue',
          'high',
          'High coupling detected - consider dependency injection',
          filePath,
          undefined,
          10,
          0.15
        )
      )
    }

    // Low cohesion
    if (qualityMetrics.cohesion < 40) {
      items.push(
        this.createDebtItem(
          'design_issue',
          'medium',
          'Low cohesion detected - consider refactoring into focused classes',
          filePath,
          undefined,
          8,
          0.1
        )
      )
    }

    // Deep inheritance
    if (qualityMetrics.depthOfInheritance > 4) {
      items.push(
        this.createDebtItem(
          'design_issue',
          'medium',
          'Deep inheritance hierarchy detected - consider composition over inheritance',
          filePath,
          undefined,
          6,
          0.08
        )
      )
    }

    // Large classes
    const classes = this.extractClasses(_code, _language)
    classes.forEach(cls => {
      if (cls.lines > 300) {
        items.push(
          this.createDebtItem(
            'design_issue',
            'high',
            `Class "${cls.name}" is too large (${cls.lines} lines)`,
            filePath,
            cls.line,
            12,
            0.12
          )
        )
      }
    })

    return items
  }

  private identifyBugs(
    _code: string,
    _language: string,
    filePath: string,
    lines: string[]
  ): TechnicalDebtItem[] {
    const items: TechnicalDebtItem[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Null pointer issues
      if (trimmed.match(/\.\w+\(/) && !trimmed.includes('null') && !trimmed.includes('undefined')) {
        items.push(
          this.createDebtItem(
            'bug',
            'medium',
            'Potential null pointer exception - add null check',
            filePath,
            index + 1,
            4,
            0.2
          )
        )
      }

      // Resource leaks
      if (
        trimmed.match(/\b(new\s+\w+|open|connect)\b/) &&
        !trimmed.includes('close') &&
        !trimmed.includes('dispose')
      ) {
        items.push(
          this.createDebtItem(
            'bug',
            'high',
            'Potential resource leak - ensure proper cleanup',
            filePath,
            index + 1,
            6,
            0.25
          )
        )
      }

      // Off-by-one errors
      if (trimmed.match(/\b(i|j|k)\s*<\s*\w+\.\s*length\s*-\s*1\b/)) {
        items.push(
          this.createDebtItem(
            'bug',
            'medium',
            'Potential off-by-one error in loop condition',
            filePath,
            index + 1,
            3,
            0.18
          )
        )
      }

      // Uninitialized variables
      if (trimmed.match(/\b(var|let|const)\s+\w+\s*;/) && !trimmed.includes('=')) {
        items.push(
          this.createDebtItem(
            'bug',
            'low',
            'Variable declared but not initialized',
            filePath,
            index + 1,
            2,
            0.1
          )
        )
      }
    })

    return items
  }

  private identifyVulnerabilities(
    _code: string,
    _language: string,
    filePath: string,
    lines: string[]
  ): TechnicalDebtItem[] {
    const items: TechnicalDebtItem[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // SQL Injection
      if (trimmed.match(/\b(SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*\w+/i)) {
        items.push(
          this.createDebtItem(
            'vulnerability',
            'critical',
            'Potential SQL injection vulnerability - use parameterized queries',
            filePath,
            index + 1,
            20,
            0.3
          )
        )
      }

      // XSS vulnerabilities
      if (trimmed.match(/\binnerHTML\s*=\s*.*\+/) || trimmed.match(/\beval\s*\(/)) {
        items.push(
          this.createDebtItem(
            'vulnerability',
            'critical',
            'Potential XSS vulnerability - sanitize user input',
            filePath,
            index + 1,
            18,
            0.28
          )
        )
      }

      // Hardcoded credentials
      if (trimmed.match(/\b(password|secret|key|token)\s*=\s*['"][^'"]+['"]/i)) {
        items.push(
          this.createDebtItem(
            'vulnerability',
            'critical',
            'Hardcoded credentials detected - use environment variables',
            filePath,
            index + 1,
            25,
            0.35
          )
        )
      }

      // Weak cryptography
      if (trimmed.match(/\b(MD5|SHA1)\b/i)) {
        items.push(
          this.createDebtItem(
            'vulnerability',
            'high',
            'Weak cryptographic algorithm detected - use stronger alternatives',
            filePath,
            index + 1,
            15,
            0.25
          )
        )
      }

      // Path traversal
      if (trimmed.match(/\.\.\//) && trimmed.match(/\b(file|open|read)\b/i)) {
        items.push(
          this.createDebtItem(
            'vulnerability',
            'high',
            'Potential path traversal vulnerability - validate file paths',
            filePath,
            index + 1,
            12,
            0.22
          )
        )
      }
    })

    return items
  }

  private identifyPerformanceIssues(
    _code: string,
    _language: string,
    filePath: string,
    lines: string[],
    _qualityMetrics: QualityMetrics
  ): TechnicalDebtItem[] {
    const items: TechnicalDebtItem[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Nested loops
      if (trimmed.match(/\bfor\b.*\bfor\b/)) {
        items.push(
          this.createDebtItem(
            'performance_issue',
            'high',
            'Nested loop detected - consider optimizing algorithm',
            filePath,
            index + 1,
            8,
            0.15
          )
        )
      }

      // Inefficient string concatenation
      if (trimmed.match(/\b(\w+)\s*\+=\s*['"]/) && trimmed.includes('for')) {
        items.push(
          this.createDebtItem(
            'performance_issue',
            'medium',
            'Inefficient string concatenation in loop - use StringBuilder',
            filePath,
            index + 1,
            4,
            0.1
          )
        )
      }

      // Synchronous operations in async context
      if (trimmed.match(/\b(sleep|wait|blocking)\b/)) {
        items.push(
          this.createDebtItem(
            'performance_issue',
            'medium',
            'Synchronous operation detected - consider async alternatives',
            filePath,
            index + 1,
            5,
            0.12
          )
        )
      }

      // Memory leaks
      if (trimmed.match(/\b(new\s+\w+|malloc)\b/) && !trimmed.match(/\b(delete|free)\b/)) {
        items.push(
          this.createDebtItem(
            'performance_issue',
            'high',
            'Potential memory leak - ensure proper cleanup',
            filePath,
            index + 1,
            7,
            0.18
          )
        )
      }
    })

    // Algorithmic complexity issues
    if (_qualityMetrics.algorithmicComplexity === 'O(n²)') {
      items.push(
        this.createDebtItem(
          'performance_issue',
          'medium',
          'Algorithm has O(n²) complexity - consider optimization',
          filePath,
          undefined,
          6,
          0.12
        )
      )
    }

    return items
  }

  private createDebtItem(
    type: TechnicalDebtItem['type'],
    severity: TechnicalDebtItem['severity'],
    description: string,
    file: string,
    line?: number,
    estimatedFixTime?: number,
    interestRate?: number
  ): TechnicalDebtItem {
    return {
      id: `${file}-${line || 0}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      description,
      location: {
        file,
        ...(line !== undefined && { line }),
        ...(this.extractFunctionNameAtLine(file, line) !== undefined && {
          function: this.extractFunctionNameAtLine(file, line)!,
        }),
        ...(this.extractClassNameAtLine(file, line) !== undefined && {
          class: this.extractClassNameAtLine(file, line)!,
        }),
      },
      estimatedFixTime: estimatedFixTime || this.getDefaultFixTime(type, severity),
      interestRate: interestRate || this.interestRates[type],
      principal: this.calculatePrincipal(type, severity),
      impact: this.calculateImpact(type, severity),
      priority: this.calculatePriority(type, severity),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private getDefaultFixTime(
    type: TechnicalDebtItem['type'],
    severity: TechnicalDebtItem['severity']
  ): number {
    const baseTimes = {
      code_smell: 2,
      design_issue: 4,
      bug: 3,
      vulnerability: 8,
      performance_issue: 5,
    }

    const severityMultipliers = {
      low: 0.5,
      medium: 1,
      high: 2,
      critical: 3,
    }

    return baseTimes[type] * severityMultipliers[severity]
  }

  private calculatePrincipal(
    type: TechnicalDebtItem['type'],
    severity: TechnicalDebtItem['severity']
  ): number {
    const basePrincipal = {
      code_smell: 50,
      design_issue: 100,
      bug: 150,
      vulnerability: 300,
      performance_issue: 120,
    }

    return basePrincipal[type] * this.severityMultipliers[severity]
  }

  private calculateImpact(
    type: TechnicalDebtItem['type'],
    severity: TechnicalDebtItem['severity']
  ) {
    const baseImpact = {
      code_smell: { maintainability: 3, performance: 1, security: 0, reliability: 1 },
      design_issue: { maintainability: 4, performance: 2, security: 1, reliability: 2 },
      bug: { maintainability: 2, performance: 2, security: 1, reliability: 4 },
      vulnerability: { maintainability: 1, performance: 1, security: 5, reliability: 3 },
      performance_issue: { maintainability: 1, performance: 5, security: 0, reliability: 2 },
    }

    const multiplier = this.severityMultipliers[severity]
    const impact = baseImpact[type]

    return {
      maintainability: impact.maintainability * multiplier,
      performance: impact.performance * multiplier,
      security: impact.security * multiplier,
      reliability: impact.reliability * multiplier,
    }
  }

  private calculatePriority(
    type: TechnicalDebtItem['type'],
    severity: TechnicalDebtItem['severity']
  ): number {
    const typePriority = {
      code_smell: 1,
      design_issue: 2,
      bug: 3,
      vulnerability: 5,
      performance_issue: 2,
    }

    const severityPriority = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 5,
    }

    return typePriority[type] * severityPriority[severity]
  }

  private calculateTotalDebt(debtItems: TechnicalDebtItem[]): number {
    return debtItems.reduce((total, item) => total + item.principal, 0)
  }

  private categorizeDebtByType(debtItems: TechnicalDebtItem[]) {
    return {
      codeSmells: debtItems.filter(item => item.type === 'code_smell').length,
      designIssues: debtItems.filter(item => item.type === 'design_issue').length,
      bugs: debtItems.filter(item => item.type === 'bug').length,
      vulnerabilities: debtItems.filter(item => item.type === 'vulnerability').length,
      performanceIssues: debtItems.filter(item => item.type === 'performance_issue').length,
    }
  }

  private categorizeDebtBySeverity(debtItems: TechnicalDebtItem[]) {
    return {
      low: debtItems.filter(item => item.severity === 'low').length,
      medium: debtItems.filter(item => item.severity === 'medium').length,
      high: debtItems.filter(item => item.severity === 'high').length,
      critical: debtItems.filter(item => item.severity === 'critical').length,
    }
  }

  private calculateDebtRatio(debtItems: TechnicalDebtItem[], code: string): number {
    const totalLines = code.split('\n').length
    const totalDebt = this.calculateTotalDebt(debtItems)

    return Math.round((totalDebt / totalLines) * 100 * 100) / 100
  }

  private estimatePayoffTime(debtItems: TechnicalDebtItem[]): number {
    const totalFixTime = debtItems.reduce((total, item) => total + item.estimatedFixTime, 0)

    // Assuming 20 hours per month for debt repayment
    return Math.ceil(totalFixTime / 20)
  }

  private calculateMonthlyInterest(debtItems: TechnicalDebtItem[]): number {
    return debtItems.reduce((total, item) => {
      return total + item.principal * item.interestRate
    }, 0)
  }

  private identifyPriorityItems(debtItems: TechnicalDebtItem[]): TechnicalDebtItem[] {
    return debtItems
      .filter(item => item.severity === 'critical' || item.severity === 'high')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
  }

  private generateDebtRecommendations(
    debtItems: TechnicalDebtItem[],
    _code: string,
    _language: string
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = []

    // Critical issues recommendation
    const criticalIssues = debtItems.filter(item => item.severity === 'critical')
    if (criticalIssues.length > 0) {
      recommendations.push({
        id: `critical-fixes-${Date.now()}`,
        type: 'refactor',
        priority: 'critical',
        title: 'Address Critical Issues Immediately',
        description: `Found ${criticalIssues.length} critical issues that require immediate attention to prevent security vulnerabilities and system failures.`,
        impact: {
          qualityScore: 20,
          maintainability: 15,
          performance: 10,
          security: 25,
        },
        estimatedEffort: criticalIssues.reduce((total, item) => total + item.estimatedFixTime, 0),
        filesAffected: [...new Set(criticalIssues.map(item => item.location.file))],
        category: 'security',
        createdAt: new Date(),
      })
    }

    // Security recommendation
    const securityIssues = debtItems.filter(item => item.type === 'vulnerability')
    if (securityIssues.length > 0) {
      recommendations.push({
        id: `security-audit-${Date.now()}`,
        type: 'security',
        priority: 'high',
        title: 'Conduct Security Audit',
        description: `Found ${securityIssues.length} security vulnerabilities that need to be addressed to protect against potential attacks.`,
        impact: {
          qualityScore: 15,
          maintainability: 5,
          performance: 5,
          security: 30,
        },
        estimatedEffort: securityIssues.reduce((total, item) => total + item.estimatedFixTime, 0),
        filesAffected: [...new Set(securityIssues.map(item => item.location.file))],
        category: 'security',
        createdAt: new Date(),
      })
    }

    // Performance optimization
    const performanceIssues = debtItems.filter(item => item.type === 'performance_issue')
    if (performanceIssues.length > 0) {
      recommendations.push({
        id: `performance-optimization-${Date.now()}`,
        type: 'optimization',
        priority: 'medium',
        title: 'Optimize Performance Issues',
        description: `Found ${performanceIssues.length} performance issues that can be optimized to improve system responsiveness.`,
        impact: {
          qualityScore: 10,
          maintainability: 5,
          performance: 20,
          security: 0,
        },
        estimatedEffort: performanceIssues.reduce(
          (total, item) => total + item.estimatedFixTime,
          0
        ),
        filesAffected: [...new Set(performanceIssues.map(item => item.location.file))],
        category: 'performance',
        createdAt: new Date(),
      })
    }

    // Code quality improvement
    const codeSmells = debtItems.filter(item => item.type === 'code_smell')
    if (codeSmells.length > 0) {
      recommendations.push({
        id: `code-quality-${Date.now()}`,
        type: 'refactor',
        priority: 'low',
        title: 'Improve Code Quality',
        description: `Found ${codeSmells.length} code smells that should be addressed to improve maintainability and readability.`,
        impact: {
          qualityScore: 8,
          maintainability: 15,
          performance: 2,
          security: 0,
        },
        estimatedEffort: codeSmells.reduce((total, item) => total + item.estimatedFixTime, 0),
        filesAffected: [...new Set(codeSmells.map(item => item.location.file))],
        category: 'maintainability',
        createdAt: new Date(),
      })
    }

    return recommendations
  }

  private assessDebtRisk(
    debtItems: TechnicalDebtItem[],
    _qualityMetrics: QualityMetrics
  ): {
    overall: 'low' | 'medium' | 'high'
    maintainability: 'low' | 'medium' | 'high'
    performance: 'low' | 'medium' | 'high'
    security: 'low' | 'medium' | 'high'
    reliability: 'low' | 'medium' | 'high'
  } {
    const criticalCount = debtItems.filter(item => item.severity === 'critical').length
    const vulnerabilityCount = debtItems.filter(item => item.type === 'vulnerability').length
    const totalDebt = this.calculateTotalDebt(debtItems)
    const debtRatio = this.calculateDebtRatio(debtItems, '')

    // Overall risk assessment
    let overallRisk: 'low' | 'medium' | 'high' = 'low'
    if (criticalCount > 2 || vulnerabilityCount > 1 || totalDebt > 1000 || debtRatio > 15) {
      overallRisk = 'high'
    } else if (criticalCount > 0 || vulnerabilityCount > 0 || totalDebt > 500 || debtRatio > 8) {
      overallRisk = 'medium'
    }

    // Individual risk assessments
    const maintainabilityRisk = debtItems.some(item => item.impact.maintainability > 10)
      ? 'high'
      : debtItems.some(item => item.impact.maintainability > 5)
        ? 'medium'
        : 'low'

    const performanceRisk = debtItems.some(item => item.impact.performance > 10)
      ? 'high'
      : debtItems.some(item => item.impact.performance > 5)
        ? 'medium'
        : 'low'

    const securityRisk = vulnerabilityCount > 1 ? 'high' : vulnerabilityCount > 0 ? 'medium' : 'low'

    const reliabilityRisk = debtItems.some(item => item.impact.reliability > 10)
      ? 'high'
      : debtItems.some(item => item.impact.reliability > 5)
        ? 'medium'
        : 'low'

    return {
      overall: overallRisk,
      maintainability: maintainabilityRisk,
      performance: performanceRisk,
      security: securityRisk,
      reliability: reliabilityRisk,
    }
  }

  // Helper methods for extracting code structure
  private extractFunctions(
    code: string,
    language: string
  ): Array<{ name: string; line: number; complexity: number }> {
    // Simplified function extraction
    const functions: Array<{ name: string; line: number; complexity: number }> = []

    const functionPattern = {
      python: /\bdef\s+(\w+)\b/g,
      javascript: /\bfunction\s+(\w+)\b/g,
      typescript: /\bfunction\s+(\w+)\b/g,
      java: /\b(public|private|protected)\s+.*?\s+(\w+)\s*\([^)]*\)\s*{/g,
      go: /\bfunc\s+(\w+)\b/g,
      cpp: /\b\w+\s+(\w+)\s*\([^)]*\)\s*{/g,
      rust: /\bfn\s+(\w+)\b/g,
      ruby: /\bdef\s+(\w+)\b/g,
      php: /\bfunction\s+(\w+)\b/g,
    }

    const pattern =
      functionPattern[language as keyof typeof functionPattern] || /\bfunction\s+(\w+)\b/g
    let match

    while ((match = pattern.exec(code)) !== null) {
      const name = match[1] || match[2]
      const line = code.substring(0, match.index).split('\n').length
      const complexity = this.estimateFunctionComplexity(code, match.index)

      functions.push({ name, line, complexity })
    }

    return functions
  }

  private extractClasses(
    _code: string,
    _language: string
  ): Array<{ name: string; line: number; lines: number }> {
    // Simplified class extraction
    const classes: Array<{ name: string; line: number; lines: number }> = []

    const classPattern = {
      python: /\bclass\s+(\w+)\b/g,
      javascript: /\bclass\s+(\w+)\b/g,
      typescript: /\bclass\s+(\w+)\b/g,
      java: /\bclass\s+(\w+)\b/g,
      go: /\btype\s+(\w+)\s+struct\b/g,
      cpp: /\bclass\s+(\w+)\b/g,
      rust: /\bstruct\s+(\w+)\b/g,
      ruby: /\bclass\s+(\w+)\b/g,
      php: /\bclass\s+(\w+)\b/g,
    }

    const pattern = classPattern[_language as keyof typeof classPattern] || /\bclass\s+(\w+)\b/g
    let match

    while ((match = pattern.exec(_code)) !== null) {
      const name = match[1]
      const line = _code.substring(0, match.index).split('\n').length
      const lines = this.estimateClassLines(_code, match.index)

      classes.push({ name, line, lines })
    }

    return classes
  }

  private estimateFunctionComplexity(code: string, startIndex: number): number {
    // Simplified complexity estimation
    const functionCode = this.extractFunctionCode(code, startIndex)
    const complexityKeywords =
      functionCode.match(/\b(if|else if|for|while|switch|case|catch|try)\b/g) || []

    return complexityKeywords.length + 1 // Base complexity of 1
  }

  private extractFunctionCode(code: string, startIndex: number): string {
    // Simplified function code extraction
    let braceCount = 0
    let endIndex = startIndex

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i]
      if (char === '{') braceCount++
      if (char === '}') braceCount--
      if (braceCount === 0 && i > startIndex) {
        endIndex = i
        break
      }
    }

    return code.substring(startIndex, endIndex + 1)
  }

  private estimateClassLines(code: string, startIndex: number): number {
    // Simplified class line estimation
    let braceCount = 0
    let endIndex = startIndex

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i]
      if (char === '{') braceCount++
      if (char === '}') braceCount--
      if (braceCount === 0 && i > startIndex) {
        endIndex = i
        break
      }
    }

    return code.substring(startIndex, endIndex + 1).split('\n').length
  }

  private extractFunctionNameAtLine(_file: string, _line?: number): string | undefined {
    // Simplified - would need more sophisticated analysis
    return undefined
  }

  private extractClassNameAtLine(_file: string, _line?: number): string | undefined {
    // Simplified - would need more sophisticated analysis
    return undefined
  }

  async analyzeDebtTrend(
    historicalData: Array<{
      date: Date
      debtItems: TechnicalDebtItem[]
      code: string
    }>
  ): Promise<DebtTrend> {
    const debtHistory = historicalData.map(data => ({
      date: data.date,
      totalDebt: this.calculateTotalDebt(data.debtItems),
      debtRatio: this.calculateDebtRatio(data.debtItems, data.code),
      itemCount: data.debtItems.length,
    }))

    const trend = this.calculateTrend(debtHistory.map(d => d.totalDebt))
    const projectedDebt = this.projectDebt(debtHistory)
    const riskProjection = this.assessProjectedRisk(projectedDebt)

    return {
      period: `${historicalData[0]?.date.toISOString()} to ${historicalData[historicalData.length - 1]?.date.toISOString()}`,
      debtHistory,
      trend,
      projectedDebt,
      riskProjection,
    }
  }

  private calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (values.length < 2) return 'stable'

    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    const change = ((secondAvg - firstAvg) / firstAvg) * 100

    if (change > 5) return 'increasing'
    if (change < -5) return 'decreasing'
    return 'stable'
  }

  private projectDebt(debtHistory: Array<{ date: Date; totalDebt: number }>) {
    const latestDebt = debtHistory[debtHistory.length - 1]?.totalDebt || 0
    const trend = this.calculateTrend(debtHistory.map(d => d.totalDebt))

    const monthlyChange = trend === 'increasing' ? 0.05 : trend === 'decreasing' ? -0.03 : 0

    return {
      nextMonth: latestDebt * (1 + monthlyChange),
      nextQuarter: latestDebt * Math.pow(1 + monthlyChange, 3),
      nextYear: latestDebt * Math.pow(1 + monthlyChange, 12),
    }
  }

  private assessProjectedRisk(projectedDebt: any): 'low' | 'medium' | 'high' {
    if (projectedDebt.nextYear > 2000) return 'high'
    if (projectedDebt.nextYear > 1000) return 'medium'
    return 'low'
  }
}
