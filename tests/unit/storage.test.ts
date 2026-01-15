import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  Storage,
  getStorage,
  resetStorage,
  getDataDir,
  ensureDataDir,
  StorageError,
} from '@/storage/index.js';

describe('StorageError', () => {
  it('should create error with file path', () => {
    const error = new StorageError('Failed to read', '/path/to/file.json');
    expect(error.message).toBe('Failed to read');
    expect(error.filePath).toBe('/path/to/file.json');
    expect(error.name).toBe('StorageError');
  });

  it('should provide user-friendly message', () => {
    const error = new StorageError('ENOENT: no such file', '/path/to/file.json');
    expect(error.userMessage).toContain('file.json');
  });

  it('should handle corruption scenario', () => {
    const error = new StorageError('Unexpected token', '/data/queue.json', 'corrupted');
    expect(error.reason).toBe('corrupted');
    expect(error.userMessage).toContain('corrupted');
  });
});

describe('Storage', () => {
  let testDataDir: string;

  beforeEach(() => {
    resetStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    resetStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create storage with custom directory', () => {
      const storage = new Storage(testDataDir);
      expect(storage.getDataDir()).toBe(testDataDir);
    });

    it('should use default directory if not specified', () => {
      const storage = new Storage();
      expect(storage.getDataDir()).toBe(path.join(os.homedir(), '.social-agent', 'data'));
    });

    it('should create directory if it does not exist', () => {
      const newDir = path.join(testDataDir, 'nested', 'data');
      expect(fs.existsSync(newDir)).toBe(false);

      new Storage(newDir);
      expect(fs.existsSync(newDir)).toBe(true);
    });
  });

  describe('safeWrite', () => {
    it('should write JSON data to file', async () => {
      const storage = new Storage(testDataDir);
      const data = { version: 1, items: [{ id: '1', name: 'test' }] };
      const filePath = path.join(testDataDir, 'test.json');

      await storage.safeWrite(filePath, data);

      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content).toEqual(data);
    });

    it('should format JSON with indentation', async () => {
      const storage = new Storage(testDataDir);
      const data = { key: 'value' };
      const filePath = path.join(testDataDir, 'formatted.json');

      await storage.safeWrite(filePath, data);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('\n'); // Has newlines (formatted)
    });

    it('should perform atomic write (temp file then rename)', async () => {
      const storage = new Storage(testDataDir);
      const data = { key: 'value' };
      const filePath = path.join(testDataDir, 'atomic.json');

      await storage.safeWrite(filePath, data);

      // Temp file should be cleaned up
      expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should overwrite existing file', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'overwrite.json');

      await storage.safeWrite(filePath, { version: 1 });
      await storage.safeWrite(filePath, { version: 2 });

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.version).toBe(2);
    });

    it('should throw StorageError on write failure', async () => {
      const storage = new Storage(testDataDir);
      const invalidPath = '/nonexistent/deeply/nested/path/file.json';

      await expect(storage.safeWrite(invalidPath, { key: 'value' })).rejects.toThrow(StorageError);
    });

    it('should create parent directories if needed', async () => {
      const storage = new Storage(testDataDir);
      const nestedPath = path.join(testDataDir, 'nested', 'dir', 'file.json');

      await storage.safeWrite(nestedPath, { key: 'value' });

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('safeRead', () => {
    it('should read JSON data from file', async () => {
      const storage = new Storage(testDataDir);
      const data = { version: 1, items: ['a', 'b'] };
      const filePath = path.join(testDataDir, 'read.json');
      fs.writeFileSync(filePath, JSON.stringify(data));

      const result = await storage.safeRead<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should return null for non-existent file', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'nonexistent.json');

      const result = await storage.safeRead(filePath);

      expect(result).toBeNull();
    });

    it('should throw StorageError for corrupted JSON', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'corrupted.json');
      fs.writeFileSync(filePath, '{ invalid json }');

      await expect(storage.safeRead(filePath)).rejects.toThrow(StorageError);
    });

    it('should throw StorageError with corrupted reason', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'corrupted.json');
      fs.writeFileSync(filePath, 'not json at all');

      try {
        await storage.safeRead(filePath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).reason).toBe('corrupted');
      }
    });

    it('should handle empty file as corrupted', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'empty.json');
      fs.writeFileSync(filePath, '');

      await expect(storage.safeRead(filePath)).rejects.toThrow(StorageError);
    });
  });

  describe('loadWithRecovery', () => {
    it('should load valid data normally', async () => {
      const storage = new Storage(testDataDir);
      const data = { version: 1, items: [] };
      const filePath = path.join(testDataDir, 'valid.json');
      fs.writeFileSync(filePath, JSON.stringify(data));

      const result = await storage.loadWithRecovery(filePath, { version: 1, items: [] });

      expect(result).toEqual(data);
    });

    it('should return default for non-existent file', async () => {
      const storage = new Storage(testDataDir);
      const defaultData = { version: 1, items: [] };
      const filePath = path.join(testDataDir, 'nonexistent.json');

      const result = await storage.loadWithRecovery(filePath, defaultData);

      expect(result).toEqual(defaultData);
    });

    it('should return default for corrupted file', async () => {
      const storage = new Storage(testDataDir);
      const defaultData = { version: 1, items: [] };
      const filePath = path.join(testDataDir, 'corrupted.json');
      fs.writeFileSync(filePath, 'corrupted data');

      const result = await storage.loadWithRecovery(filePath, defaultData);

      expect(result).toEqual(defaultData);
    });

    it('should create backup of corrupted file', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'corrupted.json');
      fs.writeFileSync(filePath, 'corrupted data');

      await storage.loadWithRecovery(filePath, { version: 1 });

      // Check backup was created
      const files = fs.readdirSync(testDataDir);
      const backupFile = files.find((f) => f.startsWith('corrupted.json.corrupted-'));
      expect(backupFile).toBeDefined();
    });

    it('should call onRecovery callback when recovering', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'corrupted.json');
      fs.writeFileSync(filePath, 'corrupted');
      const onRecovery = vi.fn();

      await storage.loadWithRecovery(filePath, { version: 1 }, onRecovery);

      expect(onRecovery).toHaveBeenCalledWith(filePath, expect.any(Error));
    });
  });

  describe('exists', () => {
    it('should return true for existing file', () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'exists.json');
      fs.writeFileSync(filePath, '{}');

      expect(storage.exists(filePath)).toBe(true);
    });

    it('should return false for non-existent file', () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'nonexistent.json');

      expect(storage.exists(filePath)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing file', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'delete.json');
      fs.writeFileSync(filePath, '{}');

      await storage.delete(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'nonexistent.json');

      await expect(storage.delete(filePath)).resolves.not.toThrow();
    });
  });

  describe('getFilePath', () => {
    it('should return full path for data file', () => {
      const storage = new Storage(testDataDir);

      expect(storage.getFilePath('queue.json')).toBe(path.join(testDataDir, 'queue.json'));
    });
  });

  describe('file locking', () => {
    it('should acquire and release lock', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'locked.json');

      const release = await storage.acquireLock(filePath);
      expect(typeof release).toBe('function');

      await release();
    });

    it('should prevent concurrent writes to same file', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'concurrent.json');

      const release1 = await storage.acquireLock(filePath);

      // Second lock should wait (we'll just verify the mechanism exists)
      const lockPromise = storage.acquireLock(filePath, 100);

      // Should timeout waiting for lock
      await expect(lockPromise).rejects.toThrow();

      await release1();
    });

    it('should allow lock acquisition after release', async () => {
      const storage = new Storage(testDataDir);
      const filePath = path.join(testDataDir, 'relock.json');

      const release1 = await storage.acquireLock(filePath);
      await release1();

      const release2 = await storage.acquireLock(filePath);
      expect(typeof release2).toBe('function');
      await release2();
    });
  });
});

describe('getStorage singleton', () => {
  let testDataDir: string;

  beforeEach(() => {
    resetStorage();
    testDataDir = path.join(
      os.tmpdir(),
      `storage-singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    resetStorage();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('should return singleton instance', () => {
    const storage1 = getStorage(testDataDir);
    const storage2 = getStorage();

    expect(storage1).toBe(storage2);
  });

  it('should reset singleton correctly', () => {
    const storage1 = getStorage(testDataDir);
    resetStorage();
    const storage2 = getStorage(testDataDir);

    expect(storage1).not.toBe(storage2);
  });
});

describe('getDataDir', () => {
  it('should return default data directory path', () => {
    const expected = path.join(os.homedir(), '.social-agent', 'data');
    expect(getDataDir()).toBe(expected);
  });
});

describe('ensureDataDir', () => {
  let testBaseDir: string;

  beforeEach(() => {
    testBaseDir = path.join(
      os.tmpdir(),
      `ensure-data-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it('should create data directory if it does not exist', () => {
    const dataDir = path.join(testBaseDir, '.social-agent', 'data');
    expect(fs.existsSync(dataDir)).toBe(false);

    ensureDataDir(dataDir);

    expect(fs.existsSync(dataDir)).toBe(true);
  });

  it('should not throw if directory already exists', () => {
    const dataDir = path.join(testBaseDir, '.social-agent', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    expect(() => ensureDataDir(dataDir)).not.toThrow();
  });
});
