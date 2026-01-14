#!/usr/bin/env node
/**
 * social-agent CLI entry point
 *
 * This file sets up the Commander.js program and loads all commands.
 */

import { Command } from 'commander';
import { VERSION } from './index.js';

const program = new Command();

program
  .name('social-agent')
  .description('AI-powered social media manager for X (Twitter)')
  .version(VERSION);

// Global options
program
  .option('-v, --verbose', 'Enable verbose output')
  .option('--sandbox', 'Use sandbox mode with test credentials')
  .option('--config <path>', 'Path to config directory');

// Commands will be added as features are implemented
// program.addCommand(dashboardCommand);
// program.addCommand(postCommand);
// program.addCommand(queueCommand);
// program.addCommand(engageCommand);
// program.addCommand(trendsCommand);
// program.addCommand(analyticsCommand);
// program.addCommand(configCommand);

// Default action - show help
program.action(() => {
  program.help();
});

// Graceful shutdown handlers
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

program.parse();
