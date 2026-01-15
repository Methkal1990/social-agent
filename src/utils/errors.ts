/**
 * Error handling utilities and custom error types.
 *
 * Provides structured error classes for different error categories,
 * retry utilities with exponential backoff, and error context collection.
 */

import { VERSION } from '../index.js';

/**
 * Base application error with user-friendly message support.
 */
export class AppError extends Error {
  public readonly userMessage: string;

  constructor(message: string, userMessage?: string) {
    super(message);
    this.name = 'AppError';
    this.userMessage = userMessage ?? message;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * X API specific error with status code and endpoint info.
 */
export class XAPIError extends AppError {
  public readonly statusCode: number;
  public readonly endpoint: string;
  public readonly responseData?: unknown;

  constructor(message: string, statusCode: number, endpoint: string, responseData?: unknown) {
    const userMessage = XAPIError.generateUserMessage(statusCode, endpoint);
    super(message, userMessage);
    this.name = 'XAPIError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.responseData = responseData;
  }

  private static generateUserMessage(statusCode: number, endpoint: string): string {
    switch (statusCode) {
      case 401:
        return 'X API authentication failed. Please check your API credentials.';
      case 403:
        return 'Access denied to X API. Your account may not have permission for this action.';
      case 404:
        return 'The requested resource was not found on X.';
      case 429:
        return 'X API rate limit exceeded. The operation will be retried automatically.';
      default:
        if (statusCode >= 500) {
          return 'X API is temporarily unavailable. The operation will be retried.';
        }
        return `X API error on ${endpoint}: Status ${statusCode}`;
    }
  }
}

/**
 * OpenRouter AI API specific error.
 */
export class OpenRouterError extends AppError {
  public readonly model: string;
  public readonly statusCode?: number;

  constructor(message: string, model: string, statusCode?: number) {
    const userMessage = OpenRouterError.generateUserMessage(statusCode);
    super(message, userMessage);
    this.name = 'OpenRouterError';
    this.model = model;
    this.statusCode = statusCode;
  }

  private static generateUserMessage(statusCode?: number): string {
    if (!statusCode) {
      return 'AI service connection error. Please check your internet connection.';
    }
    switch (statusCode) {
      case 401:
        return 'OpenRouter authentication failed. Please check your API key.';
      case 404:
        return 'AI model not available. Please check your model configuration.';
      case 429:
        return 'AI service rate limit exceeded. The operation will be retried.';
      case 529:
        return 'AI service is overloaded. The operation will be retried.';
      default:
        if (statusCode >= 500) {
          return 'AI service is temporarily unavailable. The operation will be retried.';
        }
        return `AI service error: Status ${statusCode}`;
    }
  }
}

/**
 * Configuration file error.
 */
export class ConfigError extends AppError {
  public readonly configFile: string;
  public readonly fieldName?: string;

  constructor(message: string, configFile: string, fieldName?: string) {
    const userMessage = ConfigError.generateUserMessage(configFile, fieldName);
    super(message, userMessage);
    this.name = 'ConfigError';
    this.configFile = configFile;
    this.fieldName = fieldName;
  }

  private static generateUserMessage(configFile: string, fieldName?: string): string {
    if (fieldName) {
      return `Invalid configuration in ${configFile}: Check the '${fieldName}' field.`;
    }
    return `Configuration error in ${configFile}. Please verify the file format and values.`;
  }
}

/**
 * Network connectivity error.
 */
export class NetworkError extends AppError {
  public readonly operation: string;
  public readonly code?: string;

  constructor(message: string, operation: string, code?: string) {
    const userMessage = NetworkError.generateUserMessage(code);
    super(message, userMessage);
    this.name = 'NetworkError';
    this.operation = operation;
    this.code = code;
  }

  private static generateUserMessage(code?: string): string {
    switch (code) {
      case 'ETIMEDOUT':
        return 'The operation timed out. Please check your internet connection.';
      case 'ECONNRESET':
        return 'The connection was reset. The operation will be retried.';
      case 'ENOTFOUND':
        return 'Unable to connect to the server. Please check your internet connection.';
      case 'ECONNREFUSED':
        return 'Connection refused. The service may be temporarily unavailable.';
      default:
        return 'A network error occurred. Please check your internet connection.';
    }
  }
}

/**
 * Determine if an error is retryable.
 */
export function isRetryable(error: Error): boolean {
  // Network errors with specific codes
  if (error instanceof NetworkError) {
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND'];
    return error.code ? retryableCodes.includes(error.code) : false;
  }

  // X API errors
  if (error instanceof XAPIError) {
    // Rate limit and server errors are retryable
    return error.statusCode === 429 || error.statusCode >= 500;
  }

  // OpenRouter errors
  if (error instanceof OpenRouterError) {
    if (!error.statusCode) return false;
    // Rate limit, overload, and server errors are retryable
    return error.statusCode === 429 || error.statusCode === 529 || error.statusCode >= 500;
  }

  // Config errors are never retryable
  if (error instanceof ConfigError) {
    return false;
  }

  // Generic app errors are not retryable by default
  if (error instanceof AppError) {
    return false;
  }

  // Generic errors - check for network error codes
  const anyError = error as NodeJS.ErrnoException;
  if (anyError.code) {
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE'];
    return retryableCodes.includes(anyError.code);
  }

  return false;
}

/**
 * Retry configuration.
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 2000,
  maxDelay: 8000,
  factor: 2,
};

/**
 * Sleep utility for delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if we've exhausted attempts or error isn't retryable
      if (attempt === config.maxAttempts || !isRetryable(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff, capped at maxDelay
      const delay = Math.min(
        config.initialDelay * Math.pow(config.factor, attempt - 1),
        config.maxDelay
      );

      // Call retry callback if provided
      if (config.onRetry) {
        config.onRetry(lastError, attempt, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Error context for debugging and logging.
 */
export interface ErrorContext {
  timestamp: string;
  operation: string;
  component: string;
  input?: Record<string, unknown>;
  state?: Record<string, unknown>;
  environment: {
    nodeVersion: string;
    platform: string;
    agentVersion: string;
  };
  errorDetails?: Record<string, unknown>;
}

/**
 * Collect error context for debugging and logging.
 */
export function collectErrorContext(
  error: Error,
  operation: string,
  input?: Record<string, unknown>,
  state?: Record<string, unknown>
): ErrorContext {
  const context: ErrorContext = {
    timestamp: new Date().toISOString(),
    operation,
    component: error.constructor.name,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      agentVersion: VERSION,
    },
  };

  if (input) {
    context.input = input;
  }

  if (state) {
    context.state = state;
  }

  // Collect error-specific details
  if (error instanceof XAPIError) {
    context.errorDetails = {
      statusCode: error.statusCode,
      endpoint: error.endpoint,
      responseData: error.responseData,
    };
  } else if (error instanceof OpenRouterError) {
    context.errorDetails = {
      model: error.model,
      statusCode: error.statusCode,
    };
  } else if (error instanceof ConfigError) {
    context.errorDetails = {
      configFile: error.configFile,
      fieldName: error.fieldName,
    };
  } else if (error instanceof NetworkError) {
    context.errorDetails = {
      operation: error.operation,
      code: error.code,
    };
  }

  return context;
}
