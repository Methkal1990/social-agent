import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  Logger,
  AIReasoningLogger,
  getLogger,
  getAIReasoningLogger,
  resetLoggers,
  type LogLevel,
} from '@/utils/logger.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let testLogsDir: string;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    resetLoggers();
    // Create a unique test directory for each test
    testLogsDir = path.join(
      os.tmpdir(),
      `logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    resetLoggers();
    // Clean up test directory
    if (fs.existsSync(testLogsDir)) {
      fs.rmSync(testLogsDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create logger with default options', () => {
      const logger = new Logger({ enableFile: false });
      expect(logger.getLevel()).toBe('info');
    });

    it('should create logger with custom level', () => {
      const logger = new Logger({ level: 'debug', enableFile: false });
      expect(logger.getLevel()).toBe('debug');
    });

    it('should create logs directory if file logging enabled', () => {
      expect(fs.existsSync(testLogsDir)).toBe(false);
      new Logger({ enableFile: true, logsDir: testLogsDir });
      expect(fs.existsSync(testLogsDir)).toBe(true);
    });
  });

  describe('log levels', () => {
    it('should log error messages at all levels', () => {
      const levels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

      for (const level of levels) {
        consoleSpy.mockClear();
        const logger = new Logger({ level, enableFile: false });
        logger.error('test error');
        expect(consoleSpy).toHaveBeenCalled();
      }
    });

    it('should not log debug messages at info level', () => {
      const logger = new Logger({ level: 'info', enableFile: false });
      logger.debug('test debug');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should not log trace messages at debug level', () => {
      const logger = new Logger({ level: 'debug', enableFile: false });
      logger.trace('test trace');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log all messages at trace level', () => {
      const logger = new Logger({ level: 'trace', enableFile: false });

      logger.error('error');
      logger.warn('warn');
      logger.info('info');
      logger.debug('debug');
      logger.trace('trace');

      expect(consoleSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('log methods', () => {
    it('should log error with context', () => {
      const logger = new Logger({ level: 'error', enableFile: false });
      logger.error('test error', { code: 500 });
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('ERROR');
      expect(output).toContain('test error');
    });

    it('should log warn messages', () => {
      const logger = new Logger({ level: 'warn', enableFile: false });
      logger.warn('test warning');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('WARN');
    });

    it('should log info messages', () => {
      const logger = new Logger({ level: 'info', enableFile: false });
      logger.info('test info');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('INFO');
    });

    it('should log debug messages when level is debug', () => {
      const logger = new Logger({ level: 'debug', enableFile: false });
      logger.debug('test debug');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('DEBUG');
    });

    it('should log trace messages when level is trace', () => {
      const logger = new Logger({ level: 'trace', enableFile: false });
      logger.trace('test trace');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('TRACE');
    });
  });

  describe('setLevel', () => {
    it('should change log level dynamically', () => {
      const logger = new Logger({ level: 'info', enableFile: false });

      logger.debug('should not log');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.setLevel('debug');
      logger.debug('should log now');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('file logging', () => {
    it('should write to log file when enabled', () => {
      const logger = new Logger({
        level: 'info',
        enableFile: true,
        enableConsole: false,
        logsDir: testLogsDir,
      });
      logger.info('test message');
      logger.close();

      // Check that log file was created
      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('social-agent-'));
      expect(logFile).toBeDefined();

      // Check content
      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');
      expect(content).toContain('test message');
      expect(content).toContain('INFO');
    });

    it('should include timestamp in file output', () => {
      const logger = new Logger({
        level: 'info',
        enableFile: true,
        enableConsole: false,
        logsDir: testLogsDir,
      });
      logger.info('timestamp test');
      logger.close();

      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('social-agent-'));
      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');

      // Check for ISO timestamp format
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('close', () => {
    it('should close log stream gracefully', () => {
      const logger = new Logger({ enableFile: true, enableConsole: false, logsDir: testLogsDir });
      logger.info('test');
      logger.close();

      // Should be able to log again after close (will create new stream)
      logger.info('test2');
      logger.close();
    });
  });
});

describe('AIReasoningLogger', () => {
  let testLogsDir: string;

  beforeEach(() => {
    resetLoggers();
    testLogsDir = path.join(
      os.tmpdir(),
      `ai-reasoning-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  });

  afterEach(() => {
    resetLoggers();
    if (fs.existsSync(testLogsDir)) {
      fs.rmSync(testLogsDir, { recursive: true, force: true });
    }
  });

  describe('logDecision', () => {
    it('should log AI decision with full context', () => {
      const logger = new AIReasoningLogger(testLogsDir);
      logger.logDecision({
        decisionType: 'test',
        input: { key: 'value' },
        factors: ['factor1', 'factor2'],
        reasoning: 'test reasoning',
        decision: 'approved',
        confidence: 0.95,
      });
      logger.close();

      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('ai-reasoning-'));
      expect(logFile).toBeDefined();

      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.decisionType).toBe('test');
      expect(parsed.confidence).toBe(0.95);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.factors).toEqual(['factor1', 'factor2']);
    });
  });

  describe('specialized logging methods', () => {
    it('should log content generation decision', () => {
      const logger = new AIReasoningLogger(testLogsDir);
      logger.logContentGeneration(
        { topic: 'AI trends' },
        'Generated based on trending topics',
        'Here is a great tweet about AI...',
        0.85
      );
      logger.close();

      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('ai-reasoning-'));
      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.decisionType).toBe('content_generation');
      expect(parsed.confidence).toBe(0.85);
    });

    it('should log reply generation decision', () => {
      const logger = new AIReasoningLogger(testLogsDir);
      logger.logReplyGeneration(
        'What do you think about AI?',
        { author: 'user123' },
        'Replied with educational content',
        'AI is fascinating because...',
        0.9
      );
      logger.close();

      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('ai-reasoning-'));
      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.decisionType).toBe('reply_generation');
      expect(parsed.input.originalTweet).toBe('What do you think about AI?');
    });

    it('should log engagement decision', () => {
      const logger = new AIReasoningLogger(testLogsDir);
      logger.logEngagementDecision(
        'follow',
        { username: 'techleader', followers: 50000 },
        'High relevance to niche',
        'engage',
        0.88
      );
      logger.close();

      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('ai-reasoning-'));
      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.decisionType).toBe('engagement_follow');
      expect(parsed.decision).toBe('engage');
    });

    it('should log moderation decision', () => {
      const logger = new AIReasoningLogger(testLogsDir);
      logger.logModerationDecision(
        'Some content to check',
        ['keyword_filter', 'ai_safety'],
        'Content passed all checks',
        'pass'
      );
      logger.close();

      const files = fs.readdirSync(testLogsDir);
      const logFile = files.find((f) => f.startsWith('ai-reasoning-'));
      const content = fs.readFileSync(path.join(testLogsDir, logFile!), 'utf-8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.decisionType).toBe('moderation');
      expect(parsed.decision).toBe('pass');
    });
  });

  describe('getReasoningHistory', () => {
    it('should return empty array if file does not exist', async () => {
      const logger = new AIReasoningLogger(testLogsDir);
      const history = await logger.getReasoningHistory('2020-01-01');
      expect(history).toEqual([]);
    });

    it('should parse reasoning history from file', async () => {
      const logger = new AIReasoningLogger(testLogsDir);

      // Log multiple decisions
      logger.logDecision({
        decisionType: 'test1',
        input: {},
        factors: [],
        reasoning: 'reason1',
        decision: 'yes',
      });
      logger.logDecision({
        decisionType: 'test2',
        input: {},
        factors: [],
        reasoning: 'reason2',
        decision: 'no',
      });
      logger.close();

      // Read back
      const history = await logger.getReasoningHistory();
      expect(history).toHaveLength(2);
      expect(history[0].decisionType).toBe('test1');
      expect(history[1].decisionType).toBe('test2');
    });
  });
});

describe('Singleton functions', () => {
  let testLogsDir: string;

  beforeEach(() => {
    resetLoggers();
    testLogsDir = path.join(
      os.tmpdir(),
      `singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  });

  afterEach(() => {
    resetLoggers();
    if (fs.existsSync(testLogsDir)) {
      fs.rmSync(testLogsDir, { recursive: true, force: true });
    }
  });

  describe('getLogger', () => {
    it('should return singleton instance', () => {
      const logger1 = getLogger({ enableFile: false });
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
    });
  });

  describe('getAIReasoningLogger', () => {
    it('should return singleton instance', () => {
      const logger1 = getAIReasoningLogger(testLogsDir);
      const logger2 = getAIReasoningLogger();

      expect(logger1).toBe(logger2);
    });
  });

  describe('resetLoggers', () => {
    it('should reset singleton instances', () => {
      const logger1 = getLogger({ enableFile: false });
      resetLoggers();
      const logger2 = getLogger({ enableFile: false });

      expect(logger1).not.toBe(logger2);
    });
  });
});
