/**
 * File-based storage layer foundation.
 *
 * Provides atomic file writes, safe reads with error handling,
 * corruption recovery, and file locking for concurrent access prevention.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

import { AppError } from '@/utils/errors.js';

/**
 * Storage-specific error with file path context.
 */
export class StorageError extends AppError {
  public readonly filePath: string;
  public readonly reason?: 'corrupted' | 'locked' | 'permission' | 'not_found';

  constructor(message: string, filePath: string, reason?: StorageError['reason']) {
    const userMessage = StorageError.generateUserMessage(filePath, reason);
    super(message, userMessage);
    this.name = 'StorageError';
    this.filePath = filePath;
    this.reason = reason;
  }

  private static generateUserMessage(filePath: string, reason?: string): string {
    const fileName = path.basename(filePath);
    switch (reason) {
      case 'corrupted':
        return `Data file '${fileName}' is corrupted. It will be backed up and reset.`;
      case 'locked':
        return `Data file '${fileName}' is locked by another process. Please try again.`;
      case 'permission':
        return `Cannot access '${fileName}'. Please check file permissions.`;
      case 'not_found':
        return `Data file '${fileName}' not found.`;
      default:
        return `Storage error for '${fileName}'. Please check the data directory.`;
    }
  }
}

/**
 * Lock release function type.
 */
type ReleaseLock = () => Promise<void>;

/**
 * File-based storage with atomic writes and corruption recovery.
 */
export class Storage {
  private readonly dataDir: string;
  private readonly locks: Map<string, Promise<void>> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? getDataDir();
    ensureDataDir(this.dataDir);
  }

  /**
   * Get the data directory path.
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * Get full path for a data file.
   */
  getFilePath(filename: string): string {
    return path.join(this.dataDir, filename);
  }

  /**
   * Check if a file exists.
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Atomically write data to a file.
   * Uses temp file + rename pattern for crash safety.
   */
  async safeWrite<T>(filePath: string, data: T): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    const dir = path.dirname(filePath);

    try {
      // Ensure directory exists
      await fsp.mkdir(dir, { recursive: true });

      // Write to temp file
      const content = JSON.stringify(data, null, 2);
      await fsp.writeFile(tempPath, content, 'utf-8');

      // Atomic rename
      await fsp.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await fsp.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new StorageError(
        error instanceof Error ? error.message : 'Write failed',
        filePath,
        (error as NodeJS.ErrnoException).code === 'EACCES' ? 'permission' : undefined
      );
    }
  }

  /**
   * Read and parse JSON data from a file.
   * Returns null if file doesn't exist.
   * Throws StorageError for corrupted data.
   */
  async safeRead<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fsp.readFile(filePath, 'utf-8');

      if (!content.trim()) {
        throw new StorageError('File is empty', filePath, 'corrupted');
      }

      return JSON.parse(content) as T;
    } catch (error) {
      // File doesn't exist - return null
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      // Already a StorageError - rethrow
      if (error instanceof StorageError) {
        throw error;
      }

      // JSON parse error - corrupted
      if (error instanceof SyntaxError) {
        throw new StorageError(error.message, filePath, 'corrupted');
      }

      // Permission error
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new StorageError(
          error instanceof Error ? error.message : 'Read failed',
          filePath,
          'permission'
        );
      }

      // Other error
      throw new StorageError(error instanceof Error ? error.message : 'Read failed', filePath);
    }
  }

  /**
   * Load data with automatic recovery from corruption.
   * Creates backup of corrupted file and returns default data.
   */
  async loadWithRecovery<T>(
    filePath: string,
    defaultData: T,
    onRecovery?: (filePath: string, error: Error) => void
  ): Promise<T> {
    try {
      const data = await this.safeRead<T>(filePath);
      return data ?? defaultData;
    } catch (error) {
      if (error instanceof StorageError && error.reason === 'corrupted') {
        // Backup corrupted file
        await this.backupCorruptedFile(filePath);

        // Notify caller
        if (onRecovery) {
          onRecovery(filePath, error);
        }

        return defaultData;
      }

      throw error;
    }
  }

  /**
   * Delete a file.
   */
  async delete(filePath: string): Promise<void> {
    try {
      await fsp.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new StorageError(error instanceof Error ? error.message : 'Delete failed', filePath);
      }
    }
  }

  /**
   * Acquire a lock for a file path.
   * Returns a release function that must be called when done.
   */
  async acquireLock(filePath: string, timeout = 5000): Promise<ReleaseLock> {
    const startTime = Date.now();

    // Wait for existing lock to release
    while (this.locks.has(filePath)) {
      if (Date.now() - startTime > timeout) {
        throw new StorageError('Lock timeout', filePath, 'locked');
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Create a deferred promise for this lock
    let resolve: () => void;
    const lockPromise = new Promise<void>((r) => {
      resolve = r;
    });

    this.locks.set(filePath, lockPromise);

    // Return release function
    const release: ReleaseLock = async () => {
      this.locks.delete(filePath);
      resolve!();
    };

    return release;
  }

  /**
   * Backup a corrupted file for debugging.
   */
  private async backupCorruptedFile(filePath: string): Promise<void> {
    if (!this.exists(filePath)) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.corrupted-${timestamp}`;

    try {
      await fsp.copyFile(filePath, backupPath);
    } catch {
      // Ignore backup errors - not critical
    }
  }
}

// Module-level singleton
let defaultStorage: Storage | null = null;

/**
 * Get the default storage singleton.
 */
export function getStorage(dataDir?: string): Storage {
  if (!defaultStorage) {
    defaultStorage = new Storage(dataDir);
  }
  return defaultStorage;
}

/**
 * Reset the storage singleton (for testing).
 */
export function resetStorage(): void {
  defaultStorage = null;
}

/**
 * Get the default data directory path.
 */
export function getDataDir(): string {
  return path.join(os.homedir(), '.social-agent', 'data');
}

/**
 * Ensure the data directory exists.
 */
export function ensureDataDir(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
}
