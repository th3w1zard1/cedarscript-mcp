import fs from 'fs/promises';
import path from 'path';

/**
 * File Operations class
 * Handles all file-related operations for CEDARScript
 */
export class FileOperations {
  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  /**
   * Write content to file
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.writeFile(filePath, content);
    } catch (error) {
      throw new Error(`Failed to write to file ${filePath}: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create backup of file
   */
  async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.bak`;
    try {
      await fs.copyFile(filePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup of ${filePath}: ${error}`);
    }
  }

  /**
   * Restore file from backup
   */
  async restoreFromBackup(filePath: string): Promise<void> {
    const backupPath = `${filePath}.bak`;
    try {
      await fs.copyFile(backupPath, filePath);
      await fs.unlink(backupPath);
    } catch (error) {
      throw new Error(`Failed to restore ${filePath} from backup: ${error}`);
    }
  }
}
