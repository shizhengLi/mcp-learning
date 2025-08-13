export interface TestingConfig {
  testFrameworks?: string[]
  coverageTools?: string[]
  performanceTools?: string[]
  debugAssistants?: string[]
  autoGenerateTests?: boolean
  parallelTesting?: boolean
  coverageThreshold?: number
  maxTestExecutionTime?: number
  enablePerformanceProfiling?: boolean
  enableMemoryAnalysis?: boolean
  enableErrorSimulation?: boolean
  enableCoverageReporting?: boolean
  enableTestOptimization?: boolean
  enableDebugAssistance?: boolean
  enableBenchmarking?: boolean
  enableTrendAnalysis?: boolean
  enableRecommendations?: boolean
  enableReporting?: boolean
  enableAlerting?: boolean
  enableIntegration?: boolean
  enableCustomization?: boolean
  enableExtensions?: boolean
  enablePlugins?: boolean
  enableHooks?: boolean
  enableMiddleware?: boolean
  enableInterceptors?: boolean
  enableDecorators?: boolean
  enableAnnotations?: boolean
  enableMetadata?: boolean
  enableValidation?: boolean
  enableSanitization?: boolean
  enableNormalization?: boolean
  enableTransformation?: boolean
  enableSerialization?: boolean
  enableDeserialization?: boolean
  enableCompression?: boolean
  enableEncryption?: boolean
  enableDecryption?: boolean
  enableHashing?: boolean
  enableSigning?: boolean
  enableVerification?: boolean
  enableAuthentication?: boolean
  enableAuthorization?: boolean
  enableRateLimiting?: boolean
  enableThrottling?: boolean
  enableCaching?: boolean
  enableQueueing?: boolean
  enableBroadcasting?: boolean
  enableStreaming?: boolean
  enablePolling?: boolean
  enableWebSockets?: boolean
  enableHTTP?: boolean
  enableHTTPS?: boolean
  enableTCP?: boolean
  enableUDP?: boolean
  enableIPC?: boolean
  enableRPC?: boolean
  enableREST?: boolean
  enableGraphQL?: boolean
  enableSOAP?: boolean
  enableXML?: boolean
  enableJSON?: boolean
  enableCSV?: boolean
  enableYAML?: boolean
  enableTOML?: boolean
  enableINI?: boolean
  enableENV?: boolean
  enableConfig?: boolean
  enableSettings?: boolean
  enablePreferences?: boolean
  enableOptions?: boolean
  enableFlags?: boolean
  enableArguments?: boolean
  enableParameters?: boolean
  enableVariables?: boolean
  enableConstants?: boolean
  enableEnums?: boolean
  enableInterfaces?: boolean
  enableClasses?: boolean
  enableFunctions?: boolean
  enableMethods?: boolean
  enableProperties?: boolean
  enableFields?: boolean
  enableAttributes?: boolean
}

export interface TestSuite {
  id: string
  name: string
  description: string
  type: 'unit' | 'integration' | 'e2e'
  framework: string
  files: string[]
  configuration: any
  metadata: {
    createdAt: string
    updatedAt: string
    version: string
    tags: string[]
  }
}

export interface TestResult {
  id: string
  suiteId: string
  name: string
  status: 'passed' | 'failed' | 'skipped' | 'pending'
  duration: number
  error?: string
  stackTrace?: string
  assertions: number
  coverage: number
  metadata: {
    executedAt: string
    environment: string
    version: string
  }
}

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags: Record<string, string>
}

export interface CoverageMetric {
  filePath: string
  totalLines: number
  coveredLines: number
  uncoveredLines: number[]
  coveragePercentage: number
  complexity: number
}

export interface DebugSession {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  target: string
  breakpoints: string[]
  variables: Record<string, any>
  callStack: any[]
  metadata: {
    createdAt: string
    updatedAt: string
    duration: number
  }
}

export interface TestReport {
  id: string
  name: string
  type: 'test' | 'coverage' | 'performance' | 'debug'
  summary: any
  details: any
  generatedAt: string
  format: 'html' | 'json' | 'xml' | 'csv'
  metadata: {
    version: string
    environment: string
    tags: string[]
  }
}