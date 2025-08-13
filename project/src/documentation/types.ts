export type DocumentationFormat = 'markdown' | 'html' | 'json' | 'pdf' | 'xml' | 'svg' | 'png' | 'mermaid';

export interface DocumentationConfig {
  outputFormats?: DocumentationFormat[];
  includeSourceCode?: boolean;
  generateAPIDocs?: boolean;
  generateDiagrams?: boolean;
  versionControlIntegration?: boolean;
  autoUpdate?: boolean;
  outputDirectory?: string;
  templateDirectory?: string;
  customTemplates?: Record<string, string>;
}

export interface DocumentationMetadata {
  id: string;
  title: string;
  description: string;
  type: 'project' | 'api' | 'code' | 'diagram';
  format: DocumentationFormat;
  version: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  dependencies?: string[];
}

export interface ProjectDocumentation {
  metadata: DocumentationMetadata;
  overview: {
    name: string;
    description: string;
    version: string;
    technologies: string[];
    architecture: string;
  };
  structure: {
    directories: string[];
    files: DocumentationFile[];
    dependencies: ProjectDependency[];
  };
  api?: APIDocumentation;
  code: CodeDocumentation[];
  diagrams?: DiagramDocumentation[];
  setup: {
    installation: string[];
    configuration: Record<string, any>;
    environment: string[];
  };
  testing: {
    frameworks: string[];
    commands: string[];
    coverage?: number;
  };
  deployment: {
    platforms: string[];
    scripts: string[];
    configuration: Record<string, any>;
  };
  files?: DocumentationFile[];
}

export interface APIDocumentation {
  metadata: DocumentationMetadata;
  endpoints: APIEndpoint[];
  schemas: APISchema[];
  authentication: APIAuthentication[];
  examples: APIExample[];
  errors: APIError[];
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  description: string;
  parameters: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  tags: string[];
  security?: string[];
  examples?: APIExample[];
}

export interface APIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description: string;
  example?: any;
  default?: any;
  validation?: APIValidation[];
}

export interface APIRequestBody {
  contentType: string;
  schema: any;
  description: string;
  required: boolean;
  example?: any;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
  headers?: Record<string, APIParameter>;
}

export interface APISchema {
  name: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'integer';
  description: string;
  properties?: Record<string, any>;
  required?: string[];
  example?: any;
}

export interface APIAuthentication {
  type: 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
  description: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface APIExample {
  title: string;
  description: string;
  request: any;
  response: any;
  curl?: string;
}

export interface APIError {
  code: number;
  message: string;
  description: string;
  causes?: string[];
  solutions?: string[];
}

export interface APIValidation {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'custom';
  value: any;
  message: string;
}

export interface CodeDocumentation {
  metadata: DocumentationMetadata;
  filePath: string;
  language: string;
  description: string;
  functions: FunctionDocumentation[];
  classes: ClassDocumentation[];
  interfaces: InterfaceDocumentation[];
  types: TypeDocumentation[];
  constants: ConstantDocumentation[];
  examples: CodeExample[];
  dependencies: string[];
  imports: string[];
  exports: string[];
}

export interface FunctionDocumentation {
  name: string;
  description: string;
  parameters: ParameterDocumentation[];
  returnType: TypeDocumentation;
  throws?: ErrorDocumentation[];
  examples: CodeExample[];
  deprecated?: boolean;
  since?: string;
  seeAlso?: string[];
}

export interface ClassDocumentation {
  name: string;
  description: string;
  extends?: string;
  implements?: string[];
  properties: PropertyDocumentation[];
  methods: FunctionDocumentation[];
  constructors: FunctionDocumentation[];
  staticMethods: FunctionDocumentation[];
  decorators?: DecoratorDocumentation[];
  examples: CodeExample[];
  deprecated?: boolean;
  since?: string;
}

export interface InterfaceDocumentation {
  name: string;
  description: string;
  extends?: string[];
  properties: PropertyDocumentation[];
  methods: FunctionDocumentation[];
  examples: CodeExample[];
  since?: string;
}

export interface TypeDocumentation {
  name: string;
  type: string;
  description: string;
  genericTypes?: TypeDocumentation[];
  constraints?: string[];
  example?: any;
}

export interface ParameterDocumentation {
  name: string;
  type: TypeDocumentation;
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: APIValidation[];
}

export interface PropertyDocumentation {
  name: string;
  type: TypeDocumentation;
  description: string;
  access: 'public' | 'private' | 'protected';
  static: boolean;
  readonly: boolean;
  defaultValue?: any;
  deprecated?: boolean;
}

export interface ConstantDocumentation {
  name: string;
  type: TypeDocumentation;
  value: any;
  description: string;
  deprecated?: boolean;
}

export interface ErrorDocumentation {
  type: string;
  description: string;
  conditions: string[];
}

export interface DecoratorDocumentation {
  name: string;
  description: string;
  parameters: ParameterDocumentation[];
}

export interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: string;
  output?: string;
  expected?: string;
}

export interface DiagramDocumentation {
  metadata: DocumentationMetadata;
  type: 'component' | 'deployment' | 'sequence' | 'class' | 'flowchart' | 'entity' | 'diagram';
  format: DocumentationFormat;
  content: string;
  description: string;
  elements: DiagramElement[];
  relationships: DiagramRelationship[];
  path?: string;
}

export interface DiagramElement {
  id: string;
  name: string;
  type: string;
  description?: string;
  properties: Record<string, any>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface DiagramRelationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
  properties: Record<string, any>;
}

export interface DocumentationFile {
  path: string;
  type: 'source' | 'test' | 'config' | 'documentation' | 'asset';
  language?: string;
  size: number;
  lastModified: string;
  description?: string;
  coverage?: number;
  complexity?: number;
}

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer' | 'optional';
  license?: string;
  description?: string;
  homepage?: string;
  repository?: string;
}

export interface DocumentationVersion {
  id: string;
  version: string;
  timestamp: string;
  author: string;
  message: string;
  changes: DocumentationChange[];
  files: string[];
  size: number;
}

export interface DocumentationChange {
  type: 'added' | 'modified' | 'deleted';
  path: string;
  description: string;
  diff?: string;
  metadata?: Record<string, any>;
}

export interface DocumentationComparison {
  version1: string;
  version2: string;
  timestamp: string;
  changes: {
    added: DocumentationFile[];
    modified: DocumentationFile[];
    deleted: DocumentationFile[];
  };
  summary: {
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    linesAdded: number;
    linesDeleted: number;
  };
}

export interface ExportOptions {
  format: 'zip' | 'tar' | 'pdf';
  includeSource?: boolean;
  includeDiagrams?: boolean;
  includeTests?: boolean;
  compression?: 'none' | 'fast' | 'best';
  password?: string;
}