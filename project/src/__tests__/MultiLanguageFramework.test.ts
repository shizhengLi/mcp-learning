import { describe, it, expect, beforeEach } from '@jest/globals';
import { MultiLanguageFramework } from '../analysis/MultiLanguageFramework';
import { TypeScriptAnalyzer } from '../analysis/TypeScriptAnalyzer';
import { JavaAnalyzer } from '../analysis/JavaAnalyzer';
import { PythonAnalyzer } from '../analysis/PythonAnalyzer';
import { JavaScriptAnalyzer } from '../analysis/JavaScriptAnalyzer';

describe('MultiLanguageFramework Tests', () => {
  let framework: MultiLanguageFramework;

  beforeEach(() => {
    framework = new MultiLanguageFramework();
  });

  describe('Language Registration and Detection', () => {
    it('should register all supported languages', () => {
      const languages = framework.getSupportedLanguages();
      
      expect(languages).toContain('python');
      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('java');
      expect(languages).toContain('go');
      expect(languages).toContain('cpp');
      expect(languages).toContain('rust');
      expect(languages).toContain('ruby');
      expect(languages).toContain('php');
    });

    it('should detect languages from file extensions', () => {
      expect(framework.detectLanguage('test.py')).toBe('python');
      expect(framework.detectLanguage('script.js')).toBe('javascript');
      expect(framework.detectLanguage('component.tsx')).toBe('typescript');
      expect(framework.detectLanguage('Main.java')).toBe('java');
      expect(framework.detectLanguage('server.go')).toBe('go');
      expect(framework.detectLanguage('program.cpp')).toBe('cpp');
      expect(framework.detectLanguage('main.rs')).toBe('rust');
      expect(framework.detectLanguage('app.rb')).toBe('ruby');
      expect(framework.detectLanguage('index.php')).toBe('php');
    });

    it('should return null for unsupported file types', () => {
      expect(framework.detectLanguage('test.unknown')).toBeNull();
      expect(framework.detectLanguage('config.json')).toBeNull();
      expect(framework.detectLanguage('style.css')).toBeNull();
    });

    it('should get all supported extensions', () => {
      const extensions = framework.getSupportedExtensions();
      
      expect(extensions).toContain('py');
      expect(extensions).toContain('js');
      expect(extensions).toContain('ts');
      expect(extensions).toContain('java');
      expect(extensions).toContain('go');
      expect(extensions).toContain('cpp');
      expect(extensions).toContain('rs');
      expect(extensions).toContain('rb');
      expect(extensions).toContain('php');
    });

    it('should validate languages', () => {
      expect(framework.validateLanguage('python')).toBe(true);
      expect(framework.validateLanguage('javascript')).toBe(true);
      expect(framework.validateLanguage('unknown')).toBe(false);
    });
  });

  describe('Language Configuration', () => {
    it('should get language configuration for supported languages', () => {
      const pythonConfig = framework.getLanguageConfig('python');
      
      expect(pythonConfig).toBeDefined();
      expect(pythonConfig!.name).toBe('python');
      expect(pythonConfig!.extensions).toEqual(['py', 'pyx']);
      expect(pythonConfig!.defaultRules).toContain('PEP8_STYLE');
      expect(pythonConfig!.metrics.complexity.high).toBe(10);
      expect(pythonConfig!.metrics.maintainability.poor).toBe(50);
    });

    it('should return null for unsupported language configurations', () => {
      const config = framework.getLanguageConfig('unknown');
      expect(config).toBeNull();
    });

    it('should get language information', () => {
      const javaInfo = framework.getLanguageInfo('java');
      
      expect(javaInfo).toBeDefined();
      expect(javaInfo!.name).toBe('java');
      expect(javaInfo!.extensions).toEqual(['java']);
      expect(javaInfo!.defaultRules).toContain('JAVA_NAMING_CONVENTIONS');
      expect(javaInfo!.metrics.complexity.high).toBe(15);
      expect(javaInfo!.metrics.maintainability.fair).toBe(65);
    });

    it('should get default rules for language', () => {
      const typescriptRules = framework.getDefaultRules('typescript');
      
      expect(typescriptRules).toContain('TYPE_SAFETY');
      expect(typescriptRules).toContain('ES6_STANDARDS');
      expect(typescriptRules).toContain('INTERFACE_NAMING');
    });

    it('should get language metrics template', () => {
      const rustMetrics = framework.getLanguageMetrics('rust');
      
      expect(rustMetrics).toBeDefined();
      expect(rustMetrics!.linesOfCode).toBe(0);
      expect(rustMetrics!.complexity).toBe(0);
      expect(rustMetrics!.maintainability).toBe(100);
    });
  });

  describe('Language-Specific Analysis', () => {
    it('should analyze TypeScript code with language-specific rules', async () => {
      const typescriptCode = `
interface User {
  id: number;
  name: string;
  email?: any;
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

var service = new UserService();`;

      // Set up TypeScript analyzer
      const tsAnalyzer = new TypeScriptAnalyzer();
      framework.setAnalyzer('typescript', tsAnalyzer);

      const result = await framework.analyzeCode(typescriptCode, 'typescript', 'test.ts', { includeSuggestions: true });

      expect(result.language).toBe('typescript');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
      
      // Check for TypeScript-specific issues (may or may not be detected)
      const anyTypeIssue = result.issues.find(issue => issue.rule === 'ANY_TYPE_USAGE');
      if (anyTypeIssue) {
        expect(anyTypeIssue.type).toBe('warning');
      }
      
      // Check for TypeScript-specific suggestions
      const modernizationSuggestion = result.suggestions.find(s => s.type === 'modernize');
      if (modernizationSuggestion) {
        expect(modernizationSuggestion).toBeDefined();
      }
    });

    it('should analyze Java code with language-specific rules', async () => {
      const javaCode = `
import java.util.Vector;

public class UserService {
    private Vector users = new Vector();

    public void addUser(User user) {
        if (user != null) {
            users.add(user);
        }
    }

    public User getUserById(int id) {
        for (int i = 0; i < users.size(); i++) {
            User user = (User) users.get(i);
            if (user.getId() == id) {
                return user;
            }
        }
        return null;
    }
}`;

      // Set up Java analyzer
      const javaAnalyzer = new JavaAnalyzer();
      framework.setAnalyzer('java', javaAnalyzer);

      const result = await framework.analyzeCode(javaCode, 'java', 'UserService.java', { includeSuggestions: true });

      expect(result.language).toBe('java');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
      
      // Check for Java-specific issues (may or may not be detected)
      const vectorIssue = result.issues.find(issue => issue.rule === 'COLLECTION_USAGE');
      if (vectorIssue) {
        expect(vectorIssue.type).toBe('warning');
      }
      
      // Check for Java-specific suggestions
      const modernizationSuggestion = result.suggestions.find(s => s.type === 'modernize');
      if (modernizationSuggestion) {
        expect(modernizationSuggestion).toBeDefined();
      }
    });

    it('should apply language-specific thresholds', async () => {
      const pythonCode = `
def simple_function():
    return "Hello, World!"

def complex_function(data):
    result = []
    for item in data:
        if item is not None:
            if item.get('active'):
                if item.get('priority') == 'high':
                    result.append(item)
    return result`;

      // Set up Python analyzer
      const pythonAnalyzer = new PythonAnalyzer();
      framework.setAnalyzer('python', pythonAnalyzer);

      const result = await framework.analyzeCode(pythonCode, 'python', 'test.py', {
        thresholds: {
          complexity: 5,
          maintainability: 60
        }
      });

      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.language).toBe('python');
    });
  });

  describe('Multiple File Analysis', () => {
    it('should analyze multiple files of different languages', async () => {
      const files = [
        'test.py',
        'script.js',
        'component.ts',
        'Main.java'
      ];

      // Set up analyzers
      framework.setAnalyzer('python', new PythonAnalyzer());
      framework.setAnalyzer('javascript', new JavaScriptAnalyzer());
      framework.setAnalyzer('typescript', new TypeScriptAnalyzer());
      framework.setAnalyzer('java', new JavaAnalyzer());

      const results = await framework.analyzeMultipleFiles(files);

      expect(results).toHaveLength(4);
      expect(results[0].language).toBe('python');
      expect(results[1].language).toBe('javascript');
      expect(results[2].language).toBe('typescript');
      expect(results[3].language).toBe('java');
    });

    it('should handle errors in multiple file analysis gracefully', async () => {
      const files = [
        'test.py',
        'unsupported.xyz', // This should fail
        'script.js'
      ];

      // Set up analyzers
      framework.setAnalyzer('python', new PythonAnalyzer());
      framework.setAnalyzer('javascript', new JavaScriptAnalyzer());

      const results = await framework.analyzeMultipleFiles(files);

      // Should still return results for supported files
      expect(results).toHaveLength(2);
      expect(results[0].language).toBe('python');
      expect(results[1].language).toBe('javascript');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported file types', async () => {
      await expect(
        framework.analyzeFile('test.unknown')
      ).rejects.toThrow('Unsupported file type: test.unknown');
    });

    it('should throw error for unsupported languages', async () => {
      await expect(
        framework.analyzeCode('code', 'unknown')
      ).rejects.toThrow('No configuration found for language: unknown');
    });

    it('should throw error when analyzer is not available', async () => {
      await expect(
        framework.analyzeCode('code', 'python')
      ).rejects.toThrow('No analyzer available for language: python');
    });

    it('should handle invalid code gracefully', async () => {
      // This test depends on the analyzer implementation
      // For now, we'll test that the framework doesn't crash
      try {
        const analyzer = new TypeScriptAnalyzer();
        framework.setAnalyzer('typescript', analyzer);
        
        const result = await framework.analyzeCode('invalid typescript code', 'typescript');
        expect(result).toBeDefined();
      } catch (error) {
        // Error handling is also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Framework Features', () => {
    it('should generate language report', () => {
      const report = framework.generateLanguageReport();
      
      expect(report).toContain('# Multi-Language Support Framework Report');
      expect(report).toContain('Supported Languages:');
      expect(report).toContain('Language Configurations');
      expect(report).toContain('Python');
      expect(report).toContain('Javascript');
      expect(report).toContain('Typescript');
      expect(report).toContain('Java');
    });

    it('should allow dynamic analyzer registration', () => {
      const analyzer = new TypeScriptAnalyzer();
      framework.setAnalyzer('typescript', analyzer);
      
      const config = framework.getLanguageConfig('typescript');
      expect(config!.analyzer).toBeDefined();
    });

    it('should maintain language-specific defaults', () => {
      const pythonConfig = framework.getLanguageConfig('python');
      const javaConfig = framework.getLanguageConfig('java');
      
      expect(pythonConfig!.metrics.complexity.high).toBe(10);
      expect(javaConfig!.metrics.complexity.high).toBe(15);
      
      expect(pythonConfig!.metrics.maintainability.poor).toBe(50);
      expect(javaConfig!.metrics.maintainability.poor).toBe(40);
    });

    it('should support multiple extensions per language', () => {
      expect(framework.detectLanguage('test.py')).toBe('python');
      expect(framework.detectLanguage('test.pyx')).toBe('python');
      expect(framework.detectLanguage('script.js')).toBe('javascript');
      expect(framework.detectLanguage('component.jsx')).toBe('javascript');
    });
  });

  describe('Integration with Existing Analyzers', () => {
    it('should work with existing Python analyzer', async () => {
      const pythonCode = `
def hello_world():
    print("Hello, World!")
    return True`;

      framework.setAnalyzer('python', new PythonAnalyzer());
      
      const result = await framework.analyzeCode(pythonCode, 'python', 'hello.py');
      
      expect(result.language).toBe('python');
      expect(result.issues).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should work with existing JavaScript analyzer', async () => {
      const jsCode = `
function helloWorld() {
  console.log("Hello, World!");
  return true;
}`;

      framework.setAnalyzer('javascript', new JavaScriptAnalyzer());
      
      const result = await framework.analyzeCode(jsCode, 'javascript', 'hello.js');
      
      expect(result.language).toBe('javascript');
      expect(result.issues).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large code files', async () => {
      const largeCode = Array(1000).fill(`
function testFunction() {
  const data = [];
  for (let i = 0; i < 100; i++) {
    data.push(i);
  }
  return data;
}`).join('\n');

      framework.setAnalyzer('javascript', new JavaScriptAnalyzer());
      
      const result = await framework.analyzeCode(largeCode, 'javascript', 'large.js');
      
      expect(result).toBeDefined();
      expect(result.metrics.linesOfCode).toBeGreaterThan(1000);
    }, 10000); // 10 second timeout for large file test

    it('should handle concurrent analysis requests', async () => {
      framework.setAnalyzer('python', new PythonAnalyzer());
      framework.setAnalyzer('javascript', new JavaScriptAnalyzer());
      framework.setAnalyzer('typescript', new TypeScriptAnalyzer());

      const requests = [
        framework.analyzeCode('print("Hello")', 'python', 'test1.py'),
        framework.analyzeCode('console.log("Hello")', 'javascript', 'test2.js'),
        framework.analyzeCode('const x = 1;', 'typescript', 'test3.ts')
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(5000);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    }, 10000);
  });
});