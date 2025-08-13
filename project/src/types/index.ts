import { z } from 'zod';

// Core MCP Types
export interface ServerConfig {
  name: string;
  version: string;
  capabilities: ServerCapabilities;
  transport: TransportConfig;
  security?: SecurityConfig;
  metrics?: MetricsConfig;
}

export interface ServerCapabilities {
  tools?: ToolCapability[];
  resources?: ResourceCapability[];
  logging?: LoggingCapability;
}

export interface ToolCapability {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
}

export interface ResourceCapability {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface LoggingCapability {
  level: 'debug' | 'info' | 'warn' | 'error';
}

// Transport Types
export interface TransportConfig {
  type: 'stdio' | 'http' | 'sse' | 'websocket';
  options?: Record<string, any>;
}

export interface StdioTransportConfig extends TransportConfig {
  type: 'stdio';
}

export interface HttpTransportConfig extends TransportConfig {
  type: 'http';
  port: number;
  host?: string;
}

export interface SSETransportConfig extends TransportConfig {
  type: 'sse';
  port: number;
  host?: string;
}

export interface WebSocketTransportConfig extends TransportConfig {
  type: 'websocket';
  port: number;
  host?: string;
}

// Security Types
export interface SecurityConfig {
  enabled: boolean;
  jwt?: JWTConfig;
  encryption?: EncryptionConfig;
  cors?: CORSConfig;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  algorithm: string;
}

export interface EncryptionConfig {
  algorithm: string;
  key: string;
}

export interface CORSConfig {
  origin: string | string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

// Metrics Types
export interface MetricsConfig {
  enabled: boolean;
  provider: 'prometheus' | 'custom';
  port?: number;
  path?: string;
}

// Request/Response Types
export interface MCPRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
  timestamp: number;
  headers?: Record<string, string>;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: MCPError;
  timestamp: number;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Authentication Types
export interface AuthContext {
  userId: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
  context: AuthContext;
}

// Metrics Types
export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

export interface TimeRange {
  start: number;
  end: number;
}

export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface MetricData {
  timestamp: number;
  value: number;
  tags: Record<string, string>;
}

// Event Types
export interface ServerEvent {
  type: string;
  timestamp: number;
  data: any;
  source: string;
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  details: Record<string, any>;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  details?: Record<string, any>;
}