/**
 * CLI entry point and command structure.
 *
 * Sets up Commander.js with global options, colored output utilities,
 * and graceful shutdown handlers.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../index.js';

/**
 * Global CLI options available to all commands.
 */
export interface GlobalOptions {
  verbose: boolean;
  sandbox: boolean;
  config?: string;
}

/**
 * Colored output utilities for consistent CLI styling.
 */
export interface ColoredOutput {
  success: (message: string) => string;
  error: (message: string) => string;
  warn: (message: string) => string;
  info: (message: string) => string;
  dim: (message: string) => string;
}

// Singleton program instance
let programInstance: Command | null = null;

/**
 * Create and configure the main CLI program.
 * Returns a singleton instance.
 */
export function createProgram(): Command {
  if (programInstance) {
    return programInstance;
  }

  const program = new Command();

  program
    .name('social-agent')
    .description('AI-powered social media manager for X (Twitter)')
    .version(VERSION);

  // Global options available to all commands
  program
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('--sandbox', 'Use sandbox mode with test credentials', false)
    .option('--config <path>', 'Path to config directory');

  // Allow extra arguments for subcommands (to be added later)
  program.allowExcessArguments(true);
  program.allowUnknownOption(true);

  programInstance = program;
  return program;
}

/**
 * Extract global options from a parsed program.
 */
export function getGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts();
  return {
    verbose: opts.verbose ?? false,
    sandbox: opts.sandbox ?? false,
    config: opts.config,
  };
}

/**
 * Create colored output utilities using chalk.
 */
export function createColoredOutput(): ColoredOutput {
  return {
    success: (message: string) => chalk.green(message),
    error: (message: string) => chalk.red(message),
    warn: (message: string) => chalk.yellow(message),
    info: (message: string) => chalk.blue(message),
    dim: (message: string) => chalk.dim(message),
  };
}

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM.
 * Optionally accepts a cleanup function to run before exit.
 */
export function setupGracefulShutdown(cleanup?: () => void): void {
  const handleSignal = () => {
    if (cleanup) {
      cleanup();
    }
    process.exit(0);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

/**
 * Reset CLI singleton (for testing).
 */
export function resetCLI(): void {
  programInstance = null;
}
