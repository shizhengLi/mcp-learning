import { BaseLanguageAnalyzer } from './BaseLanguageAnalyzer';
import { CodeMetrics, RefactoringSuggestion, AnalysisIssue as Issue } from './BaseCodeAnalyzer';

export class JavaAnalyzer extends BaseLanguageAnalyzer {
  constructor() {
    super(
      'java',
      ['java'],
      [
        'JAVA_NAMING_CONVENTIONS',
        'COMPLEXITY_HIGH',
        'METHOD_TOO_LONG',
        'CLASS_TOO_LONG',
        'UNUSED_IMPORTS',
        'MAGIC_NUMBERS',
        'STRING_CONCATENATION',
        'EXCEPTION_HANDLING',
        'RESOURCE_MANAGEMENT',
        'COLLECTION_USAGE'
      ],
      {
        complexity: { high: 15, medium: 8, low: 1 },
        maintainability: { poor: 40, fair: 65, good: 80, excellent: 90 }
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
      
      // Nested control structures
      if (trimmed.match(/\b(if|for|while)\b.*\b(if|for|while)\b/)) {
        complexity += 1;
      }
      
      // Try-catch blocks
      if (trimmed.match(/\b(try|catch)\b/)) {
        complexity += 0.5;
      }
      
      // Method calls (potential for complex logic)
      if (trimmed.match(/\.\w+\(/)) {
        complexity += 0.2;
      }
    });

    return Math.round(complexity);
  }

  protected calculateMaintainability(metrics: CodeMetrics): number {
    let maintainability = 100;

    // Deduct for complexity
    maintainability -= (metrics.complexity - 1) * 1.5;

    // Deduct for long methods
    if (metrics.averageFunctionLength > 30) {
      maintainability -= 15;
    } else if (metrics.averageFunctionLength > 15) {
      maintainability -= 8;
    }

    // Bonus for good commenting
    if (metrics.commentPercentage > 25) {
      maintainability += 8;
    }

    // Deduct for low commenting
    if (metrics.commentPercentage < 15) {
      maintainability -= 12;
    }

    // Deduct for too many dependencies
    if (metrics.dependencies.length > 10) {
      maintainability -= 5;
    }

    return Math.max(0, Math.min(100, Math.round(maintainability)));
  }

  protected analyzeCodeStructure(code: string): {
    functions: Array<{ name: string; line: number; complexity: number }>;
    classes: Array<{ name: string; line: number; methods: number }>;
    imports: string[];
    exports: string[];
  } {
    const functions = this.extractFunctions(code, /(?:public|private|protected|static|final)\s+\w+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g);
    const classes = this.extractClasses(code, /(?:public|private|protected|static|final|abstract)?\s*(?:class|interface|enum)\s+(\w+)/g);
    const imports = this.extractImports(code, /import\s+(?:static\s+)?([\w.]+);/g);
    const exports = this.extractImports(code, /public\s+(?:class|interface|enum)\s+(\w+)/g);

    return { functions, classes, imports, exports };
  }

  protected checkLanguageSpecificRules(code: string, rules: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    const lines = code.split('\n');

    rules.forEach(rule => {
      switch (rule) {
        case 'JAVA_NAMING_CONVENTIONS':
          issues.push(...this.checkJavaNamingConventions(code, lines));
          break;
        case 'UNUSED_IMPORTS':
          issues.push(...this.checkUnusedImports(code, lines));
          break;
        case 'MAGIC_NUMBERS':
          issues.push(...this.checkMagicNumbers(code, lines));
          break;
        case 'STRING_CONCATENATION':
          issues.push(...this.checkStringConcatenation(code, lines));
          break;
        case 'EXCEPTION_HANDLING':
          issues.push(...this.checkExceptionHandling(code, lines));
          break;
        case 'RESOURCE_MANAGEMENT':
          issues.push(...this.checkResourceManagement(code, lines));
          break;
        case 'COLLECTION_USAGE':
          issues.push(...this.checkCollectionUsage(code, lines));
          break;
      }
    });

    return issues;
  }

  public async initialize(): Promise<void> {
    // Initialize Java analyzer
  }

  protected generateLanguageSpecificSuggestions(code: string, metrics: CodeMetrics): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = code.split('\n');

    // Suggest using StringBuilder for string concatenation in loops
    const stringConcatenationInLoops = lines.filter((line, index) => {
      return line.includes('+') && 
             (lines.slice(Math.max(0, index - 5), index + 5).some(l => 
               l.includes('for') || l.includes('while')
             ));
    }).length;

    if (stringConcatenationInLoops > 0) {
      suggestions.push(this.createRefactoringSuggestion(
        'optimize',
        'medium',
        `Consider using StringBuilder for ${stringConcatenationInLoops} string concatenation operations in loops`,
        1,
        { performanceImprovement: 15, maintainabilityImprovement: 5 }
      ));
    }

    // Suggest using try-with-resources for resource management
    const manualResourceManagement = lines.filter(line => 
      line.includes('new ') && 
      (line.includes('FileInputStream') || line.includes('FileOutputStream') || 
       line.includes('Connection') || line.includes('Statement'))
    ).length;

    if (manualResourceManagement > 2) {
      suggestions.push(this.createRefactoringSuggestion(
        'modernize',
        'high',
        `Consider using try-with-resources for ${manualResourceManagement} resource management operations`,
        1,
        { maintainabilityImprovement: 10, complexityReduction: 3 }
      ));
    }

    // Suggest using Java 8+ features
    const traditionalLoops = lines.filter(line => 
      line.includes('for (int i = 0; i <') || line.includes('for (String item :')
    ).length;

    if (traditionalLoops > 3) {
      suggestions.push(this.createRefactoringSuggestion(
        'modernize',
        'medium',
        `Consider using Java 8+ streams and functional interfaces for ${traditionalLoops} traditional loops`,
        1,
        { maintainabilityImprovement: 8, complexityReduction: 2 }
      ));
    }

    // Suggest using Optional for null checks
    const nullChecks = lines.filter(line => 
      line.includes('== null') || line.includes('!= null')
    ).length;

    if (nullChecks > 5) {
      suggestions.push(this.createRefactoringSuggestion(
        'modernize',
        'low',
        `Consider using Optional for ${nullChecks} null checks to improve code safety`,
        1,
        { maintainabilityImprovement: 6 }
      ));
    }

    return suggestions;
  }

  protected async readFile(filePath: string): Promise<string> {
    // Mock implementation - in real implementation, read from file system
    return `// Mock Java file content
import java.util.ArrayList;
import java.util.List;

public class UserService {
    private List<User> users = new ArrayList<>();

    public void addUser(User user) {
        if (user != null) {
            users.add(user);
        }
    }

    public User getUserById(int id) {
        for (User user : users) {
            if (user.getId() == id) {
                return user;
            }
        }
        return null;
    }

    public List<User> getAllUsers() {
        return new ArrayList<>(users);
    }
}

class User {
    private int id;
    private String name;
    private String email;

    public User(int id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }

    // Getters and setters
    public int getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
}`;
  }

  private checkJavaNamingConventions(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    
    lines.forEach((line, index) => {
      // Check class names (PascalCase)
      const classMatch = line.match(/class\s+([A-Za-z]+)/);
      if (classMatch && !/^[A-Z]/.test(classMatch[1])) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          `Class name "${classMatch[1]}" should start with uppercase letter`,
          index + 1,
          'JAVA_NAMING_CONVENTIONS',
          {
            description: 'Rename class to follow PascalCase convention'
          }
        ));
      }

      // Check method names (camelCase)
      const methodMatch = line.match(/(?:public|private|protected)\s+\w+\s+(\w+)\s*\(/);
      if (methodMatch && !/^[a-z]/.test(methodMatch[1]) && !methodMatch[1].match(/^[A-Z_]+$/)) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          `Method name "${methodMatch[1]}" should start with lowercase letter`,
          index + 1,
          'JAVA_NAMING_CONVENTIONS',
          {
            description: 'Rename method to follow camelCase convention'
          }
        ));
      }

      // Check variable names (camelCase)
      const varMatch = line.match(/(?:\w+)\s+(\w+)\s*=/);
      if (varMatch && !/^[a-z]/.test(varMatch[1]) && !varMatch[1].match(/^[A-Z_]+$/)) {
        issues.push(this.createIssue(
          'warning',
          'low',
          `Variable name "${varMatch[1]}" should start with lowercase letter`,
          index + 1,
          'JAVA_NAMING_CONVENTIONS',
          {
            description: 'Rename variable to follow camelCase convention'
          }
        ));
      }
    });

    return issues;
  }

  private checkUnusedImports(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    const imports: string[] = [];
    
    // Extract imports
    lines.forEach(line => {
      const match = line.match(/import\s+([\w.]+);/);
      if (match) {
        imports.push(match[1]);
      }
    });

    // Simple check for obvious unused imports (can be enhanced)
    const unusedImports = imports.filter(imp => {
      const className = imp.split('.').pop();
      return !code.includes(className + '.');
    });

    unusedImports.forEach(imp => {
      const lineIndex = lines.findIndex(line => line.includes(imp));
      if (lineIndex !== -1) {
        issues.push(this.createIssue(
          'warning',
          'low',
          `Unused import: ${imp}`,
          lineIndex + 1,
          'UNUSED_IMPORTS',
          {
            description: 'Remove unused import statement'
          }
        ));
      }
    });

    return issues;
  }

  private checkMagicNumbers(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    
    lines.forEach((line, index) => {
      // Look for standalone numbers (excluding common cases)
      const matches = line.match(/\b([2-9]\d*|1[0-9]+)\b/g);
      if (matches) {
        matches.forEach(match => {
          // Exclude common numbers and common patterns
          if (!['0', '1', '100'].includes(match) && 
              !line.includes('for') && 
              !line.includes('array') &&
              !line.includes('length') &&
              !line.includes('size')) {
            issues.push(this.createIssue(
              'info',
              'low',
              `Magic number ${match} should be replaced with a named constant`,
              index + 1,
              'MAGIC_NUMBERS',
              {
                description: 'Replace magic number with a named constant'
              }
            ));
          }
        });
      }
    });

    return issues;
  }

  private checkStringConcatenation(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    
    lines.forEach((line, index) => {
      // Look for string concatenation with +
      if (line.includes('"') && line.includes('+') && line.includes('"')) {
        // Check if it's in a loop context
        const context = lines.slice(Math.max(0, index - 3), index + 3).join('\n');
        if (context.includes('for') || context.includes('while')) {
          issues.push(this.createIssue(
            'warning',
            'medium',
            'String concatenation in loop - consider using StringBuilder',
            index + 1,
            'STRING_CONCATENATION',
            {
              description: 'Replace string concatenation with StringBuilder'
            }
          ));
        }
      }
    });

    return issues;
  }

  private checkExceptionHandling(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    
    lines.forEach((line, index) => {
      // Check for empty catch blocks
      if (line.includes('catch') && lines[index + 1]?.includes('}')) {
        issues.push(this.createIssue(
          'warning',
          'high',
          'Empty catch block detected',
          index + 1,
          'EXCEPTION_HANDLING',
          {
            description: 'Add proper exception handling or logging'
          }
        ));
      }

      // Check for catching Exception
      if (line.includes('catch (Exception')) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          'Catching generic Exception - consider more specific exception types',
          index + 1,
          'EXCEPTION_HANDLING',
          {
            description: 'Catch more specific exception types'
          }
        ));
      }
    });

    return issues;
  }

  private checkResourceManagement(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    
    lines.forEach((line, index) => {
      // Check for resources that should be in try-with-resources
      if (line.includes('new ') && 
          (line.includes('FileInputStream') || line.includes('FileOutputStream') || 
           line.includes('BufferedReader') || line.includes('Connection'))) {
        
        // Check if not in try-with-resources
        const context = lines.slice(Math.max(0, index - 2), index + 5).join('\n');
        if (!context.includes('try (') && !context.includes('try{')) {
          issues.push(this.createIssue(
            'warning',
            'high',
            'Resource should be managed with try-with-resources',
            index + 1,
            'RESOURCE_MANAGEMENT',
            {
              description: 'Use try-with-resources for automatic resource management'
            }
          ));
        }
      }
    });

    return issues;
  }

  private checkCollectionUsage(code: string, lines: string[]): AnalysisIssue[] {
    const issues: Issue[] = [];
    
    lines.forEach((line, index) => {
      // Check for Vector usage (legacy)
      if (line.includes('Vector')) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          'Vector is legacy - consider using ArrayList',
          index + 1,
          'COLLECTION_USAGE',
          {
            description: 'Replace Vector with ArrayList'
          }
        ));
      }

      // Check for Hashtable usage (legacy)
      if (line.includes('Hashtable')) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          'Hashtable is legacy - consider using HashMap',
          index + 1,
          'COLLECTION_USAGE',
          {
            description: 'Replace Hashtable with HashMap'
          }
        ));
      }
    });

    return issues;
  }
}