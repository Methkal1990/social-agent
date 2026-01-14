/**
 * Logging system with configurable levels and file output.
 *
 * Supports multiple log levels, file-based logging with rotation,
 * and colorized console output.
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const LOG_LEVEL_COLORS: Record<LogLevel, (text: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  debug: chalk.gray,
  trace: chalk.dim,
};

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: 'ERROR',
  warn: 'WARN ',
  info: 'INFO ',
  debug: 'DEBUG',
  trace: 'TRACE',
};

export interface LoggerOptions {
  level?: LogLevel;
  logsDir?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export class Logger {
  private level: LogLevel;
  private logsDir: string;
  private enableConsole: boolean;
  private enableFile: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info';
    this.logsDir = options.logsDir ?? process.env.LOGS_DIR ?? path.join(process.cwd(), 'logs');
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? true;

    if (this.enableFile) {
      this.ensureLogsDir();
    }
  }

  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private getLogFilePath(filename: string = 'social-agent'): string {
    const dateStr = this.getDateString();
    return path.join(this.logsDir, `${filename}-${dateStr}.log`);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const colorFn = LOG_LEVEL_COLORS[entry.level];
    const label = LOG_LEVEL_LABELS[entry.level];
    const timestamp = chalk.dim(entry.timestamp);
    const message = colorFn(entry.message);

    let output = `${timestamp} ${colorFn(`[${label}]`)} ${message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += '\n' + chalk.dim(JSON.stringify(entry.context, null, 2));
    }

    return output;
  }

  private formatFileMessage(entry: LogEntry): string {
    const label = LOG_LEVEL_LABELS[entry.level];
    let output = `${entry.timestamp} [${label}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ' ' + JSON.stringify(entry.context);
    }

    return output + '\n';
  }

  private writeToFile(message: string): void {
    if (!this.enableFile) return;
    fs.appendFileSync(this.getLogFilePath(), message);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level,
      message,
      context,
    };

    // Console output
    if (this.enableConsole) {
      console.log(this.formatConsoleMessage(entry));
    }

    // File output (synchronous for reliability)
    this.writeToFile(this.formatFileMessage(entry));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }

  /**
   * Set the log level dynamically.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Close the logger (no-op for sync writes, kept for API compatibility).
   */
  close(): void {
    // No-op - using synchronous writes
  }
}

/**
 * AI Reasoning Logger - specialized logger for AI decision transparency.
 *
 * Logs all AI decisions with full context, reasoning chain, and outcomes
 * to a dedicated ai-reasoning.log file.
 */
export interface AIReasoningEntry {
  timestamp: string;
  decisionType: string;
  input: Record<string, unknown>;
  factors: string[];
  reasoning: string;
  decision: string;
  confidence?: number;
  outcome?: string;
}

export class AIReasoningLogger {
  private logsDir: string;

  constructor(logsDir?: string) {
    this.logsDir = logsDir ?? process.env.LOGS_DIR ?? path.join(process.cwd(), 'logs');
    this.ensureLogsDir();
  }

  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getLogFilePath(): string {
    const dateStr = this.getDateString();
    return path.join(this.logsDir, `ai-reasoning-${dateStr}.log`);
  }

  /**
   * Log an AI decision with full context and reasoning.
   */
  logDecision(entry: Omit<AIReasoningEntry, 'timestamp'>): void {
    const fullEntry: AIReasoningEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    fs.appendFileSync(this.getLogFilePath(), JSON.stringify(fullEntry) + '\n');
  }

  /**
   * Log content generation decision.
   */
  logContentGeneration(
    input: Record<string, unknown>,
    reasoning: string,
    generatedContent: string,
    confidence: number
  ): void {
    this.logDecision({
      decisionType: 'content_generation',
      input,
      factors: ['persona_alignment', 'topic_relevance', 'engagement_potential'],
      reasoning,
      decision: generatedContent,
      confidence,
    });
  }

  /**
   * Log reply generation decision.
   */
  logReplyGeneration(
    originalTweet: string,
    context: Record<string, unknown>,
    reasoning: string,
    reply: string,
    confidence: number
  ): void {
    this.logDecision({
      decisionType: 'reply_generation',
      input: { originalTweet, ...context },
      factors: ['context_understanding', 'tone_matching', 'value_addition'],
      reasoning,
      decision: reply,
      confidence,
    });
  }

  /**
   * Log engagement decision (like, follow, quote, etc.).
   */
  logEngagementDecision(
    actionType: string,
    target: Record<string, unknown>,
    reasoning: string,
    decision: 'engage' | 'skip',
    confidence: number
  ): void {
    this.logDecision({
      decisionType: `engagement_${actionType}`,
      input: target,
      factors: ['relevance', 'account_quality', 'strategic_value'],
      reasoning,
      decision,
      confidence,
    });
  }

  /**
   * Log moderation decision.
   */
  logModerationDecision(
    content: string,
    checks: string[],
    reasoning: string,
    decision: 'pass' | 'block',
    issues?: string[]
  ): void {
    this.logDecision({
      decisionType: 'moderation',
      input: { content, checksPerformed: checks },
      factors: checks,
      reasoning,
      decision,
      outcome: issues?.join(', '),
    });
  }

  /**
   * Read reasoning history for a specific date.
   */
  async getReasoningHistory(date?: string): Promise<AIReasoningEntry[]> {
    const targetDate = date ?? this.getDateString();
    const filePath = path.join(this.logsDir, `ai-reasoning-${targetDate}.log`);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as AIReasoningEntry);
  }

  /**
   * Close the logger (no-op for sync writes, kept for API compatibility).
   */
  close(): void {
    // No-op - using synchronous writes
  }
}

// Singleton instances for global access
let defaultLogger: Logger | null = null;
let defaultAIReasoningLogger: AIReasoningLogger | null = null;

/**
 * Get the default logger instance.
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger(options);
  }
  return defaultLogger;
}

/**
 * Get the default AI reasoning logger instance.
 */
export function getAIReasoningLogger(logsDir?: string): AIReasoningLogger {
  if (!defaultAIReasoningLogger) {
    defaultAIReasoningLogger = new AIReasoningLogger(logsDir);
  }
  return defaultAIReasoningLogger;
}

/**
 * Reset loggers (useful for testing).
 */
export function resetLoggers(): void {
  if (defaultLogger) {
    defaultLogger.close();
    defaultLogger = null;
  }
  if (defaultAIReasoningLogger) {
    defaultAIReasoningLogger.close();
    defaultAIReasoningLogger = null;
  }
}
