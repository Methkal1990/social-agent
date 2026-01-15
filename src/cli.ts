/**
 * social-agent CLI entry point
 *
 * This file sets up the Commander.js program and loads all commands.
 */

import { createProgram, setupGracefulShutdown, createColoredOutput } from './cli/index.js';

// Create and configure the CLI program
const program = createProgram();

// Setup graceful shutdown handlers
setupGracefulShutdown();

// Create colored output utilities
export const output = createColoredOutput();

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

program.parse();
