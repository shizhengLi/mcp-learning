import * as fs from 'fs/promises'
import * as fse from 'fs-extra'
import * as path from 'path'
import { Logger } from '../utils/Logger'
import {
  DocumentationConfig,
  DocumentationFormat,
  ProjectDocumentation,
  CodeDocumentation,
  DocumentationFile,
  ProjectDependency,
} from './types'

export class DocumentationGenerator {
  private config: DocumentationConfig
  // Template cache for future use
  // private templateCache: Map<string, string> = new Map();

  constructor(config: DocumentationConfig = {}) {
    this.config = config
  }

  async generateProjectDocumentation(
    projectPath: string,
    formats: DocumentationFormat[] = ['markdown'],
    includeSource: boolean = true,
    outputPath?: string
  ): Promise<ProjectDocumentation> {
    Logger.info(`Generating project documentation for: ${projectPath}`)

    const projectInfo = await this.analyzeProjectStructure(projectPath)
    const documentation: ProjectDocumentation = {
      metadata: {
        id: `project-${Date.now()}`,
        title: projectInfo.name,
        description: projectInfo.description,
        type: 'project',
        format: formats[0],
        version: projectInfo.version,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: projectInfo.technologies,
      },
      overview: {
        name: projectInfo.name,
        description: projectInfo.description,
        version: projectInfo.version,
        technologies: projectInfo.technologies,
        architecture: projectInfo.architecture,
      },
      structure: {
        directories: projectInfo.directories,
        files: projectInfo.files,
        dependencies: projectInfo.dependencies,
      },
      code: [],
      setup: {
        installation: await this.generateSetupInstructions(projectPath),
        configuration: await this.extractConfiguration(projectPath),
        environment: await this.extractEnvironmentVariables(projectPath),
      },
      testing: await this.extractTestingInfo(projectPath),
      deployment: await this.extractDeploymentInfo(projectPath),
    }

    if (includeSource) {
      documentation.code = await this.generateCodeDocumentation(
        projectPath,
        formats[0] || 'markdown'
      )
    }

    // Generate documentation in requested formats
    for (const format of formats) {
      await this.exportDocumentationToDir(documentation, format, outputPath)
    }

    return documentation
  }

  async generateCodeDocumentation(
    filePath: string,
    _format: DocumentationFormat = 'markdown',
    includeTests: boolean = false,
    _outputPath?: string
  ): Promise<CodeDocumentation[]> {
    Logger.info(`Generating code documentation for: ${filePath}`)

    const codeDocs: CodeDocumentation[] = []

    if (await this.isDirectory(filePath)) {
      const files = await this.getSourceFiles(filePath, includeTests)
      for (const file of files) {
        const doc = await this.generateSingleFileDocumentation(file)
        if (doc) {
          codeDocs.push(doc)
        }
      }
    } else {
      const doc = await this.generateSingleFileDocumentation(filePath)
      if (doc) {
        codeDocs.push(doc)
      }
    }

    return codeDocs
  }

  async listDocumentation(
    _projectPath: string,
    type?: 'project' | 'api' | 'code' | 'diagram'
  ): Promise<any[]> {
    const outputDir = this.config.outputDirectory || './docs'
    const docs: any[] = []

    try {
      const files = await fs.readdir(outputDir)

      for (const file of files) {
        const filePath = path.join(outputDir, file)
        const stat = await fs.stat(filePath)

        if (stat.isDirectory()) {
          const subFiles = await fs.readdir(filePath)
          for (const subFile of subFiles) {
            if (this.matchesType(subFile, type)) {
              docs.push({
                id: `${file}/${subFile}`,
                path: path.join(filePath, subFile),
                type: this.inferType(subFile),
                format: this.inferFormat(subFile),
                size: (await fs.stat(path.join(filePath, subFile))).size,
                lastModified: (await fs.stat(path.join(filePath, subFile))).mtime.toISOString(),
              })
            }
          }
        } else if (this.matchesType(file, type)) {
          docs.push({
            id: file,
            path: filePath,
            type: this.inferType(file),
            format: this.inferFormat(file),
            size: stat.size,
            lastModified: stat.mtime.toISOString(),
          })
        }
      }
    } catch (error) {
      Logger.warn(`Failed to list documentation: ${error}`)
    }

    return docs
  }

  async getDocumentation(docId: string, _format: DocumentationFormat = 'markdown'): Promise<any> {
    const outputDir = this.config.outputDirectory || './docs'
    const docPath = path.join(outputDir, docId)

    try {
      const content = await fs.readFile(docPath, 'utf-8')

      if (_format !== this.inferFormat(docId)) {
        return await this.convertDocumentationContent(content, this.inferFormat(docId), _format)
      }

      return JSON.parse(content)
    } catch (error) {
      Logger.error(`Failed to get documentation ${docId}: ${error}`)
      throw error
    }
  }

  async updateDocumentation(
    docId: string,
    _content: any,
    _format: DocumentationFormat = 'markdown'
  ): Promise<boolean> {
    const outputDir = this.config.outputDirectory || './docs'
    const docPath = path.join(outputDir, docId)

    try {
      await fse.ensureDir(path.dirname(docPath))

      if (typeof _content === 'object') {
        await fs.writeFile(docPath, JSON.stringify(_content, null, 2))
      } else {
        await fs.writeFile(docPath, _content)
      }

      return true
    } catch (error) {
      Logger.error(`Failed to update documentation ${docId}: ${error}`)
      return false
    }
  }

  async deleteDocumentation(docId: string): Promise<boolean> {
    const outputDir = this.config.outputDirectory || './docs'
    const docPath = path.join(outputDir, docId)

    try {
      await fs.unlink(docPath)
      return true
    } catch (error) {
      Logger.error(`Failed to delete documentation ${docId}: ${error}`)
      return false
    }
  }

  async convertDocumentation(
    docId: string,
    targetFormat: DocumentationFormat,
    outputPath?: string
  ): Promise<any> {
    const doc = await this.getDocumentation(docId)
    const sourceFormat = this.inferFormat(docId)

    return await this.convertDocumentationContent(doc, sourceFormat, targetFormat, outputPath)
  }

  async exportDocumentation(
    docIds: string[],
    format: 'zip' | 'tar' | 'pdf',
    outputPath?: string
  ): Promise<string> {
    // Implementation would use archiving libraries
    Logger.info(`Exporting documentation to ${format}: ${docIds.join(', ')}`)

    const exportPath = outputPath || `./docs-export-${Date.now()}.${format}`

    // Placeholder implementation
    return exportPath
  }

  private async analyzeProjectStructure(projectPath: string): Promise<any> {
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = await this.readPackageJson(packageJsonPath)

    const files = await this.getAllFiles(projectPath)
    const directories = await this.getAllDirectories(projectPath)
    const dependencies = await this.extractDependencies(packageJson)

    return {
      name: packageJson.name || path.basename(projectPath),
      description: packageJson.description || 'No description available',
      version: packageJson.version || '1.0.0',
      technologies: this.extractTechnologies(dependencies),
      architecture: await this.analyzeArchitecture(projectPath),
      directories,
      files: await this.categorizeFiles(files),
      dependencies,
    }
  }

  private async readPackageJson(packageJsonPath: string): Promise<any> {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = []
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await this.getAllFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }

    return files
  }

  private async getAllDirectories(dir: string): Promise<string[]> {
    const directories: string[] = []
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        directories.push(fullPath)
        const subDirs = await this.getAllDirectories(fullPath)
        directories.push(...subDirs)
      }
    }

    return directories
  }

  private async extractDependencies(packageJson: any): Promise<ProjectDependency[]> {
    const dependencies: ProjectDependency[] = []

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    }

    for (const [name, version] of Object.entries(allDeps)) {
      dependencies.push({
        name,
        version: version as string,
        type: packageJson.dependencies[name] ? 'runtime' : 'development',
      })
    }

    return dependencies
  }

  private extractTechnologies(dependencies: ProjectDependency[]): string[] {
    const techMap: Record<string, string[]> = {
      react: ['React', 'Frontend'],
      vue: ['Vue.js', 'Frontend'],
      angular: ['Angular', 'Frontend'],
      express: ['Express.js', 'Backend'],
      fastify: ['Fastify', 'Backend'],
      nest: ['NestJS', 'Backend'],
      typescript: ['TypeScript'],
      jest: ['Jest', 'Testing'],
      mocha: ['Mocha', 'Testing'],
      webpack: ['Webpack', 'Build Tool'],
      vite: ['Vite', 'Build Tool'],
    }

    const technologies = new Set<string>()

    for (const dep of dependencies) {
      const techs = techMap[dep.name.toLowerCase()]
      if (techs) {
        techs.forEach(tech => technologies.add(tech))
      }
    }

    return Array.from(technologies)
  }

  private async analyzeArchitecture(projectPath: string): Promise<string> {
    // Simple architecture analysis based on directory structure
    const hasSrcDir = await this.pathExists(path.join(projectPath, 'src'))
    const hasTestDir = await this.pathExists(path.join(projectPath, 'test'))
    // const hasConfigDir = await this.pathExists(path.join(projectPath, 'config')); // Used in architecture analysis

    if (hasSrcDir && hasTestDir) {
      return 'Standard Node.js project structure with source and test separation'
    } else if (hasSrcDir) {
      return 'Simple project structure with source directory'
    } else {
      return 'Flat project structure'
    }
  }

  private async categorizeFiles(files: string[]): Promise<DocumentationFile[]> {
    const categorized: DocumentationFile[] = []

    for (const file of files) {
      const stat = await fs.stat(file)
      const extension = path.extname(file)

      categorized.push({
        path: file,
        type: this.categorizeFileType(file, extension),
        language: this.inferLanguage(extension),
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
      })
    }

    return categorized
  }

  private categorizeFileType(
    file: string,
    extension: string
  ): 'source' | 'test' | 'config' | 'documentation' | 'asset' {
    if (
      file.includes('/test/') ||
      file.includes('/tests/') ||
      file.includes('.test.') ||
      file.includes('.spec.')
    ) {
      return 'test'
    } else if (['.json', '.yaml', '.yml', '.config.js', '.config.ts'].includes(extension)) {
      return 'config'
    } else if (['.md', '.txt', '.rst'].includes(extension)) {
      return 'documentation'
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(extension)) {
      return 'asset'
    } else {
      return 'source'
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
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C/C++ Header',
      '.cs': 'C#',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.rust': 'Rust',
    }

    return languageMap[extension] || 'Unknown'
  }

  private async generateSingleFileDocumentation(
    filePath: string
  ): Promise<CodeDocumentation | null> {
    try {
      // const content = await fs.readFile(filePath, 'utf-8');
      const language = this.inferLanguage(path.extname(filePath))

      return {
        metadata: {
          id: `code-${path.basename(filePath)}-${Date.now()}`,
          title: path.basename(filePath),
          description: `Documentation for ${filePath}`,
          type: 'code',
          format: 'markdown',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        filePath,
        language,
        description: `Source code file: ${filePath}`,
        functions: [],
        classes: [],
        interfaces: [],
        types: [],
        constants: [],
        examples: [],
        dependencies: [],
        imports: [],
        exports: [],
      }
    } catch (error) {
      Logger.error(`Failed to generate documentation for ${filePath}: ${error}`)
      return null
    }
  }

  private async getSourceFiles(dirPath: string, includeTests: boolean): Promise<string[]> {
    const files = await this.getAllFiles(dirPath)
    return files.filter(file => {
      const extension = path.extname(file)
      const isTestFile =
        file.includes('/test/') || file.includes('.test.') || file.includes('.spec.')

      return (
        ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.rb', '.php'].includes(
          extension
        ) &&
        (includeTests || !isTestFile)
      )
    })
  }

  private async generateSetupInstructions(projectPath: string): Promise<string[]> {
    const packageJson = await this.readPackageJson(path.join(projectPath, 'package.json'))
    const instructions: string[] = []

    if (packageJson.scripts?.install) {
      instructions.push(`npm install`)
    } else {
      instructions.push(`npm install`)
    }

    if (packageJson.scripts?.build) {
      instructions.push(`npm run build`)
    }

    if (packageJson.scripts?.start) {
      instructions.push(`npm start`)
    }

    return instructions
  }

  private async extractConfiguration(projectPath: string): Promise<Record<string, any>> {
    const config: Record<string, any> = {}

    // Look for common configuration files
    const configFiles = ['package.json', 'tsconfig.json', '.env', 'config.json', 'app.config.js']

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile)
      if (await this.pathExists(configPath)) {
        try {
          const content = await fs.readFile(configPath, 'utf-8')
          if (configFile.endsWith('.json')) {
            config[configFile] = JSON.parse(content)
          } else {
            config[configFile] = content
          }
        } catch (error) {
          Logger.warn(`Failed to read config file ${configFile}: ${error}`)
        }
      }
    }

    return config
  }

  private async extractEnvironmentVariables(projectPath: string): Promise<string[]> {
    const envFile = path.join(projectPath, '.env')
    const envExample = path.join(projectPath, '.env.example')

    if (await this.pathExists(envFile)) {
      const content = await fs.readFile(envFile, 'utf-8')
      return content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split('=')[0].trim())
    } else if (await this.pathExists(envExample)) {
      const content = await fs.readFile(envExample, 'utf-8')
      return content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split('=')[0].trim())
    }

    return []
  }

  private async extractTestingInfo(projectPath: string): Promise<any> {
    const packageJson = await this.readPackageJson(path.join(projectPath, 'package.json'))
    const testDependencies = Object.keys(packageJson.devDependencies || {}).filter(
      dep =>
        dep.toLowerCase().includes('test') ||
        dep.toLowerCase().includes('jest') ||
        dep.toLowerCase().includes('mocha')
    )

    return {
      frameworks: testDependencies,
      commands: packageJson.scripts
        ? Object.keys(packageJson.scripts).filter(key => key.includes('test'))
        : [],
      coverage: undefined, // Would need to run tests to get coverage
    }
  }

  private async extractDeploymentInfo(projectPath: string): Promise<any> {
    // Look for deployment-related files
    const deploymentFiles = [
      'Dockerfile',
      'docker-compose.yml',
      '.github/workflows',
      'vercel.json',
      'netlify.toml',
      'firebase.json',
    ]

    const platforms: string[] = []
    const scripts: string[] = []
    const configuration: Record<string, any> = {}

    for (const file of deploymentFiles) {
      const filePath = path.join(projectPath, file)
      if (await this.pathExists(filePath)) {
        if (file.includes('docker')) {
          platforms.push('Docker')
        } else if (file.includes('vercel')) {
          platforms.push('Vercel')
        } else if (file.includes('netlify')) {
          platforms.push('Netlify')
        } else if (file.includes('firebase')) {
          platforms.push('Firebase')
        } else if (file.includes('github')) {
          platforms.push('GitHub Actions')
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          configuration[file] = content
        } catch (error) {
          Logger.warn(`Failed to read deployment file ${file}: ${error}`)
        }
      }
    }

    const packageJson = await this.readPackageJson(path.join(projectPath, 'package.json'))
    if (packageJson.scripts) {
      scripts.push(...Object.keys(packageJson.scripts).filter(key => key.includes('deploy')))
    }

    return {
      platforms,
      scripts,
      configuration,
    }
  }

  private async exportDocumentationToDir(
    documentation: ProjectDocumentation,
    format: DocumentationFormat,
    outputPath?: string
  ): Promise<void> {
    const outputDir = outputPath || this.config.outputDirectory || './docs'
    const fileName = `${documentation.metadata.title.replace(/\s+/g, '-')}.${format}`
    const filePath = path.join(outputDir, fileName)

    await fse.ensureDir(outputDir)

    let content: string

    switch (format) {
      case 'json':
        content = JSON.stringify(documentation, null, 2)
        break
      case 'markdown':
        content = this.convertToMarkdown(documentation)
        break
      case 'html':
        content = this.convertToHTML(documentation)
        break
      default:
        content = JSON.stringify(documentation, null, 2)
    }

    await fs.writeFile(filePath, content)
    Logger.info(`Documentation exported to: ${filePath}`)
  }

  private convertToMarkdown(documentation: ProjectDocumentation): string {
    let md = `# ${documentation.metadata.title}\n\n`
    md += `**Description:** ${documentation.metadata.description}\n\n`
    md += `**Version:** ${documentation.metadata.version}\n\n`
    md += `**Created:** ${documentation.metadata.createdAt}\n\n`

    if (documentation.metadata.tags?.length) {
      md += `**Tags:** ${documentation.metadata.tags.join(', ')}\n\n`
    }

    md += `## Overview\n\n`
    md += `**Name:** ${documentation.overview.name}\n\n`
    md += `**Description:** ${documentation.overview.description}\n\n`
    md += `**Technologies:** ${documentation.overview.technologies.join(', ')}\n\n`
    md += `**Architecture:** ${documentation.overview.architecture}\n\n`

    md += `## Setup\n\n`
    md += `### Installation\n\n`
    documentation.setup.installation.forEach(cmd => {
      md += `\`\`\`bash\n${cmd}\n\`\`\`\n\n`
    })

    if (Object.keys(documentation.setup.configuration).length > 0) {
      md += `### Configuration\n\n`
      md += `\`\`\`json\n${JSON.stringify(documentation.setup.configuration, null, 2)}\n\`\`\`\n\n`
    }

    if (documentation.setup.environment.length > 0) {
      md += `### Environment Variables\n\n`
      documentation.setup.environment.forEach(env => {
        md += `- ${env}\n`
      })
      md += `\n`
    }

    return md
  }

  private convertToHTML(documentation: ProjectDocumentation): string {
    const md = this.convertToMarkdown(documentation)
    // Simple markdown to HTML conversion (in real implementation, use a proper markdown parser)
    return `<html><body><pre>${md}</pre></body></html>`
  }

  private async convertDocumentationContent(
    content: any,
    sourceFormat: DocumentationFormat,
    targetFormat: DocumentationFormat,
    _outputPath?: string
  ): Promise<any> {
    // Placeholder for format conversion
    if (sourceFormat === targetFormat) {
      return content
    }

    // In a real implementation, this would use proper conversion libraries
    return content
  }

  private matchesType(filename: string, type?: string): boolean {
    if (!type) return true

    const typeMap: Record<string, string[]> = {
      project: ['README', 'project', 'overview'],
      api: ['api', 'endpoint', 'swagger'],
      code: ['code', 'source', 'documentation'],
      diagram: ['diagram', 'arch', 'component'],
    }

    return typeMap[type]?.some(keyword => filename.toLowerCase().includes(keyword)) ?? true
  }

  private inferType(filename: string): string {
    if (filename.toLowerCase().includes('api') || filename.toLowerCase().includes('endpoint')) {
      return 'api'
    } else if (
      filename.toLowerCase().includes('diagram') ||
      filename.toLowerCase().includes('arch')
    ) {
      return 'diagram'
    } else if (
      filename.toLowerCase().includes('code') ||
      filename.toLowerCase().includes('source')
    ) {
      return 'code'
    } else {
      return 'project'
    }
  }

  private inferFormat(filename: string): DocumentationFormat {
    const ext = path.extname(filename).toLowerCase()
    const formatMap: Record<string, DocumentationFormat> = {
      '.md': 'markdown',
      '.html': 'html',
      '.json': 'json',
      '.pdf': 'pdf',
      '.xml': 'xml',
    }

    return formatMap[ext] || 'markdown'
  }

  private async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
