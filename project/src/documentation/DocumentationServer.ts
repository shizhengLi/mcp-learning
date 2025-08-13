import { BaseMCPServer } from '../core/BaseMCPServer';
import { Logger } from '../utils/Logger';
import { DocumentationGenerator } from './DocumentationGenerator';
import { APIDocumentationGenerator } from './APIDocumentationGenerator';
import { ArchitectureDiagramGenerator } from './ArchitectureDiagramGenerator';
import { VersionControlIntegration } from './VersionControlIntegration';
import { DocumentationConfig } from './types';
import { ServerConfig, MCPRequest, MCPResponse } from '../types';

export class DocumentationServer extends BaseMCPServer {
  private docGenerator: DocumentationGenerator;
  private apiDocGenerator: APIDocumentationGenerator;
  private diagramGenerator: ArchitectureDiagramGenerator;
  private versionControl: VersionControlIntegration;
  private docConfig: DocumentationConfig;

  constructor(config: DocumentationConfig = {}) {
    const serverConfig: ServerConfig = {
      name: 'documentation-server',
      version: '1.0.0',
      capabilities: {
        tools: [
          {
            name: 'generate-project-docs',
            description: 'Generate comprehensive project documentation',
            inputSchema: require('zod').object({
              projectPath: require('zod').string(),
              formats: require('zod').array(require('zod').enum(['markdown', 'html', 'json'])).optional(),
              includeSource: require('zod').boolean().optional(),
              outputPath: require('zod').string().optional(),
            }),
          },
          {
            name: 'generate-api-docs',
            description: 'Generate API documentation',
            inputSchema: require('zod').object({
              apiPath: require('zod').string(),
              format: require('zod').enum(['markdown', 'html', 'json']).optional(),
              includeExamples: require('zod').boolean().optional(),
              outputPath: require('zod').string().optional(),
            }),
          },
        ],
        resources: [],
      },
      transport: {
        type: 'stdio',
      },
    };

    super(serverConfig);

    this.docConfig = {
      outputFormats: ['markdown', 'html', 'json'],
      includeSourceCode: true,
      generateAPIDocs: true,
      generateDiagrams: true,
      versionControlIntegration: true,
      autoUpdate: true,
      ...config,
    };

    this.docGenerator = new DocumentationGenerator(this.docConfig);
    this.apiDocGenerator = new APIDocumentationGenerator();
    this.diagramGenerator = new ArchitectureDiagramGenerator();
    this.versionControl = new VersionControlIntegration();
  }

  protected getServerInstructions(): string {
    return `Documentation Server - Automated documentation generation and management tool.
    
Available tools:
- generate-project-docs: Generate comprehensive project documentation
- generate-api-docs: Generate API documentation
- generate-architecture-diagram: Generate architecture diagrams
- generate-code-documentation: Generate code documentation
- get-docs-history: Get documentation version history
- compare-docs-versions: Compare documentation versions
- revert-docs-version: Revert to previous documentation version
- list-documentation: List available documentation
- get-documentation: Get specific documentation
- update-documentation: Update documentation
- delete-documentation: Delete documentation
- convert-documentation: Convert documentation format
- export-documentation: Export documentation to archive`;
  }

  protected initializeTools(): void {
    // Tools are defined in the server config
  }

  protected initializeResources(): void {
    // No additional resources needed
  }

  protected async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'generate-project-docs':
          return this.createSuccessResponse(request.id, await this.generateProjectDocs(request.params || {}));
        case 'generate-api-docs':
          return this.createSuccessResponse(request.id, await this.generateAPIDocs(request.params || {}));
        case 'generate-architecture-diagram':
          return this.createSuccessResponse(request.id, await this.generateArchitectureDiagram(request.params || {}));
        case 'generate-code-documentation':
          return this.createSuccessResponse(request.id, await this.generateCodeDocumentation(request.params || {}));
        case 'get-docs-history':
          return this.createSuccessResponse(request.id, await this.getDocsHistory(request.params || {}));
        case 'compare-docs-versions':
          return this.createSuccessResponse(request.id, await this.compareDocsVersions(request.params || {}));
        case 'revert-docs-version':
          return this.createSuccessResponse(request.id, await this.revertDocsVersion(request.params || {}));
        case 'list-documentation':
          return this.createSuccessResponse(request.id, await this.listDocumentation(request.params || {}));
        case 'get-documentation':
          return this.createSuccessResponse(request.id, await this.getDocumentation(request.params || {}));
        case 'update-documentation':
          return this.createSuccessResponse(request.id, await this.updateDocumentation(request.params || {}));
        case 'delete-documentation':
          return this.createSuccessResponse(request.id, await this.deleteDocumentation(request.params || {}));
        case 'convert-documentation':
          return this.createSuccessResponse(request.id, await this.convertDocumentation(request.params || {}));
        case 'export-documentation':
          return this.createSuccessResponse(request.id, await this.exportDocumentation(request.params || {}));
        default:
          return this.createErrorResponse(request.id, -32601, 'Method not found');
      }
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected createTransport(): any {
    return {
      start: async () => {},
      close: async () => {},
    };
  }

  private async generateProjectDocs(args: any): Promise<any> {
    const {
      projectPath,
      formats = this.docConfig.outputFormats,
      includeSource = this.docConfig.includeSourceCode,
      outputPath,
    } = args;

    try {
      Logger.info(`Generating project documentation for: ${projectPath}`);

      const documentation = await this.docGenerator.generateProjectDocumentation(
        projectPath,
        formats,
        includeSource,
        outputPath
      );

      if (this.docConfig.versionControlIntegration) {
        await this.versionControl.saveDocumentationVersion(
          projectPath,
          documentation,
          'Project documentation generated'
        );
      }

      return {
        success: true,
        documentation,
        metadata: {
          projectPath,
          formats,
          generatedAt: new Date().toISOString(),
          filesCount: documentation.files?.length || 0,
        },
      };
    } catch (error) {
      Logger.error('Failed to generate project documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async generateAPIDocs(args: any): Promise<any> {
    const {
      apiPath,
      format = 'markdown',
      includeExamples = true,
      outputPath,
    } = args;

    try {
      Logger.info(`Generating API documentation for: ${apiPath}`);

      const apiDocs = await this.apiDocGenerator.generateAPIDocumentation(
        apiPath,
        format,
        includeExamples,
        outputPath
      );

      return {
        success: true,
        apiDocs,
        metadata: {
          apiPath,
          format,
          includeExamples,
          generatedAt: new Date().toISOString(),
          endpointsCount: apiDocs.endpoints?.length || 0,
        },
      };
    } catch (error) {
      Logger.error('Failed to generate API documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async generateArchitectureDiagram(args: any): Promise<any> {
    const {
      projectPath,
      diagramType = 'component',
      format = 'svg',
      outputPath,
    } = args;

    try {
      Logger.info(`Generating ${diagramType} architecture diagram for: ${projectPath}`);

      const diagram = await this.diagramGenerator.generateDiagram(
        projectPath,
        diagramType,
        format,
        outputPath
      );

      return {
        success: true,
        diagram,
        metadata: {
          projectPath,
          diagramType,
          format,
          generatedAt: new Date().toISOString(),
          diagramPath: diagram.path,
        },
      };
    } catch (error) {
      Logger.error('Failed to generate architecture diagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async generateCodeDocumentation(args: any): Promise<any> {
    const {
      filePath,
      format = 'markdown',
      includeTests = false,
      outputPath,
    } = args;

    try {
      Logger.info(`Generating code documentation for: ${filePath}`);

      const codeDocs = await this.docGenerator.generateCodeDocumentation(
        filePath,
        format,
        includeTests,
        outputPath
      );

      return {
        success: true,
        codeDocs,
        metadata: {
          filePath,
          format,
          includeTests,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      Logger.error('Failed to generate code documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getDocsHistory(args: any): Promise<any> {
    const { projectPath, limit = 10 } = args;

    try {
      Logger.info(`Getting documentation history for: ${projectPath}`);

      const history = await this.versionControl.getDocumentationHistory(
        projectPath,
        limit
      );

      return {
        success: true,
        history,
        metadata: {
          projectPath,
          count: history.length,
        },
      };
    } catch (error) {
      Logger.error('Failed to get documentation history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async compareDocsVersions(args: any): Promise<any> {
    const { projectPath, version1, version2 } = args;

    try {
      Logger.info(`Comparing documentation versions for: ${projectPath}`);

      const comparison = await this.versionControl.compareDocumentationVersions(
        projectPath,
        version1,
        version2
      );

      return {
        success: true,
        comparison,
        metadata: {
          projectPath,
          version1,
          version2,
        },
      };
    } catch (error) {
      Logger.error('Failed to compare documentation versions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async revertDocsVersion(args: any): Promise<any> {
    const { projectPath, version } = args;

    try {
      Logger.info(`Reverting documentation to version: ${version}`);

      const result = await this.versionControl.revertDocumentationVersion(
        projectPath,
        version
      );

      return {
        success: true,
        result,
        metadata: {
          projectPath,
          revertedVersion: version,
        },
      };
    } catch (error) {
      Logger.error('Failed to revert documentation version:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async listDocumentation(args: any): Promise<any> {
    const { projectPath, type } = args;

    try {
      Logger.info(`Listing documentation for: ${projectPath}`);

      const documentation = await this.docGenerator.listDocumentation(
        projectPath,
        type
      );

      return {
        success: true,
        documentation,
        metadata: {
          projectPath,
          type,
          count: documentation.length,
        },
      };
    } catch (error) {
      Logger.error('Failed to list documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getDocumentation(args: any): Promise<any> {
    const { docId, format = 'markdown' } = args;

    try {
      Logger.info(`Getting documentation: ${docId}`);

      const documentation = await this.docGenerator.getDocumentation(
        docId,
        format
      );

      return {
        success: true,
        documentation,
        metadata: {
          docId,
          format,
        },
      };
    } catch (error) {
      Logger.error('Failed to get documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updateDocumentation(args: any): Promise<any> {
    const { docId, content, format = 'markdown' } = args;

    try {
      Logger.info(`Updating documentation: ${docId}`);

      const updated = await this.docGenerator.updateDocumentation(
        docId,
        content,
        format
      );

      return {
        success: true,
        updated,
        metadata: {
          docId,
          format,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      Logger.error('Failed to update documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async deleteDocumentation(args: any): Promise<any> {
    const { docId } = args;

    try {
      Logger.info(`Deleting documentation: ${docId}`);

      await this.docGenerator.deleteDocumentation(docId);

      return {
        success: true,
        metadata: {
          docId,
          deletedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      Logger.error('Failed to delete documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async convertDocumentation(args: any): Promise<any> {
    const { docId, targetFormat, outputPath } = args;

    try {
      Logger.info(`Converting documentation ${docId} to ${targetFormat}`);

      const converted = await this.docGenerator.convertDocumentation(
        docId,
        targetFormat,
        outputPath
      );

      return {
        success: true,
        converted,
        metadata: {
          docId,
          targetFormat,
          convertedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      Logger.error('Failed to convert documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async exportDocumentation(args: any): Promise<any> {
    const { docIds, format, outputPath } = args;

    try {
      Logger.info(`Exporting documentation to ${format}`);

      const exported = await this.docGenerator.exportDocumentation(
        docIds,
        format,
        outputPath
      );

      return {
        success: true,
        exported,
        metadata: {
          docIds,
          format,
          exportedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      Logger.error('Failed to export documentation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  override async start(): Promise<void> {
    await super.start();
    Logger.info('Documentation Server started successfully');
    
    if (this.docConfig.autoUpdate) {
      this.startAutoUpdate();
    }
  }

  override async stop(): Promise<void> {
    await super.stop();
    Logger.info('Documentation Server stopped');
  }

  private startAutoUpdate(): void {
    // Auto-update documentation every hour
    setInterval(async () => {
      try {
        Logger.info('Running auto-update for documentation');
        // Implementation would check for code changes and update docs
      } catch (error) {
        Logger.error('Auto-update failed:', error);
      }
    }, 3600000); // 1 hour
  }
}