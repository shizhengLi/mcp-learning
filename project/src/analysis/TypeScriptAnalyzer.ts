import { BaseLanguageAnalyzer } from './BaseLanguageAnalyzer';
import { CodeMetrics, RefactoringSuggestion, AnalysisIssue } from './BaseCodeAnalyzer';

export class TypeScriptAnalyzer extends BaseLanguageAnalyzer {
  constructor() {
    super(
      'typescript',
      ['ts', 'tsx'],
      [
        'TYPE_SAFETY',
        'ES6_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'INTERFACE_NAMING',
        'UNUSED_VARIABLES',
        'ANY_TYPE_USAGE',
        'NULL_CHECKS',
        'ASYNC_AWAIT',
        'DECORATORS'
      ],
      {
        complexity: { high: 9, medium: 5, low: 1 },
        maintainability: { poor: 55, fair: 75, good: 85, excellent: 95 }
      }
    );
  }

  protected calculateComplexity(code: string): number {
    let complexity = 1;
    const lines = code.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Control structures
      if (trimmed.match(/\b(if|else if|for|while|switch|case|catch)\b/)) {
        complexity++;
      }
      
      // Logical operators
      if (trimmed.match(/(&&|\|\|)/)) {
        complexity += 0.5;
      }
      
      // Ternary operators
      if (trimmed.match(/\?/)) {
        complexity += 0.5;
      }
      
      // Nested ternary (additional complexity)
      if (trimmed.match(/\?.*\?/)) {
        complexity += 1;
      }
      
      // Type assertions
      if (trimmed.match(/as\s+\w+/)) {
        complexity += 0.3;
      }
    });

    return Math.round(complexity);
  }

  protected calculateMaintainability(metrics: CodeMetrics): number {
    let maintainability = 100;

    // Deduct for complexity
    maintainability -= (metrics.complexity - 1) * 2;

    // Deduct for long functions
    if (metrics.averageFunctionLength > 20) {
      maintainability -= 10;
    } else if (metrics.averageFunctionLength > 10) {
      maintainability -= 5;
    }

    // Bonus for good commenting
    if (metrics.commentPercentage > 20) {
      maintainability += 5;
    }

    // Deduct for low commenting
    if (metrics.commentPercentage < 10) {
      maintainability -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(maintainability)));
  }

  protected analyzeCodeStructure(code: string): {
    functions: Array<{ name: string; line: number; complexity: number }>;
    classes: Array<{ name: string; line: number; methods: number }>;
    imports: string[];
    exports: string[];
  } {
    const functions = this.extractFunctions(code, /(?:function|const|let)\s+(\w+)\s*(?::\s*\w+)?\s*=/g);
    const classes = this.extractClasses(code, /(?:class|interface)\s+(\w+)/g);
    const imports = this.extractImports(code, /import\s+.*?from\s+['"]([^'"]+)['"]/g);
    const exports = this.extractImports(code, /export\s+(?:default\s+)?(?:function|const|let|class|interface)\s+(\w+)/g);

    return { functions, classes, imports, exports };
  }

  protected checkLanguageSpecificRules(code: string, rules: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const lines = code.split('\n');

    rules.forEach(rule => {
      switch (rule) {
        case 'TYPE_SAFETY':
          issues.push(...this.checkTypeSafety(code, lines));
          break;
        case 'ES6_STANDARDS':
          issues.push(...this.checkES6Standards(code, lines));
          break;
        case 'INTERFACE_NAMING':
          issues.push(...this.checkInterfaceNaming(code, lines));
          break;
        case 'ANY_TYPE_USAGE':
          issues.push(...this.checkAnyTypeUsage(code, lines));
          break;
        case 'NULL_CHECKS':
          issues.push(...this.checkNullChecks(code, lines));
          break;
        case 'ASYNC_AWAIT':
          issues.push(...this.checkAsyncAwaitUsage(code, lines));
          break;
      }
    });

    return issues;
  }

  public async initialize(): Promise<void> {
    // Initialize TypeScript analyzer
  }

  protected generateLanguageSpecificSuggestions(code: string, _metrics: CodeMetrics): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = code.split('\n');

    // Suggest using const instead of let for variables that don't change
    let letCount = 0;
    lines.forEach((line, _index) => {
      if (line.trim().match(/^let\s+/) && !line.includes('++') && !line.includes('--')) {
        letCount++;
      }
    });

    if (letCount > 3) {
      suggestions.push(this.createRefactoringSuggestion(
        'modernize',
        'medium',
        `Consider using 'const' instead of 'let' for ${letCount} variables that don't get reassigned`,
        1,
        { maintainabilityImprovement: 5 }
      ));
    }

    // Suggest using arrow functions for simple functions
    const functionLines = lines.filter(line => 
      line.trim().match(/^function\s+\w+/) && line.length < 50
    );

    if (functionLines.length > 2) {
      suggestions.push(this.createRefactoringSuggestion(
        'modernize',
        'low',
        `Consider converting ${functionLines.length} traditional functions to arrow functions`,
        1,
        { maintainabilityImprovement: 3 }
      ));
    }

    // Suggest using optional chaining if there are null checks
    const nullCheckCount = lines.filter(line => 
      line.includes('!== null') || line.includes('!== undefined')
    ).length;

    if (nullCheckCount > 2) {
      suggestions.push(this.createRefactoringSuggestion(
        'modernize',
        'medium',
        `Consider using optional chaining (?.) for ${nullCheckCount} null checks`,
        1,
        { maintainabilityImprovement: 8, complexityReduction: 2 }
      ));
    }

    return suggestions;
  }

  protected async readFile(_filePath: string): Promise<string> {
    // Mock implementation - in real implementation, read from file system
    return `// Mock TypeScript file content
interface User {
  id: number;
  name: string;
  email?: string;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
}

const userService = new UserService();
userService.addUser({ id: 1, name: 'John Doe' });`;
  }

  private checkTypeSafety(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    lines.forEach((line, _index) => {
      // Check for implicit any types
      if (line.match(/:\s*any\b/) && !line.includes('// @ts-ignore')) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          'Implicit any type detected - consider using specific types',
          _index + 1,
          'TYPE_SAFETY',
          {
            description: 'Replace "any" with a more specific type'
          }
        ));
      }
    });

    return issues;
  }

  private checkES6Standards(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    lines.forEach((line, _index) => {
      // Check for var usage
      if (line.trim().startsWith('var ')) {
        issues.push(this.createIssue(
          'warning',
          'low',
          'Consider using "let" or "const" instead of "var"',
          _index + 1,
          'ES6_STANDARDS',
          {
            description: 'Replace "var" with "let" or "const"'
          }
        ));
      }
    });

    return issues;
  }

  private checkInterfaceNaming(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    lines.forEach((line, _index) => {
      const match = line.match(/interface\s+([A-Za-z]+)/);
      if (match && !match[1].startsWith('I')) {
        issues.push(this.createIssue(
          'info',
          'low',
          `Interface "${match[1]}" should start with "I" (I${match[1]})`,
          _index + 1,
          'INTERFACE_NAMING',
          {
            description: 'Rename interface to follow naming convention'
          }
        ));
      }
    });

    return issues;
  }

  private checkAnyTypeUsage(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    lines.forEach((line, _index) => {
      if (line.includes('any') && !line.includes('// @ts-ignore')) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          'Usage of "any" type reduces type safety',
          _index + 1,
          'ANY_TYPE_USAGE',
          {
            description: 'Replace "any" with specific types or use generics'
          }
        ));
      }
    });

    return issues;
  }

  private checkNullChecks(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    lines.forEach((line, _index) => {
      if (line.includes('=== null') || line.includes('=== undefined')) {
        issues.push(this.createIssue(
          'info',
          'low',
          'Consider using optional chaining (?.) for safer null checks',
          _index + 1,
          'NULL_CHECKS',
          {
            description: 'Replace explicit null checks with optional chaining'
          }
        ));
      }
    });

    return issues;
  }

  private checkAsyncAwaitUsage(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    
    lines.forEach((line, _index) => {
      if (line.includes('.then(') && line.includes('.catch(')) {
        issues.push(this.createIssue(
          'info',
          'low',
          'Consider using async/await instead of Promise chains for better readability',
          _index + 1,
          'ASYNC_AWAIT',
          {
            description: 'Convert Promise chain to async/await syntax'
          }
        ));
      }
    });

    return issues;
  }
}