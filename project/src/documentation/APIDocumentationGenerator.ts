import * as fs from 'fs/promises';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { 
  APIDocumentation, 
  DocumentationFormat, 
  APIEndpoint,
  APISchema,
  APIAuthentication,
  APIExample,
  APIError,
  APIParameter,
  APIResponse
} from './types';

export class APIDocumentationGenerator {
  // Cache properties for future use
  // private commentCache: Map<string, any> = new Map();
  // private endpointCache: Map<string, APIEndpoint[]> = new Map();

  async generateAPIDocumentation(
    apiPath: string,
    format: DocumentationFormat = 'markdown',
    includeExamples: boolean = true,
    outputPath?: string
  ): Promise<APIDocumentation> {
    Logger.info(`Generating API documentation for: ${apiPath}`);

    const endpoints = await this.extractEndpoints(apiPath);
    const schemas = await this.extractSchemas(apiPath);
    const authentication = await this.extractAuthentication(apiPath);
    const examples = includeExamples ? await this.generateExamples(endpoints) : [];
    const errors = await this.extractErrors(apiPath);

    const apiDocs: APIDocumentation = {
      metadata: {
        id: `api-${path.basename(apiPath)}-${Date.now()}`,
        title: `${path.basename(apiPath)} API Documentation`,
        description: `API documentation for ${apiPath}`,
        type: 'api',
        format,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['api', 'documentation'],
      },
      endpoints,
      schemas,
      authentication,
      examples,
      errors,
    };

    // Export in requested format
    await this.exportAPIDocumentation(apiDocs, format, outputPath);

    return apiDocs;
  }

  private async extractEndpoints(apiPath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    if (await this.isDirectory(apiPath)) {
      const files = await this.getAPIFiles(apiPath);
      for (const file of files) {
        const fileEndpoints = await this.extractEndpointsFromFile(file);
        endpoints.push(...fileEndpoints);
      }
    } else {
      const fileEndpoints = await this.extractEndpointsFromFile(apiPath);
      endpoints.push(...fileEndpoints);
    }

    return endpoints;
  }

  private async extractEndpointsFromFile(filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const language = this.inferLanguage(path.extname(filePath));

      switch (language) {
        case 'JavaScript':
        case 'TypeScript':
          endpoints.push(...await this.extractJSEndpoints(content, filePath));
          break;
        case 'Python':
          endpoints.push(...await this.extractPythonEndpoints(content, filePath));
          break;
        case 'Java':
          endpoints.push(...await this.extractJavaEndpoints(content, filePath));
          break;
        default:
          Logger.warn(`Unsupported language for API extraction: ${language}`);
      }
    } catch (error) {
      Logger.error(`Failed to extract endpoints from ${filePath}: ${error}`);
    }

    return endpoints;
  }

  private async extractJSEndpoints(content: string, _filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    // Extract Express.js style endpoints
    const expressPatterns = [
      /app\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /router\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    for (const pattern of expressPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toUpperCase() as APIEndpoint['method'];
        const path = match[2];
        
        const endpoint: APIEndpoint = {
          path,
          method,
          description: await this.extractJSDocDescription(content, match.index),
          parameters: await this.extractJSParameters(content, match.index),
          responses: await this.extractJSResponses(content, match.index),
          tags: await this.extractJSTags(content, match.index),
          examples: [],
        };

        endpoints.push(endpoint);
      }
    }

    // Extract Fastify style endpoints
    const fastifyPattern = /fastify\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = fastifyPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase() as APIEndpoint['method'];
      const path = match[2];
      
      const endpoint: APIEndpoint = {
        path,
        method,
        description: await this.extractJSDocDescription(content, match.index),
        parameters: await this.extractJSParameters(content, match.index),
        responses: await this.extractJSResponses(content, match.index),
        tags: await this.extractJSTags(content, match.index),
        examples: [],
      };

      endpoints.push(endpoint);
    }

    return endpoints;
  }

  private async extractPythonEndpoints(content: string, _filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    // Extract Flask style endpoints
    const flaskPatterns = [
      /@app\.route\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /@bp\.route\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    for (const pattern of flaskPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[1];
        const methods = this.extractFlaskMethods(content, match.index);
        
        for (const method of methods) {
          const endpoint: APIEndpoint = {
            path,
            method: method as APIEndpoint['method'],
            description: await this.extractPythonDocstring(content, match.index),
            parameters: await this.extractPythonParameters(content, match.index),
            responses: await this.extractPythonResponses(content, match.index),
            tags: await this.extractPythonTags(content, match.index),
            examples: [],
          };

          endpoints.push(endpoint);
        }
      }
    }

    // Extract FastAPI style endpoints
    const fastapiPattern = /@app\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let fastapiMatch;
    while ((fastapiMatch = fastapiPattern.exec(content)) !== null) {
      const method = fastapiMatch[1].toUpperCase() as APIEndpoint['method'];
      const path = fastapiMatch[2];
      
      const endpoint: APIEndpoint = {
        path,
        method,
        description: await this.extractPythonDocstring(content, fastapiMatch.index),
        parameters: await this.extractFastAPIParameters(content, fastapiMatch.index),
        responses: await this.extractFastAPIResponses(content, fastapiMatch.index),
        tags: await this.extractPythonTags(content, fastapiMatch.index),
        examples: [],
      };

      endpoints.push(endpoint);
    }

    return endpoints;
  }

  private async extractJavaEndpoints(content: string, _filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    // Extract Spring Boot style endpoints
    const springPatterns = [
      /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*["']([^"']+)["']\s*\)/g,
    ];

    for (const pattern of springPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const annotation = match[1];
        const path = match[2];
        
        let method: APIEndpoint['method'];
        switch (annotation) {
          case 'GetMapping': method = 'GET'; break;
          case 'PostMapping': method = 'POST'; break;
          case 'PutMapping': method = 'PUT'; break;
          case 'DeleteMapping': method = 'DELETE'; break;
          case 'PatchMapping': method = 'PATCH'; break;
          case 'RequestMapping': method = 'GET'; break; // Default, should check method parameter
          default: method = 'GET';
        }
        
        const endpoint: APIEndpoint = {
          path,
          method,
          description: await this.extractJavaDoc(content, match.index),
          parameters: await this.extractJavaParameters(content, match.index),
          responses: await this.extractJavaResponses(content, match.index),
          tags: await this.extractJavaTags(content, match.index),
          examples: [],
        };

        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  private extractFlaskMethods(content: string, index: number): string[] {
    const methodPattern = /methods\s*=\s*\[([^\]]+)\]/;
    const nearbyContent = content.substring(Math.max(0, index - 200), index + 200);
    const match = methodPattern.exec(nearbyContent);
    
    if (match) {
      return match[1].split(',').map(m => m.trim().replace(/['"]/g, '').toUpperCase());
    }
    
    return ['GET']; // Default
  }

  private async extractJSDocDescription(content: string, index: number): Promise<string> {
    const nearbyContent = content.substring(Math.max(0, index - 500), index);
    const jsdocPattern = /\/\*\*[\s\S]*?\*\//;
    const match = jsdocPattern.exec(nearbyContent);
    
    if (match) {
      const lines = match[0].split('\n');
      const description = lines
        .slice(1, -1)
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line && !line.startsWith('@'))
        .join(' ');
      
      return description;
    }
    
    return 'No description available';
  }

  private async extractPythonDocstring(content: string, index: number): Promise<string> {
    const nearbyContent = content.substring(Math.max(0, index - 500), index + 500);
    const docstringPattern = /"""([\s\S]*?)"""/;
    const match = docstringPattern.exec(nearbyContent);
    
    if (match) {
      return match[1].trim();
    }
    
    return 'No description available';
  }

  private async extractJavaDoc(content: string, index: number): Promise<string> {
    const nearbyContent = content.substring(Math.max(0, index - 500), index);
    const javadocPattern = /\/\*\*[\s\S]*?\*\//;
    const match = javadocPattern.exec(nearbyContent);
    
    if (match) {
      const lines = match[0].split('\n');
      const description = lines
        .slice(1, -1)
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line && !line.startsWith('@'))
        .join(' ');
      
      return description;
    }
    
    return 'No description available';
  }

  private async extractJSParameters(content: string, index: number): Promise<APIParameter[]> {
    const parameters: APIParameter[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract path parameters from route pattern
    const pathParamPattern = /:([^\/]+)/g;
    const pathMatch = nearbyContent.match(pathParamPattern);
    if (pathMatch) {
      for (const param of pathMatch) {
        const paramName = param.substring(1);
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          type: 'string',
          description: `Path parameter: ${paramName}`,
        });
      }
    }
    
    // Extract query parameters from JSDoc
    const jsdocParamPattern = /@param\s+\{([^}]+)\}\s+(\w+)\s+-\s+([^\n]+)/g;
    let paramMatch;
    while ((paramMatch = jsdocParamPattern.exec(nearbyContent)) !== null) {
      parameters.push({
        name: paramMatch[2],
        in: 'query',
        required: false,
        type: paramMatch[1],
        description: paramMatch[3],
      });
    }
    
    return parameters;
  }

  private async extractPythonParameters(content: string, index: number): Promise<APIParameter[]> {
    const parameters: APIParameter[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract path parameters from route pattern
    const pathParamPattern = /<([^>]+)>/g;
    const pathMatch = nearbyContent.match(pathParamPattern);
    if (pathMatch) {
      for (const param of pathMatch) {
        const paramName = param.substring(1, param.length - 1);
        const [paramType, paramNameOnly] = paramName.split(':');
        parameters.push({
          name: paramNameOnly || paramType,
          in: 'path',
          required: true,
          type: this.mapPythonType(paramType),
          description: `Path parameter: ${paramNameOnly || paramType}`,
        });
      }
    }
    
    return parameters;
  }

  private async extractFastAPIParameters(content: string, index: number): Promise<APIParameter[]> {
    const parameters: APIParameter[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract parameters from FastAPI function signature
    const funcPattern = /async def\s+\w+\s*\(([^)]+)\)/;
    const funcMatch = funcPattern.exec(nearbyContent);
    
    if (funcMatch) {
      const params = funcMatch[1].split(',').map(p => p.trim());
      for (const param of params) {
        if (param && !param.startsWith('self') && !param.startsWith('request')) {
          const [paramName, paramType] = param.split(':').map(p => p.trim());
          if (paramName) {
            parameters.push({
              name: paramName,
              in: 'query',
              required: !param.includes('='),
              type: this.mapPythonType(paramType),
              description: `Query parameter: ${paramName}`,
            });
          }
        }
      }
    }
    
    return parameters;
  }

  private async extractJavaParameters(content: string, index: number): Promise<APIParameter[]> {
    const parameters: APIParameter[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract path parameters from @PathVariable
    const pathVarPattern = /@PathVariable\s+(\w+)\s+(\w+)/g;
    let pathMatch;
    while ((pathMatch = pathVarPattern.exec(nearbyContent)) !== null) {
      parameters.push({
        name: pathMatch[2],
        in: 'path',
        required: true,
        type: this.mapJavaType(pathMatch[1]),
        description: `Path parameter: ${pathMatch[2]}`,
      });
    }
    
    // Extract query parameters from @RequestParam
    const requestParamPattern = /@RequestParam\s*(?:\([^)]+\))?\s+(\w+)\s+(\w+)/g;
    let reqMatch;
    while ((reqMatch = requestParamPattern.exec(nearbyContent)) !== null) {
      parameters.push({
        name: reqMatch[2],
        in: 'query',
        required: !reqMatch[0].includes('required = false'),
        type: this.mapJavaType(reqMatch[1]),
        description: `Query parameter: ${reqMatch[2]}`,
      });
    }
    
    return parameters;
  }

  private async extractJSResponses(content: string, index: number): Promise<APIResponse[]> {
    const responses: APIResponse[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract response codes from JSDoc
    const responsePattern = /@returns\s+\{([^}]+)\}\s+-\s+([^\n]+)/g;
    let match;
    while ((match = responsePattern.exec(nearbyContent)) !== null) {
      responses.push({
        statusCode: 200, // Default
        description: match[2],
        contentType: 'application/json',
        schema: { type: match[1] },
      });
    }
    
    if (responses.length === 0) {
      responses.push({
        statusCode: 200,
        description: 'Successful response',
        contentType: 'application/json',
      });
    }
    
    return responses;
  }

  private async extractPythonResponses(_content: string, _index: number): Promise<APIResponse[]> {
    const responses: APIResponse[] = [];
    
    // For Python, we'll add a default response
    responses.push({
      statusCode: 200,
      description: 'Successful response',
      contentType: 'application/json',
    });
    
    return responses;
  }

  private async extractFastAPIResponses(content: string, index: number): Promise<APIResponse[]> {
    const responses: APIResponse[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract response models from FastAPI
    const responsePattern = /response_model\s*=\s*(\w+)/g;
    let match;
    while ((match = responsePattern.exec(nearbyContent)) !== null) {
      responses.push({
        statusCode: 200,
        description: `Response model: ${match[1]}`,
        contentType: 'application/json',
        schema: { '$ref': `#/components/schemas/${match[1]}` },
      });
    }
    
    if (responses.length === 0) {
      responses.push({
        statusCode: 200,
        description: 'Successful response',
        contentType: 'application/json',
      });
    }
    
    return responses;
  }

  private async extractJavaResponses(content: string, index: number): Promise<APIResponse[]> {
    const responses: APIResponse[] = [];
    const nearbyContent = content.substring(Math.max(0, index - 300), index + 300);
    
    // Extract response status from @ResponseStatus
    const statusPattern = /@ResponseStatus\s*\(\s*value\s*=\s*HttpStatus\.(\w+)\s*\)/g;
    let match;
    while ((match = statusPattern.exec(nearbyContent)) !== null) {
      const statusCode = this.mapHttpStatus(match[1]);
      responses.push({
        statusCode,
        description: `${match[1]} response`,
        contentType: 'application/json',
      });
    }
    
    if (responses.length === 0) {
      responses.push({
        statusCode: 200,
        description: 'Successful response',
        contentType: 'application/json',
      });
    }
    
    return responses;
  }

  private async extractJSTags(content: string, index: number): Promise<string[]> {
    const nearbyContent = content.substring(Math.max(0, index - 200), index);
    const tagPattern = /@tags?\s+([^\n]+)/g;
    const match = tagPattern.exec(nearbyContent);
    
    if (match) {
      return match[1].split(',').map(tag => tag.trim());
    }
    
    return [];
  }

  private async extractPythonTags(content: string, index: number): Promise<string[]> {
    const nearbyContent = content.substring(Math.max(0, index - 200), index);
    const tagPattern = /tags\s*=\s*\[([^\]]+)\]/;
    const match = tagPattern.exec(nearbyContent);
    
    if (match) {
      return match[1].split(',').map(tag => tag.trim().replace(/['"]/g, ''));
    }
    
    return [];
  }

  private async extractJavaTags(content: string, index: number): Promise<string[]> {
    const nearbyContent = content.substring(Math.max(0, index - 200), index);
    const tagPattern = /@Tag\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)/;
    const match = tagPattern.exec(nearbyContent);
    
    if (match) {
      return [match[1]];
    }
    
    return [];
  }

  private async extractSchemas(apiPath: string): Promise<APISchema[]> {
    const schemas: APISchema[] = [];
    
    // Look for schema/model definitions
    const files = await this.getAPIFiles(apiPath);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const language = this.inferLanguage(path.extname(file));
      
      switch (language) {
        case 'TypeScript':
          schemas.push(...await this.extractTSSchemas(content, file));
          break;
        case 'Python':
          schemas.push(...await this.extractPythonSchemas(content, file));
          break;
        case 'Java':
          schemas.push(...await this.extractJavaSchemas(content, file));
          break;
      }
    }
    
    return schemas;
  }

  private async extractTSSchemas(content: string, _filePath: string): Promise<APISchema[]> {
    const schemas: APISchema[] = [];
    
    // Extract TypeScript interfaces and types
    const interfacePattern = /interface\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    
    while ((match = interfacePattern.exec(content)) !== null) {
      const schema: APISchema = {
        name: match[1],
        type: 'object',
        description: `TypeScript interface: ${match[1]}`,
        properties: this.extractTSProperties(match[2]),
        required: this.extractTSRequiredProperties(match[2]),
      };
      
      schemas.push(schema);
    }
    
    return schemas;
  }

  private async extractPythonSchemas(content: string, _filePath: string): Promise<APISchema[]> {
    const schemas: APISchema[] = [];
    
    // Extract Pydantic models
    const pydanticPattern = /class\s+(\w+)\s*\(\s*BaseModel\s*\)\s*:\s*([^]+?)(?=\n\n|\nclass|\Z)/g;
    let match;
    
    while ((match = pydanticPattern.exec(content)) !== null) {
      const schema: APISchema = {
        name: match[1],
        type: 'object',
        description: `Pydantic model: ${match[1]}`,
        properties: this.extractPydanticProperties(match[2]),
        required: this.extractPydanticRequiredProperties(match[2]),
      };
      
      schemas.push(schema);
    }
    
    return schemas;
  }

  private async extractJavaSchemas(content: string, _filePath: string): Promise<APISchema[]> {
    const schemas: APISchema[] = [];
    
    // Extract Java classes
    const classPattern = /class\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    
    while ((match = classPattern.exec(content)) !== null) {
      const schema: APISchema = {
        name: match[1],
        type: 'object',
        description: `Java class: ${match[1]}`,
        properties: this.extractJavaProperties(match[2]),
        required: this.extractJavaRequiredProperties(match[2]),
      };
      
      schemas.push(schema);
    }
    
    return schemas;
  }

  private extractTSProperties(interfaceBody: string): Record<string, any> {
    const properties: Record<string, any> = {};
    const propertyPattern = /(\w+)\s*:\s*([^;]+);/g;
    let match;
    
    while ((match = propertyPattern.exec(interfaceBody)) !== null) {
      properties[match[1]] = {
        type: match[2].trim(),
        description: `Property: ${match[1]}`,
      };
    }
    
    return properties;
  }

  private extractTSRequiredProperties(interfaceBody: string): string[] {
    const required: string[] = [];
    const propertyPattern = /(\w+)\s*:\s*([^;]+);/g;
    let match;
    
    while ((match = propertyPattern.exec(interfaceBody)) !== null) {
      if (!match[2].includes('?')) {
        required.push(match[1]);
      }
    }
    
    return required;
  }

  private extractPydanticProperties(classBody: string): Record<string, any> {
    const properties: Record<string, any> = {};
    const propertyPattern = /(\w+)\s*:\s*([^=]+)\s*=\s*Field\(([^)]+)\)/g;
    let match;
    
    while ((match = propertyPattern.exec(classBody)) !== null) {
      properties[match[1]] = {
        type: match[2].trim(),
        description: match[3],
      };
    }
    
    return properties;
  }

  private extractPydanticRequiredProperties(classBody: string): string[] {
    const required: string[] = [];
    const propertyPattern = /(\w+)\s*:\s*([^=]+)\s*=/g;
    let match;
    
    while ((match = propertyPattern.exec(classBody)) !== null) {
      if (!match[2].includes('Optional') && !match[2].includes('Union[')) {
        required.push(match[1]);
      }
    }
    
    return required;
  }

  private extractJavaProperties(classBody: string): Record<string, any> {
    const properties: Record<string, any> = {};
    const propertyPattern = /private\s+(\w+)\s+(\w+)\s*;/g;
    let match;
    
    while ((match = propertyPattern.exec(classBody)) !== null) {
      properties[match[2]] = {
        type: match[1],
        description: `Private field: ${match[2]}`,
      };
    }
    
    return properties;
  }

  private extractJavaRequiredProperties(classBody: string): string[] {
    const required: string[] = [];
    const propertyPattern = /private\s+(\w+)\s+(\w+)\s*;/g;
    let match;
    
    while ((match = propertyPattern.exec(classBody)) !== null) {
      required.push(match[2]);
    }
    
    return required;
  }

  private async extractAuthentication(apiPath: string): Promise<APIAuthentication[]> {
    const auth: APIAuthentication[] = [];
    
    // Look for authentication configurations
    const files = await this.getAPIFiles(apiPath);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Extract JWT authentication
      if (content.includes('jwt') || content.includes('JWT')) {
        auth.push({
          type: 'bearer',
          description: 'JWT Bearer token authentication',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        });
      }
      
      // Extract API key authentication
      if (content.includes('api_key') || content.includes('apiKey')) {
        auth.push({
          type: 'apiKey',
          description: 'API key authentication',
          scheme: 'header',
        });
      }
      
      // Extract OAuth2
      if (content.includes('oauth') || content.includes('OAuth')) {
        auth.push({
          type: 'oauth2',
          description: 'OAuth2 authentication',
          flows: {
            authorizationCode: {
              authorizationUrl: '/oauth/authorize',
              tokenUrl: '/oauth/token',
              scopes: {},
            },
          },
        });
      }
    }
    
    return auth;
  }

  private async generateExamples(endpoints: APIEndpoint[]): Promise<APIExample[]> {
    const examples: APIExample[] = [];
    
    for (const endpoint of endpoints) {
      const example: APIExample = {
        title: `${endpoint.method} ${endpoint.path}`,
        description: `Example request for ${endpoint.method} ${endpoint.path}`,
        request: {
          method: endpoint.method,
          url: endpoint.path,
          headers: {},
          parameters: {},
        },
        response: {
          status: 200,
          data: {},
        },
        curl: this.generateCurlExample(endpoint),
      };
      
      examples.push(example);
    }
    
    return examples;
  }

  private generateCurlExample(endpoint: APIEndpoint): string {
    let curl = `curl -X ${endpoint.method} "${endpoint.path}"`;
    
    if (endpoint.parameters.length > 0) {
      const queryParams = endpoint.parameters
        .filter(p => p.in === 'query')
        .map(p => `${p.name}=value`)
        .join('&');
      
      if (queryParams) {
        curl += `?${queryParams}`;
      }
    }
    
    curl += ' -H "Content-Type: application/json"';
    
    return curl;
  }

  private async extractErrors(_apiPath: string): Promise<APIError[]> {
    const errors: APIError[] = [];
    
    // Common API errors
    errors.push({
      code: 400,
      message: 'Bad Request',
      description: 'The request was invalid or cannot be served',
      causes: ['Invalid parameters', 'Missing required fields'],
      solutions: ['Check request parameters', 'Ensure all required fields are provided'],
    });
    
    errors.push({
      code: 401,
      message: 'Unauthorized',
      description: 'Authentication is required and has failed or has not yet been provided',
      causes: ['Invalid authentication token', 'Expired token'],
      solutions: ['Check authentication token', 'Refresh token if expired'],
    });
    
    errors.push({
      code: 403,
      message: 'Forbidden',
      description: 'The request was valid, but the server is refusing action',
      causes: ['Insufficient permissions', 'Access denied'],
      solutions: ['Check user permissions', 'Contact administrator for access'],
    });
    
    errors.push({
      code: 404,
      message: 'Not Found',
      description: 'The requested resource could not be found',
      causes: ['Invalid endpoint', 'Resource does not exist'],
      solutions: ['Check endpoint URL', 'Verify resource exists'],
    });
    
    errors.push({
      code: 500,
      message: 'Internal Server Error',
      description: 'An unexpected condition was encountered',
      causes: ['Server error', 'Database connection failed'],
      solutions: ['Contact server administrator', 'Try again later'],
    });
    
    return errors;
  }

  private async exportAPIDocumentation(
    apiDocs: APIDocumentation,
    format: DocumentationFormat,
    outputPath?: string
  ): Promise<void> {
    const outputDir = outputPath || './docs';
    const fileName = `${apiDocs.metadata.title.replace(/\s+/g, '-')}-api.${format}`;
    const filePath = path.join(outputDir, fileName);

    await fse.ensureDir(outputDir);

    let content: string;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(apiDocs, null, 2);
        break;
      case 'markdown':
        content = this.convertAPIToMarkdown(apiDocs);
        break;
      case 'html':
        content = this.convertAPIToHTML(apiDocs);
        break;
      default:
        content = JSON.stringify(apiDocs, null, 2);
    }

    await fs.writeFile(filePath, content);
    Logger.info(`API documentation exported to: ${filePath}`);
  }

  private convertAPIToMarkdown(apiDocs: APIDocumentation): string {
    let md = `# ${apiDocs.metadata.title}\n\n`;
    md += `**Description:** ${apiDocs.metadata.description}\n\n`;
    md += `**Version:** ${apiDocs.metadata.version}\n\n`;
    md += `**Created:** ${apiDocs.metadata.createdAt}\n\n`;

    md += `## Endpoints\n\n`;
    
    for (const endpoint of apiDocs.endpoints) {
      md += `### ${endpoint.method} ${endpoint.path}\n\n`;
      md += `**Description:** ${endpoint.description}\n\n`;
      
      if (endpoint.parameters.length > 0) {
        md += `**Parameters:**\n\n`;
        for (const param of endpoint.parameters) {
          md += `- **${param.name}** (${param.in}): ${param.type} - ${param.description}\n`;
        }
        md += `\n`;
      }
      
      if (endpoint.responses.length > 0) {
        md += `**Responses:**\n\n`;
        for (const response of endpoint.responses) {
          md += `- **${response.statusCode}**: ${response.description}\n`;
        }
        md += `\n`;
      }
      
      if (endpoint.tags.length > 0) {
        md += `**Tags:** ${endpoint.tags.join(', ')}\n\n`;
      }
    }

    if (apiDocs.schemas.length > 0) {
      md += `## Schemas\n\n`;
      for (const schema of apiDocs.schemas) {
        md += `### ${schema.name}\n\n`;
        md += `**Type:** ${schema.type}\n\n`;
        md += `**Description:** ${schema.description}\n\n`;
        
        if (schema.properties) {
          md += `**Properties:**\n\n`;
          for (const [name, prop] of Object.entries(schema.properties)) {
            md += `- **${name}**: ${prop.type} - ${prop.description}\n`;
          }
          md += `\n`;
        }
      }
    }

    return md;
  }

  private convertAPIToHTML(apiDocs: APIDocumentation): string {
    const md = this.convertAPIToMarkdown(apiDocs);
    return `<html><body><pre>${md}</pre></body></html>`;
  }

  private async getAPIFiles(dirPath: string): Promise<string[]> {
    const files = await this.getAllFiles(dirPath);
    return files.filter(file => {
      const extension = path.extname(file);
      return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java'].includes(extension);
    });
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private inferLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'JSX',
      '.tsx': 'TSX',
      '.py': 'Python',
      '.java': 'Java',
    };

    return languageMap[extension] || 'Unknown';
  }

  private mapPythonType(pythonType: string): string {
    const typeMap: Record<string, string> = {
      'str': 'string',
      'int': 'integer',
      'float': 'number',
      'bool': 'boolean',
      'list': 'array',
      'dict': 'object',
    };

    return typeMap[pythonType] || 'string';
  }

  private mapJavaType(javaType: string): string {
    const typeMap: Record<string, string> = {
      'String': 'string',
      'int': 'integer',
      'Integer': 'integer',
      'double': 'number',
      'Double': 'number',
      'boolean': 'boolean',
      'Boolean': 'boolean',
      'List': 'array',
      'Map': 'object',
    };

    return typeMap[javaType] || 'string';
  }

  private mapHttpStatus(status: string): number {
    const statusMap: Record<string, number> = {
      'OK': 200,
      'CREATED': 201,
      'NO_CONTENT': 204,
      'BAD_REQUEST': 400,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'INTERNAL_SERVER_ERROR': 500,
    };

    return statusMap[status] || 200;
  }
}