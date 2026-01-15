import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import {
  createProgram,
  createColoredOutput,
  setupGracefulShutdown,
  getGlobalOptions,
  resetCLI,
  type GlobalOptions,
} from '@/cli/index.js';

describe('CLI Entry Point', () => {
  beforeEach(() => {
    resetCLI();
  });

  afterEach(() => {
    resetCLI();
  });

  describe('createProgram', () => {
    it('should create a Commander program instance', () => {
      const program = createProgram();
      expect(program).toBeInstanceOf(Command);
    });

    it('should set program name to social-agent', () => {
      const program = createProgram();
      expect(program.name()).toBe('social-agent');
    });

    it('should set program description', () => {
      const program = createProgram();
      expect(program.description()).toContain('social media');
    });

    it('should set version from package', () => {
      const program = createProgram();
      expect(program.version()).toBe('1.0.0');
    });

    it('should have --verbose global option', () => {
      const program = createProgram();
      const verboseOption = program.options.find(
        (opt) => opt.long === '--verbose' || opt.short === '-v'
      );
      expect(verboseOption).toBeDefined();
    });

    it('should have --sandbox global option', () => {
      const program = createProgram();
      const sandboxOption = program.options.find((opt) => opt.long === '--sandbox');
      expect(sandboxOption).toBeDefined();
    });

    it('should have --config global option', () => {
      const program = createProgram();
      const configOption = program.options.find((opt) => opt.long === '--config');
      expect(configOption).toBeDefined();
    });

    it('should return same instance on subsequent calls (singleton)', () => {
      const program1 = createProgram();
      const program2 = createProgram();
      expect(program1).toBe(program2);
    });
  });

  describe('getGlobalOptions', () => {
    it('should return default options when none set', () => {
      const program = createProgram();
      // Parse with no args to simulate no options
      program.parse(['node', 'social-agent'], { from: 'user' });
      const options = getGlobalOptions(program);

      expect(options.verbose).toBe(false);
      expect(options.sandbox).toBe(false);
      expect(options.config).toBeUndefined();
    });

    it('should parse verbose option', () => {
      const program = createProgram();
      program.parse(['node', 'social-agent', '--verbose'], { from: 'user' });
      const options = getGlobalOptions(program);

      expect(options.verbose).toBe(true);
    });

    it('should parse sandbox option', () => {
      const program = createProgram();
      program.parse(['node', 'social-agent', '--sandbox'], { from: 'user' });
      const options = getGlobalOptions(program);

      expect(options.sandbox).toBe(true);
    });

    it('should parse config option with path', () => {
      const program = createProgram();
      program.parse(['node', 'social-agent', '--config', '/custom/path'], { from: 'user' });
      const options = getGlobalOptions(program);

      expect(options.config).toBe('/custom/path');
    });

    it('should parse multiple options together', () => {
      const program = createProgram();
      program.parse(['node', 'social-agent', '-v', '--sandbox', '--config', '/my/config'], {
        from: 'user',
      });
      const options = getGlobalOptions(program);

      expect(options.verbose).toBe(true);
      expect(options.sandbox).toBe(true);
      expect(options.config).toBe('/my/config');
    });
  });

  describe('createColoredOutput', () => {
    it('should create output utilities object', () => {
      const output = createColoredOutput();
      expect(output).toBeDefined();
      expect(typeof output.success).toBe('function');
      expect(typeof output.error).toBe('function');
      expect(typeof output.warn).toBe('function');
      expect(typeof output.info).toBe('function');
      expect(typeof output.dim).toBe('function');
    });

    it('should return styled string for success', () => {
      const output = createColoredOutput();
      const result = output.success('test message');
      expect(typeof result).toBe('string');
      expect(result).toContain('test message');
    });

    it('should return styled string for error', () => {
      const output = createColoredOutput();
      const result = output.error('error message');
      expect(typeof result).toBe('string');
      expect(result).toContain('error message');
    });

    it('should return styled string for warn', () => {
      const output = createColoredOutput();
      const result = output.warn('warning message');
      expect(typeof result).toBe('string');
      expect(result).toContain('warning message');
    });

    it('should return styled string for info', () => {
      const output = createColoredOutput();
      const result = output.info('info message');
      expect(typeof result).toBe('string');
      expect(result).toContain('info message');
    });

    it('should return styled string for dim', () => {
      const output = createColoredOutput();
      const result = output.dim('dim message');
      expect(typeof result).toBe('string');
      expect(result).toContain('dim message');
    });
  });

  describe('setupGracefulShutdown', () => {
    let sigintHandlers: Array<() => void>;
    let sigtermHandlers: Array<() => void>;

    beforeEach(() => {
      sigintHandlers = [];
      sigtermHandlers = [];

      // Mock process.on to capture handlers
      vi.spyOn(process, 'on').mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandlers.push(handler);
        } else if (event === 'SIGTERM') {
          sigtermHandlers.push(handler);
        }
        return process;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should register SIGINT handler', () => {
      setupGracefulShutdown();
      expect(sigintHandlers.length).toBeGreaterThan(0);
    });

    it('should register SIGTERM handler', () => {
      setupGracefulShutdown();
      expect(sigtermHandlers.length).toBeGreaterThan(0);
    });

    it('should call cleanup on SIGINT', () => {
      const cleanup = vi.fn();
      setupGracefulShutdown(cleanup);

      // Trigger SIGINT handler
      if (sigintHandlers.length > 0) {
        vi.spyOn(process, 'exit').mockImplementation(() => {
          throw new Error('process.exit called');
        });
        try {
          sigintHandlers[0]();
        } catch {
          // Expected - process.exit throws
        }
        expect(cleanup).toHaveBeenCalled();
      }
    });

    it('should call cleanup on SIGTERM', () => {
      const cleanup = vi.fn();
      setupGracefulShutdown(cleanup);

      // Trigger SIGTERM handler
      if (sigtermHandlers.length > 0) {
        vi.spyOn(process, 'exit').mockImplementation(() => {
          throw new Error('process.exit called');
        });
        try {
          sigtermHandlers[0]();
        } catch {
          // Expected - process.exit throws
        }
        expect(cleanup).toHaveBeenCalled();
      }
    });
  });

  describe('resetCLI', () => {
    it('should reset program singleton', () => {
      const program1 = createProgram();
      resetCLI();
      const program2 = createProgram();

      expect(program1).not.toBe(program2);
    });
  });
});

describe('GlobalOptions type', () => {
  it('should have correct shape', () => {
    const options: GlobalOptions = {
      verbose: true,
      sandbox: false,
      config: '/some/path',
    };

    expect(options.verbose).toBe(true);
    expect(options.sandbox).toBe(false);
    expect(options.config).toBe('/some/path');
  });

  it('should allow undefined config', () => {
    const options: GlobalOptions = {
      verbose: false,
      sandbox: false,
    };

    expect(options.config).toBeUndefined();
  });
});
