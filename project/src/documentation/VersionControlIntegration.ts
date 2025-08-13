import * as fs from 'fs/promises';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { DocumentationVersion, DocumentationComparison, DocumentationChange } from './types';

export class VersionControlIntegration {
  private docsDirectory: string;
  private versionsDirectory: string;
  private currentVersion: string;

  constructor(docsDirectory: string = './docs') {
    this.docsDirectory = docsDirectory;
    this.versionsDirectory = path.join(docsDirectory, '.versions');
    this.currentVersion = '1.0.0';
  }

  async initialize(): Promise<void> {
    try {
      await fse.ensureDir(this.docsDirectory);
      await fse.ensureDir(this.versionsDirectory);
      
      // Create initial version file if it doesn't exist
      const versionFile = path.join(this.versionsDirectory, 'current-version.json');
      try {
        const versionData = JSON.parse(await fs.readFile(versionFile, 'utf-8'));
        this.currentVersion = versionData.version;
      } catch {
        await this.saveCurrentVersion();
      }
    } catch (error) {
      Logger.error(`Failed to initialize version control: ${error}`);
      throw error;
    }
  }

  async saveDocumentationVersion(
    projectPath: string,
    documentation: any,
    message: string,
    author: string = 'System'
  ): Promise<DocumentationVersion> {
    try {
      await this.initialize();
      
      const version = this.incrementVersion(this.currentVersion);
      const timestamp = new Date().toISOString();
      
      const versionInfo: DocumentationVersion = {
        id: `v${version}`,
        version,
        timestamp,
        author,
        message,
        changes: await this.generateChanges(projectPath, version),
        files: await this.getDocumentationFiles(),
        size: JSON.stringify(documentation).length,
      };

      // Save version metadata
      const versionFile = path.join(this.versionsDirectory, `${version}.json`);
      await fs.writeFile(versionFile, JSON.stringify(versionInfo, null, 2));
      
      // Save documentation snapshot
      const snapshotFile = path.join(this.versionsDirectory, `${version}-snapshot.json`);
      await fs.writeFile(snapshotFile, JSON.stringify(documentation, null, 2));
      
      // Update current version
      this.currentVersion = version;
      await this.saveCurrentVersion();
      
      Logger.info(`Documentation version ${version} saved: ${message}`);
      return versionInfo;
    } catch (error) {
      Logger.error(`Failed to save documentation version: ${error}`);
      throw error;
    }
  }

  async getDocumentationHistory(
    _projectPath: string,
    limit: number = 10
  ): Promise<DocumentationVersion[]> {
    try {
      await this.initialize();
      
      const files = await fs.readdir(this.versionsDirectory);
      const versionFiles = files
        .filter(f => f.match(/^\d+\.\d+\.\d+\.json$/))
        .sort()
        .reverse()
        .slice(0, limit);
      
      const versions: DocumentationVersion[] = [];
      
      for (const file of versionFiles) {
        try {
          const content = await fs.readFile(path.join(this.versionsDirectory, file), 'utf-8');
          const version = JSON.parse(content);
          versions.push(version);
        } catch (error) {
          Logger.warn(`Failed to read version file ${file}: ${error}`);
        }
      }
      
      return versions;
    } catch (error) {
      Logger.error(`Failed to get documentation history: ${error}`);
      return [];
    }
  }

  async compareDocumentationVersions(
    _projectPath: string,
    version1: string,
    version2: string
  ): Promise<DocumentationComparison> {
    try {
      await this.initialize();
      
      const doc1 = await this.loadVersionDocumentation(version1);
      const doc2 = await this.loadVersionDocumentation(version2);
      
      const comparison: DocumentationComparison = {
        version1,
        version2,
        timestamp: new Date().toISOString(),
        changes: {
          added: [],
          modified: [],
          deleted: [],
        },
        summary: {
          filesAdded: 0,
          filesModified: 0,
          filesDeleted: 0,
          linesAdded: 0,
          linesDeleted: 0,
        },
      };

      if (doc1 && doc2) {
        const diff = this.compareDocuments(doc1, doc2);
        comparison.changes = diff.changes;
        comparison.summary = diff.summary;
      }

      return comparison;
    } catch (error) {
      Logger.error(`Failed to compare documentation versions: ${error}`);
      throw error;
    }
  }

  async revertDocumentationVersion(
    projectPath: string,
    version: string
  ): Promise<boolean> {
    try {
      await this.initialize();
      
      const snapshot = await this.loadVersionDocumentation(version);
      if (!snapshot) {
        throw new Error(`Version ${version} not found`);
      }
      
      // Restore the documentation
      await this.restoreDocumentation(snapshot, projectPath);
      
      // Create a new version for the revert
      await this.saveDocumentationVersion(
        projectPath,
        snapshot,
        `Reverted to version ${version}`
      );
      
      Logger.info(`Documentation reverted to version ${version}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to revert documentation version: ${error}`);
      return false;
    }
  }

  async getCurrentVersion(): Promise<string> {
    await this.initialize();
    return this.currentVersion;
  }

  async getDocumentationFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.docsDirectory);
      return files
        .filter(f => !f.startsWith('.') && !f.startsWith('versions'))
        .map(f => path.join(this.docsDirectory, f));
    } catch (error) {
      Logger.warn(`Failed to get documentation files: ${error}`);
      return [];
    }
  }

  async createTag(version: string, message: string): Promise<void> {
    try {
      await this.initialize();
      
      const tagFile = path.join(this.versionsDirectory, `tags.json`);
      let tags: Record<string, string> = {};
      
      try {
        const existingTags = await fs.readFile(tagFile, 'utf-8');
        tags = JSON.parse(existingTags);
      } catch {
        // Tags file doesn't exist, create new one
      }
      
      tags[version] = message;
      await fs.writeFile(tagFile, JSON.stringify(tags, null, 2));
      
      Logger.info(`Tag created for version ${version}: ${message}`);
    } catch (error) {
      Logger.error(`Failed to create tag: ${error}`);
      throw error;
    }
  }

  async getTags(): Promise<Record<string, string>> {
    try {
      await this.initialize();
      
      const tagFile = path.join(this.versionsDirectory, `tags.json`);
      const tags = JSON.parse(await fs.readFile(tagFile, 'utf-8'));
      return tags;
    } catch (error) {
      Logger.warn(`Failed to get tags: ${error}`);
      return {};
    }
  }

  async createBranch(branchName: string, fromVersion?: string): Promise<void> {
    try {
      await this.initialize();
      
      const baseVersion = fromVersion || this.currentVersion;
      const branchDir = path.join(this.versionsDirectory, 'branches', branchName);
      
      await fse.ensureDir(branchDir);
      
      // Copy the base version to the branch
      const snapshot = await this.loadVersionDocumentation(baseVersion);
      if (snapshot) {
        await fs.writeFile(
          path.join(branchDir, 'snapshot.json'),
          JSON.stringify(snapshot, null, 2)
        );
      }
      
      // Create branch metadata
      const branchInfo = {
        name: branchName,
        baseVersion,
        createdAt: new Date().toISOString(),
        currentVersion: baseVersion,
      };
      
      await fs.writeFile(
        path.join(branchDir, 'branch.json'),
        JSON.stringify(branchInfo, null, 2)
      );
      
      Logger.info(`Branch ${branchName} created from version ${baseVersion}`);
    } catch (error) {
      Logger.error(`Failed to create branch: ${error}`);
      throw error;
    }
  }

  async getBranches(): Promise<any[]> {
    try {
      await this.initialize();
      
      const branchesDir = path.join(this.versionsDirectory, 'branches');
      const branches = await fs.readdir(branchesDir);
      
      const branchInfos: any[] = [];
      
      for (const branch of branches) {
        try {
          const branchFile = path.join(branchesDir, branch, 'branch.json');
          const branchInfo = JSON.parse(await fs.readFile(branchFile, 'utf-8'));
          branchInfos.push(branchInfo);
        } catch (error) {
          Logger.warn(`Failed to read branch info for ${branch}: ${error}`);
        }
      }
      
      return branchInfos;
    } catch (error) {
      Logger.warn(`Failed to get branches: ${error}`);
      return [];
    }
  }

  async mergeBranch(branchName: string, message: string): Promise<void> {
    try {
      await this.initialize();
      
      const branchDir = path.join(this.versionsDirectory, 'branches', branchName);
      //const branchFile = path.join(branchDir, 'branch.json');
      const snapshotFile = path.join(branchDir, 'snapshot.json');
      
      // const branchInfo = JSON.parse(await fs.readFile(branchFile, 'utf-8'));
      const _snapshot = JSON.parse(await fs.readFile(snapshotFile, 'utf-8'));
      
      // Merge the branch snapshot into main
      await this.saveDocumentationVersion(
        '',
        _snapshot,
        `Merged branch ${branchName}: ${message}`
      );
      
      // Clean up branch
      await fs.rm(branchDir, { recursive: true });
      
      Logger.info(`Branch ${branchName} merged successfully`);
    } catch (error) {
      Logger.error(`Failed to merge branch: ${error}`);
      throw error;
    }
  }

  private async saveCurrentVersion(): Promise<void> {
    const versionFile = path.join(this.versionsDirectory, 'current-version.json');
    await fs.writeFile(versionFile, JSON.stringify({ version: this.currentVersion }, null, 2));
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }

  private async generateChanges(_projectPath: string, newVersion: string): Promise<DocumentationChange[]> {
    const changes: DocumentationChange[] = [];
    
    try {
      const previousVersion = this.getPreviousVersion(newVersion);
      if (previousVersion) {
        const previousFiles = await this.getVersionFiles(previousVersion);
        const currentFiles = await this.getDocumentationFiles();
        
        // Compare files to generate changes
        const fileSet = new Set([...previousFiles, ...currentFiles]);
        
        for (const file of fileSet) {
          const inPrevious = previousFiles.includes(file);
          const inCurrent = currentFiles.includes(file);
          
          if (inPrevious && !inCurrent) {
            changes.push({
              type: 'deleted',
              path: file,
              description: `Deleted ${path.basename(file)}`,
            });
          } else if (!inPrevious && inCurrent) {
            changes.push({
              type: 'added',
              path: file,
              description: `Added ${path.basename(file)}`,
            });
          } else if (inPrevious && inCurrent) {
            // Check if file was modified
            const previousContent = await this.getFileContent(file, previousVersion);
            const currentContent = await fs.readFile(file, 'utf-8');
            
            if (previousContent !== currentContent) {
              changes.push({
                type: 'modified',
                path: file,
                description: `Modified ${path.basename(file)}`,
                diff: this.generateDiff(previousContent, currentContent),
              });
            }
          }
        }
      } else {
        // First version, all files are added
        const files = await this.getDocumentationFiles();
        for (const file of files) {
          changes.push({
            type: 'added',
            path: file,
            description: `Added ${path.basename(file)}`,
          });
        }
      }
    } catch (error) {
      Logger.warn(`Failed to generate changes: ${error}`);
    }
    
    return changes;
  }

  private getPreviousVersion(version: string): string | null {
    const parts = version.split('.').map(Number);
    if (parts[2] > 0) {
      parts[2]--;
      return parts.join('.');
    }
    return null;
  }

  private async getVersionFiles(version: string): Promise<string[]> {
    try {
      const snapshot = await this.loadVersionDocumentation(version);
      if (snapshot && snapshot.files) {
        return snapshot.files;
      }
      return [];
    } catch (error) {
      Logger.warn(`Failed to get version files for ${version}: ${error}`);
      return [];
    }
  }

  private async loadVersionDocumentation(version: string): Promise<any> {
    try {
      const snapshotFile = path.join(this.versionsDirectory, `${version}-snapshot.json`);
      const content = await fs.readFile(snapshotFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      Logger.warn(`Failed to load version documentation for ${version}: ${error}`);
      return null;
    }
  }

  private async getFileContent(filePath: string, version: string): Promise<string> {
    try {
      const snapshot = await this.loadVersionDocumentation(version);
      if (snapshot && snapshot.content) {
        return snapshot.content;
      }
      return '';
    } catch (error) {
      Logger.warn(`Failed to get file content for ${filePath} at version ${version}: ${error}`);
      return '';
    }
  }

  private generateDiff(oldContent: string, newContent: string): string {
    // Simple diff implementation
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff: string[] = [];
    
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        // No change
        i++;
        j++;
      } else {
        // Difference found
        if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
          diff.push(`- ${oldLines[i]}`);
          i++;
        }
        if (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
          diff.push(`+ ${newLines[j]}`);
          j++;
        }
      }
    }
    
    return diff.join('\n');
  }

  private compareDocuments(doc1: any, doc2: any): any {
    const changes: any = {
      added: [],
      modified: [],
      deleted: [],
    };
    
    const summary = {
      filesAdded: 0,
      filesModified: 0,
      filesDeleted: 0,
      linesAdded: 0,
      linesDeleted: 0,
    };
    
    // Simple comparison logic
    const doc1Str = JSON.stringify(doc1, null, 2);
    const doc2Str = JSON.stringify(doc2, null, 2);
    
    if (doc1Str !== doc2Str) {
      changes.modified.push({
        path: 'documentation',
        description: 'Documentation content changed',
      });
      summary.filesModified = 1;
      
      // Count line differences
      const doc1Lines = doc1Str.split('\n');
      const doc2Lines = doc2Str.split('\n');
      summary.linesAdded = Math.max(0, doc2Lines.length - doc1Lines.length);
      summary.linesDeleted = Math.max(0, doc1Lines.length - doc2Lines.length);
    }
    
    return { changes, summary };
  }

  private async restoreDocumentation(documentation: any, _projectPath: string): Promise<void> {
    // Restore documentation files
    if (documentation.files) {
      for (const file of documentation.files) {
        try {
          await fse.ensureDir(path.dirname(file.path));
          await fs.writeFile(file.path, file.content || '');
        } catch (error) {
          Logger.warn(`Failed to restore file ${file.path}: ${error}`);
        }
      }
    }
  }
}