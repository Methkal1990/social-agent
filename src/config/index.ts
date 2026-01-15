/**
 * Configuration loading and validation system.
 *
 * Provides YAML file loading, Zod validation, default values,
 * and hot-reload detection for all configuration files.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { z } from 'zod';
import { ConfigError } from '@/utils/errors.js';

// ============================================================================
// Zod Schemas
// ============================================================================

// Log level schema
const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

// API tier schema
const ApiTierSchema = z.object({
  name: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
  description: z.string().optional(),
  limits: z.object({
    posts_per_month: z.number().positive().default(1500),
    reads_per_month: z.number().positive().default(10000),
    requests_per_15min: z.number().positive().default(50),
  }),
});

// Autonomy level schema
const AutonomyLevelSchema = z.enum(['auto', 'confidence_based', 'approval_required']);

// Autonomy task settings schema
const AutonomyTaskSettingsSchema = z.object({
  level: AutonomyLevelSchema.default('approval_required'),
  confidence_threshold: z.number().min(0).max(100).optional(),
});

// Confidence weights schema
const ConfidenceWeightsSchema = z.object({
  voice_alignment: z.number().min(0).max(1).default(0.3),
  topic_relevance: z.number().min(0).max(1).default(0.2),
  predicted_engagement: z.number().min(0).max(1).default(0.2),
  safety_score: z.number().min(0).max(1).default(0.2),
  similarity_to_past: z.number().min(0).max(1).default(0.1),
});

// Autonomy config schema
const AutonomyConfigSchema = z.object({
  tasks: z
    .object({
      new_posts: AutonomyTaskSettingsSchema.default({ level: 'approval_required', confidence_threshold: 80 }),
      thread_posts: AutonomyTaskSettingsSchema.default({ level: 'approval_required', confidence_threshold: 85 }),
      replies: AutonomyTaskSettingsSchema.default({ level: 'auto' }),
      quote_tweets: AutonomyTaskSettingsSchema.default({ level: 'confidence_based', confidence_threshold: 75 }),
      engagement: AutonomyTaskSettingsSchema.default({ level: 'auto' }),
      network_building: AutonomyTaskSettingsSchema.default({ level: 'confidence_based', confidence_threshold: 70 }),
    })
    .default({
      new_posts: { level: 'approval_required', confidence_threshold: 80 },
      thread_posts: { level: 'approval_required', confidence_threshold: 85 },
      replies: { level: 'auto' },
      quote_tweets: { level: 'confidence_based', confidence_threshold: 75 },
      engagement: { level: 'auto' },
      network_building: { level: 'confidence_based', confidence_threshold: 70 },
    }),
  confidence: z
    .object({
      weights: ConfidenceWeightsSchema.default({
        voice_alignment: 0.3,
        topic_relevance: 0.2,
        predicted_engagement: 0.2,
        safety_score: 0.2,
        similarity_to_past: 0.1,
      }),
    })
    .default({
      weights: {
        voice_alignment: 0.3,
        topic_relevance: 0.2,
        predicted_engagement: 0.2,
        safety_score: 0.2,
        similarity_to_past: 0.1,
      },
    }),
});

// Main config schema
const MainConfigSchema = z.object({
  version: z.number().default(1),
  account: z
    .object({
      username: z.string().default(''),
    })
    .default({ username: '' }),
  api_tier: ApiTierSchema.default({
    name: 'basic',
    limits: {
      posts_per_month: 1500,
      reads_per_month: 10000,
      requests_per_15min: 50,
    },
  }),
  settings: z
    .object({
      timezone: z.string().default('local'),
      log_level: LogLevelSchema.default('info'),
    })
    .default({ timezone: 'local', log_level: 'info' }),
  features: z
    .object({
      engagement_automation: z.boolean().default(true),
      trend_monitoring: z.boolean().default(true),
      network_building: z.boolean().default(true),
      image_generation: z.boolean().default(false),
      ab_testing: z.boolean().default(false),
    })
    .default({
      engagement_automation: true,
      trend_monitoring: true,
      network_building: true,
      image_generation: false,
      ab_testing: false,
    }),
  autonomy: AutonomyConfigSchema.default({
    tasks: {
      new_posts: { level: 'approval_required', confidence_threshold: 80 },
      thread_posts: { level: 'approval_required', confidence_threshold: 85 },
      replies: { level: 'auto' },
      quote_tweets: { level: 'confidence_based', confidence_threshold: 75 },
      engagement: { level: 'auto' },
      network_building: { level: 'confidence_based', confidence_threshold: 70 },
    },
    confidence: {
      weights: {
        voice_alignment: 0.3,
        topic_relevance: 0.2,
        predicted_engagement: 0.2,
        safety_score: 0.2,
        similarity_to_past: 0.1,
      },
    },
  }),
});

// Persona config schema
const PersonaConfigSchema = z.object({
  version: z.number().default(1),
  identity: z
    .object({
      name: z.string().default(''),
      role: z.string().default(''),
    })
    .default({ name: '', role: '' }),
  niche: z
    .object({
      primary: z.string().default(''),
      secondary: z.array(z.string()).default([]),
      description: z.string().optional(),
    })
    .default({ primary: '', secondary: [] }),
  voice: z
    .object({
      tone: z.string().default(''),
      style: z.string().default(''),
      personality: z.array(z.string()).default([]),
    })
    .default({ tone: '', style: '', personality: [] }),
  rules: z
    .object({
      do: z.array(z.string()).default([]),
      dont: z.array(z.string()).default([]),
    })
    .default({ do: [], dont: [] }),
  examples: z.array(z.string()).default([]),
  ab_testing: z
    .object({
      enabled: z.boolean().default(false),
      test_elements: z.array(z.string()).default([]),
    })
    .default({ enabled: false, test_elements: [] }),
});

// Schedule config schema
const FrequencyTypeSchema = z.enum(['fixed', 'variable']);
const InactivityActionSchema = z.enum(['keep_posting', 'pause', 'reduce', 'alert_wait']);

const ScheduleConfigSchema = z.object({
  version: z.number().default(1),
  frequency: z
    .object({
      type: FrequencyTypeSchema.default('variable'),
      min_posts_per_day: z.number().min(0).default(2),
      max_posts_per_day: z.number().min(0).default(6),
      daily_override: z
        .record(z.string(), z.object({ min: z.number(), max: z.number() }))
        .optional(),
    })
    .default({ type: 'variable', min_posts_per_day: 2, max_posts_per_day: 6 }),
  active_hours: z
    .object({
      start: z.string().default('08:00'),
      end: z.string().default('21:00'),
    })
    .default({ start: '08:00', end: '21:00' }),
  blackouts: z.array(z.object({ start: z.string(), end: z.string() })).default([]),
  inactivity: z
    .object({
      action: InactivityActionSchema.default('reduce'),
      threshold_days: z.number().min(1).default(3),
      reduction_percent: z.number().min(0).max(100).optional(),
    })
    .default({ action: 'reduce', threshold_days: 3 }),
  queue: z
    .object({
      max_size: z.number().min(1).default(50),
      min_buffer: z.number().min(0).default(5),
    })
    .default({ max_size: 50, min_buffer: 5 }),
});

// Moderation config schema
const ModerationConfigSchema = z.object({
  version: z.number().default(1),
  blocklist: z
    .object({
      words: z.array(z.string()).default([]),
      phrases: z.array(z.string()).default([]),
    })
    .default({ words: [], phrases: [] }),
  topics: z
    .object({
      engage: z.array(z.string()).default([]),
      avoid: z.array(z.string()).default([]),
      alert_only: z.array(z.string()).default([]),
    })
    .default({ engage: [], avoid: [], alert_only: [] }),
  ai_safety: z
    .object({
      enabled: z.boolean().default(true),
      check_for: z.array(z.string()).default([]),
    })
    .default({ enabled: true, check_for: [] }),
  brand_safety: z
    .object({
      enabled: z.boolean().default(true),
      check_for: z.array(z.string()).default([]),
    })
    .default({ enabled: true, check_for: [] }),
});

// Model settings schema
const ModelSettingsSchema = z.object({
  model: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(1).default(1000),
});

// Models config schema
const ModelsConfigSchema = z.object({
  version: z.number().default(1),
  openrouter: z
    .object({
      base_url: z.string().url().default('https://openrouter.ai/api/v1'),
    })
    .default({ base_url: 'https://openrouter.ai/api/v1' }),
  models: z
    .object({
      content_generation: ModelSettingsSchema.default({
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        max_tokens: 1000,
      }),
      engagement_replies: ModelSettingsSchema.default({
        model: 'anthropic/claude-3-haiku',
        temperature: 0.6,
        max_tokens: 500,
      }),
      analysis: ModelSettingsSchema.default({
        model: 'anthropic/claude-3-haiku',
        temperature: 0.3,
        max_tokens: 2000,
      }),
      moderation: ModelSettingsSchema.default({
        model: 'anthropic/claude-3-haiku',
        temperature: 0.1,
        max_tokens: 500,
      }),
      image_generation: z
        .object({
          model: z.string().default('openai/dall-e-3'),
          size: z.string().default('1024x1024'),
          quality: z.string().default('standard'),
        })
        .optional(),
    })
    .default({
      content_generation: {
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        max_tokens: 1000,
      },
      engagement_replies: {
        model: 'anthropic/claude-3-haiku',
        temperature: 0.6,
        max_tokens: 500,
      },
      analysis: {
        model: 'anthropic/claude-3-haiku',
        temperature: 0.3,
        max_tokens: 2000,
      },
      moderation: {
        model: 'anthropic/claude-3-haiku',
        temperature: 0.1,
        max_tokens: 500,
      },
    }),
  image_generation: z
    .object({
      enabled: z.boolean().default(false),
      style_prompt: z.string().optional(),
      prompt_template: z.string().optional(),
    })
    .default({ enabled: false }),
});

// ============================================================================
// Types (inferred from schemas)
// ============================================================================

export type MainConfig = z.infer<typeof MainConfigSchema>;
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

export interface FullConfig {
  main: MainConfig;
  persona: PersonaConfig;
  schedule: ScheduleConfig;
  moderation: ModerationConfig;
  models: ModelsConfig;
}

// ============================================================================
// Config File Names
// ============================================================================

type ConfigFileName = 'main' | 'persona' | 'schedule' | 'moderation' | 'models';

const CONFIG_FILE_NAMES: Record<ConfigFileName, string> = {
  main: 'main.yaml',
  persona: 'persona.yaml',
  schedule: 'schedule.yaml',
  moderation: 'moderation.yaml',
  models: 'models.yaml',
};

// ============================================================================
// ConfigLoader Class
// ============================================================================

export class ConfigLoader {
  private configDir: string;
  private lastModified: Map<ConfigFileName, number> = new Map();

  constructor(configDir?: string) {
    this.configDir = configDir ?? path.join(os.homedir(), '.social-agent', 'config');
  }

  /**
   * Get the configuration directory path.
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Get the path to a specific config file.
   */
  private getConfigFilePath(name: ConfigFileName): string {
    return path.join(this.configDir, CONFIG_FILE_NAMES[name]);
  }

  /**
   * Read and parse a YAML file.
   */
  private readYamlFile(filePath: string): unknown {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.parse(content) ?? {};
  }

  /**
   * Update the last modified timestamp for a config file.
   */
  private updateLastModified(name: ConfigFileName): void {
    const filePath = this.getConfigFilePath(name);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      this.lastModified.set(name, stats.mtimeMs);
    }
  }

  /**
   * Check if a config file has changed since last load.
   */
  hasConfigChanged(name: ConfigFileName): boolean {
    const filePath = this.getConfigFilePath(name);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const stats = fs.statSync(filePath);
    const lastMod = this.lastModified.get(name);
    return lastMod !== undefined && stats.mtimeMs > lastMod;
  }

  /**
   * Load and validate the main configuration.
   */
  loadMainConfig(): MainConfig {
    const filePath = this.getConfigFilePath('main');
    try {
      const data = this.readYamlFile(filePath);
      const result = MainConfigSchema.parse(data);
      this.updateLastModified('main');
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new ConfigError(
          `Invalid main.yaml: ${issues}`,
          filePath,
          error.issues[0]?.path.join('.')
        );
      }
      throw error;
    }
  }

  /**
   * Load and validate the persona configuration.
   */
  loadPersonaConfig(): PersonaConfig {
    const filePath = this.getConfigFilePath('persona');
    try {
      const data = this.readYamlFile(filePath);
      const result = PersonaConfigSchema.parse(data);
      this.updateLastModified('persona');
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new ConfigError(
          `Invalid persona.yaml: ${issues}`,
          filePath,
          error.issues[0]?.path.join('.')
        );
      }
      throw error;
    }
  }

  /**
   * Load and validate the schedule configuration.
   */
  loadScheduleConfig(): ScheduleConfig {
    const filePath = this.getConfigFilePath('schedule');
    try {
      const data = this.readYamlFile(filePath);
      const result = ScheduleConfigSchema.parse(data);
      this.updateLastModified('schedule');
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new ConfigError(
          `Invalid schedule.yaml: ${issues}`,
          filePath,
          error.issues[0]?.path.join('.')
        );
      }
      throw error;
    }
  }

  /**
   * Load and validate the moderation configuration.
   */
  loadModerationConfig(): ModerationConfig {
    const filePath = this.getConfigFilePath('moderation');
    try {
      const data = this.readYamlFile(filePath);
      const result = ModerationConfigSchema.parse(data);
      this.updateLastModified('moderation');
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new ConfigError(
          `Invalid moderation.yaml: ${issues}`,
          filePath,
          error.issues[0]?.path.join('.')
        );
      }
      throw error;
    }
  }

  /**
   * Load and validate the models configuration.
   */
  loadModelsConfig(): ModelsConfig {
    const filePath = this.getConfigFilePath('models');
    try {
      const data = this.readYamlFile(filePath);
      const result = ModelsConfigSchema.parse(data);
      this.updateLastModified('models');
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new ConfigError(
          `Invalid models.yaml: ${issues}`,
          filePath,
          error.issues[0]?.path.join('.')
        );
      }
      throw error;
    }
  }

  /**
   * Load all configuration files.
   */
  loadAll(): FullConfig {
    return {
      main: this.loadMainConfig(),
      persona: this.loadPersonaConfig(),
      schedule: this.loadScheduleConfig(),
      moderation: this.loadModerationConfig(),
      models: this.loadModelsConfig(),
    };
  }
}

// ============================================================================
// Singleton and Utilities
// ============================================================================

let defaultConfigLoader: ConfigLoader | null = null;

/**
 * Get the default config loader instance.
 */
export function getConfig(configDir?: string): ConfigLoader {
  if (!defaultConfigLoader) {
    defaultConfigLoader = new ConfigLoader(configDir);
  }
  return defaultConfigLoader;
}

/**
 * Reset the config loader singleton.
 */
export function resetConfig(): void {
  defaultConfigLoader = null;
}

/**
 * Get the default configuration directory path.
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.social-agent', 'config');
}

/**
 * Ensure the configuration directory exists.
 */
export function ensureConfigDir(configDir?: string): void {
  const dir = configDir ?? getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
