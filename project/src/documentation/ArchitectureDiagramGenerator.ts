import * as fs from 'fs/promises'
import * as fse from 'fs-extra'
import * as path from 'path'
import { Logger } from '../utils/Logger'
import { DiagramDocumentation, DiagramElement, DiagramRelationship } from './types'

export class ArchitectureDiagramGenerator {
  // Template cache for future use
  // private templateCache: Map<string, string> = new Map();

  async generateDiagram(
    projectPath: string,
    diagramType: 'component' | 'deployment' | 'sequence' | 'class' = 'component',
    format: 'svg' | 'png' | 'mermaid' = 'svg',
    outputPath?: string
  ): Promise<DiagramDocumentation> {
    Logger.info(`Generating ${diagramType} architecture diagram for: ${projectPath}`)

    const projectAnalysis = await this.analyzeProject(projectPath)
    const diagram = await this.createDiagram(projectAnalysis, diagramType, format)

    if (outputPath) {
      await this.exportDiagram(diagram, outputPath)
    }

    return diagram
  }

  private async analyzeProject(projectPath: string): Promise<any> {
    const structure = await this.getProjectStructure(projectPath)
    const dependencies = await this.extractDependencies(projectPath)
    const components = await this.identifyComponents(projectPath)
    const relationships = await this.identifyRelationships(projectPath, components)

    return {
      path: projectPath,
      structure,
      dependencies,
      components,
      relationships,
      name: path.basename(projectPath),
    }
  }

  private async getProjectStructure(projectPath: string): Promise<any> {
    const directories: string[] = []
    const files: string[] = []

    const entries = await fs.readdir(projectPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(projectPath, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        directories.push(entry.name)
        const subStructure = await this.getProjectStructure(fullPath)
        directories.push(...subStructure.directories.map((d: string) => `${entry.name}/${d}`))
        files.push(...subStructure.files.map((f: string) => `${entry.name}/${f}`))
      } else if (entry.isFile()) {
        files.push(entry.name)
      }
    }

    return { directories, files }
  }

  private async extractDependencies(projectPath: string): Promise<any[]> {
    const dependencies: any[] = []
    const packageJsonPath = path.join(projectPath, 'package.json')

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      for (const [name, version] of Object.entries(allDeps)) {
        dependencies.push({
          name,
          version,
          type: packageJson.dependencies[name] ? 'runtime' : 'development',
        })
      }
    } catch (error) {
      Logger.warn(`Failed to read package.json: ${error}`)
    }

    return dependencies
  }

  private async identifyComponents(projectPath: string): Promise<DiagramElement[]> {
    const components: DiagramElement[] = []
    const structure = await this.getProjectStructure(projectPath)

    // Identify frontend components
    if (structure.directories.some((d: string) => d.includes('src') || d.includes('components'))) {
      components.push({
        id: 'frontend',
        name: 'Frontend',
        type: 'component',
        description: 'Frontend application components',
        properties: {
          technologies: await this.identifyTechnologies(projectPath, ['react', 'vue', 'angular']),
        },
      })
    }

    // Identify backend components
    if (structure.directories.some((d: string) => d.includes('server') || d.includes('api'))) {
      components.push({
        id: 'backend',
        name: 'Backend',
        type: 'component',
        description: 'Backend API server',
        properties: {
          technologies: await this.identifyTechnologies(projectPath, [
            'express',
            'fastify',
            'nest',
          ]),
        },
      })
    }

    // Identify database components
    if (structure.files.some((f: string) => f.includes('database') || f.includes('db'))) {
      components.push({
        id: 'database',
        name: 'Database',
        type: 'component',
        description: 'Database layer',
        properties: {
          technologies: await this.identifyTechnologies(projectPath, [
            'mongodb',
            'postgresql',
            'mysql',
          ]),
        },
      })
    }

    // Identify testing components
    if (structure.directories.some((d: string) => d.includes('test') || d.includes('spec'))) {
      components.push({
        id: 'testing',
        name: 'Testing',
        type: 'component',
        description: 'Testing framework and utilities',
        properties: {
          technologies: await this.identifyTechnologies(projectPath, ['jest', 'mocha', 'cypress']),
        },
      })
    }

    // Identify build components
    if (structure.files.some((f: string) => f.includes('webpack') || f.includes('vite'))) {
      components.push({
        id: 'build',
        name: 'Build System',
        type: 'component',
        description: 'Build and bundling tools',
        properties: {
          technologies: await this.identifyTechnologies(projectPath, ['webpack', 'vite', 'rollup']),
        },
      })
    }

    // Add file-based components
    const sourceFiles = structure.files.filter(
      (f: string) =>
        f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx')
    )

    sourceFiles.forEach((file: string, index: number) => {
      components.push({
        id: `file-${index}`,
        name: file,
        type: 'file',
        description: `Source file: ${file}`,
        properties: {
          path: file,
          language: this.inferLanguage(path.extname(file)),
        },
      })
    })

    return components
  }

  private async identifyRelationships(
    _projectPath: string,
    components: DiagramElement[]
  ): Promise<DiagramRelationship[]> {
    const relationships: DiagramRelationship[] = []
    const componentMap = new Map(components.map(c => [c.id, c]))

    // Create relationships based on common patterns
    const frontend = componentMap.get('frontend')
    const backend = componentMap.get('backend')
    const database = componentMap.get('database')
    const testing = componentMap.get('testing')

    if (frontend && backend) {
      relationships.push({
        id: 'frontend-backend',
        from: frontend.id,
        to: backend.id,
        type: 'API_CALL',
        description: 'Frontend calls backend API',
        properties: {
          protocol: 'HTTP/REST',
        },
      })
    }

    if (backend && database) {
      relationships.push({
        id: 'backend-database',
        from: backend.id,
        to: database.id,
        type: 'DATABASE_CONNECTION',
        description: 'Backend connects to database',
        properties: {
          protocol: 'SQL/NoSQL',
        },
      })
    }

    if (testing && (frontend || backend)) {
      const testTarget = frontend || backend
      if (testTarget) {
        relationships.push({
          id: 'testing-target',
          from: testing.id,
          to: testTarget.id,
          type: 'TESTS',
          description: 'Testing framework tests components',
          properties: {
            coverage: 'unknown',
          },
        })
      }
    }

    return relationships
  }

  private async identifyTechnologies(
    projectPath: string,
    techPatterns: string[]
  ): Promise<string[]> {
    const packageJsonPath = path.join(projectPath, 'package.json')

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      return techPatterns.filter(tech =>
        Object.keys(allDeps).some(dep => dep.toLowerCase().includes(tech))
      )
    } catch (error) {
      return []
    }
  }

  private async createDiagram(
    analysis: any,
    diagramType: 'component' | 'deployment' | 'sequence' | 'class',
    format: 'svg' | 'png' | 'mermaid'
  ): Promise<DiagramDocumentation> {
    const diagram: DiagramDocumentation = {
      metadata: {
        id: `diagram-${analysis.name}-${Date.now()}`,
        title: `${analysis.name} ${diagramType} Diagram`,
        description: `${diagramType} architecture diagram for ${analysis.name}`,
        type: 'diagram',
        format,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['architecture', 'diagram', diagramType],
      },
      type: diagramType,
      format,
      content: '',
      description: `${diagramType} diagram showing project architecture`,
      elements: analysis.components,
      relationships: analysis.relationships,
    }

    switch (diagramType) {
      case 'component':
        diagram.content = this.generateComponentDiagram(analysis)
        break
      case 'deployment':
        diagram.content = this.generateDeploymentDiagram(analysis)
        break
      case 'sequence':
        diagram.content = this.generateSequenceDiagram(analysis)
        break
      case 'class':
        diagram.content = this.generateClassDiagram(analysis)
        break
    }

    return diagram
  }

  private generateComponentDiagram(analysis: any): string {
    let mermaid = `graph TD\n`

    // Add components
    for (const component of analysis.components) {
      mermaid += `    ${component.id}[${component.name}]\n`
    }

    // Add relationships
    for (const relationship of analysis.relationships) {
      mermaid += `    ${relationship.from} -->|${relationship.description}| ${relationship.to}\n`
    }

    // Add styling
    mermaid += `\n    classDef component fill:#f9f,stroke:#333,stroke-width:2px\n`
    mermaid += `    classDef database fill:#bbf,stroke:#333,stroke-width:2px\n`
    mermaid += `    classDef frontend fill:#fbb,stroke:#333,stroke-width:2px\n`
    mermaid += `    classDef backend fill:#bfb,stroke:#333,stroke-width:2px\n`

    // Apply styles
    for (const component of analysis.components) {
      switch (component.type) {
        case 'component':
          if (component.id === 'database') {
            mermaid += `    class ${component.id} database\n`
          } else if (component.id === 'frontend') {
            mermaid += `    class ${component.id} frontend\n`
          } else if (component.id === 'backend') {
            mermaid += `    class ${component.id} backend\n`
          } else {
            mermaid += `    class ${component.id} component\n`
          }
          break
      }
    }

    return mermaid
  }

  private generateDeploymentDiagram(analysis: any): string {
    let mermaid = `graph LR\n`

    // Add deployment components
    mermaid += `    Client[Client Browser]\n`
    mermaid += `    LoadBalancer[Load Balancer]\n`
    mermaid += `    Server[Application Server]\n`
    mermaid += `    Database[Database Server]\n`

    // Add deployment relationships
    mermaid += `    Client --> LoadBalancer\n`
    mermaid += `    LoadBalancer --> Server\n`
    mermaid += `    Server --> Database\n`

    // Add project-specific components
    if (analysis.components.some((c: DiagramElement) => c.id === 'frontend')) {
      mermaid += `    Frontend[Frontend Build]\n`
      mermaid += `    Server --> Frontend\n`
    }

    if (analysis.components.some((c: DiagramElement) => c.id === 'testing')) {
      mermaid += `    CI/CD[CI/CD Pipeline]\n`
      mermaid += `    CI/CD --> Server\n`
    }

    return mermaid
  }

  private generateSequenceDiagram(analysis: any): string {
    let mermaid = `sequenceDiagram\n`

    // Add participants
    const participants = analysis.components.map((c: DiagramElement) => c.name)
    for (const participant of participants) {
      mermaid += `    participant ${participant}\n`
    }

    // Add sequence interactions
    if (participants.includes('Frontend') && participants.includes('Backend')) {
      mermaid += `    Frontend->>Backend: HTTP Request\n`
      mermaid += `    Backend-->>Frontend: HTTP Response\n`
    }

    if (participants.includes('Backend') && participants.includes('Database')) {
      mermaid += `    Backend->>Database: Query\n`
      mermaid += `    Database-->>Backend: Results\n`
    }

    if (participants.includes('Testing') && participants.some((p: string) => p !== 'Testing')) {
      const target = participants.find((p: string) => p !== 'Testing')
      if (target) {
        mermaid += `    Testing->>${target}: Test Execution\n`
        mermaid += `    ${target}-->>Testing: Test Results\n`
      }
    }

    return mermaid
  }

  private generateClassDiagram(analysis: any): string {
    let mermaid = `classDiagram\n`

    // Add classes based on components
    for (const component of analysis.components) {
      if (component.type === 'component') {
        mermaid += `    class ${component.id} {\n`
        mermaid += `        +${component.name}\n`
        mermaid += `        +process()\n`
        mermaid += `        +configure()\n`
        mermaid += `    }\n`
      }
    }

    // Add relationships
    for (const relationship of analysis.relationships) {
      if (relationship.type === 'API_CALL') {
        mermaid += `    ${relationship.from} --> ${relationship.to} : uses\n`
      } else if (relationship.type === 'DATABASE_CONNECTION') {
        mermaid += `    ${relationship.from} --> ${relationship.to} : connects to\n`
      }
    }

    return mermaid
  }

  private async exportDiagram(diagram: DiagramDocumentation, outputPath: string): Promise<void> {
    const fileName = `${diagram.metadata.title.replace(/\s+/g, '-')}.${diagram.format}`
    const filePath = path.join(outputPath, fileName)

    await fse.ensureDir(path.dirname(filePath))

    let content: string

    switch (diagram.format) {
      case 'mermaid':
        content = diagram.content
        break
      case 'svg':
        content = this.convertMermaidToSVG(diagram.content)
        break
      case 'png':
        content = this.convertMermaidToPNG(diagram.content)
        break
      default:
        content = diagram.content
    }

    await fs.writeFile(filePath, content)
    Logger.info(`Diagram exported to: ${filePath}`)
  }

  private convertMermaidToSVG(mermaid: string): string {
    // In a real implementation, this would use mermaid-cli or a similar library
    return `<svg>${mermaid}</svg>`
  }

  private convertMermaidToPNG(mermaid: string): string {
    // In a real implementation, this would use mermaid-cli or a similar library
    return `PNG representation of: ${mermaid}`
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
    }

    return languageMap[extension] || 'Unknown'
  }
}
