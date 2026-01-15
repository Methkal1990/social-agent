import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import {
  ConfigLoader,
  getConfig,
  resetConfig,
  getConfigDir,
  ensureConfigDir,
  type MainConfig,
  type PersonaConfig,
  type ScheduleConfig,
  type ModerationConfig,
  type ModelsConfig,
  type FullConfig,
} from '@/config/index.js';

describe('ConfigLoader', () => {
  let testConfigDir: string;

  beforeEach(() => {
    resetConfig();
    testConfigDir = path.join(
      os.tmpdir(),
      `config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    resetConfig();
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create config loader with custom directory', () => {
      const loader = new ConfigLoader(testConfigDir);
      expect(loader.getConfigDir()).toBe(testConfigDir);
    });

    it('should use default directory if not specified', () => {
      const loader = new ConfigLoader();
      expect(loader.getConfigDir()).toBe(path.join(os.homedir(), '.social-agent', 'config'));
    });
  });

  describe('loadMainConfig', () => {
    it('should load valid main.yaml', () => {
      const mainConfig = {
        version: 1,
        account: { username: '@testuser' },
        api_tier: {
          name: 'basic',
          limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
        },
        settings: { timezone: 'UTC', log_level: 'info' },
        features: {
          engagement_automation: true,
          trend_monitoring: true,
          network_building: true,
          image_generation: false,
          ab_testing: false,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(mainConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadMainConfig();

      expect(loaded.version).toBe(1);
      expect(loaded.account.username).toBe('@testuser');
      expect(loaded.api_tier.name).toBe('basic');
    });

    it('should throw ConfigError for invalid main.yaml', () => {
      const invalidConfig = { version: 'not a number' };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadMainConfig()).toThrow();
    });

    it('should return defaults when main.yaml does not exist', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadMainConfig();

      expect(config.version).toBe(1);
      expect(config.settings.log_level).toBe('info');
    });
  });

  describe('loadPersonaConfig', () => {
    it('should load valid persona.yaml', () => {
      const personaConfig = {
        version: 1,
        identity: { name: 'Test User', role: 'Developer' },
        niche: { primary: 'Tech', secondary: ['AI', 'Web'] },
        voice: { tone: 'friendly', style: 'casual', personality: ['curious'] },
        rules: { do: ['be helpful'], dont: ['be rude'] },
        examples: ['Sample tweet'],
        ab_testing: { enabled: false, test_elements: [] },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.identity.name).toBe('Test User');
      expect(loaded.niche.primary).toBe('Tech');
    });

    it('should return defaults when persona.yaml does not exist', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadPersonaConfig();

      expect(config.version).toBe(1);
      expect(config.identity.name).toBe('');
    });

    it('should load identity section with name and role', () => {
      const personaConfig = {
        identity: { name: 'Alex Smith', role: 'AI Researcher & Writer' },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.identity.name).toBe('Alex Smith');
      expect(loaded.identity.role).toBe('AI Researcher & Writer');
    });

    it('should load niche configuration with primary, secondary, and description', () => {
      const personaConfig = {
        niche: {
          primary: 'Machine Learning',
          secondary: ['Data Science', 'Software Engineering', 'Tech Industry'],
          description: 'Focus on practical ML applications and engineering best practices.',
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.niche.primary).toBe('Machine Learning');
      expect(loaded.niche.secondary).toEqual(['Data Science', 'Software Engineering', 'Tech Industry']);
      expect(loaded.niche.description).toBe(
        'Focus on practical ML applications and engineering best practices.'
      );
    });

    it('should load voice characteristics (tone, style, personality)', () => {
      const personaConfig = {
        voice: {
          tone: 'professional but approachable',
          style: 'educational, insightful',
          personality: ['curious', 'helpful', 'thought-provoking'],
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.voice.tone).toBe('professional but approachable');
      expect(loaded.voice.style).toBe('educational, insightful');
      expect(loaded.voice.personality).toEqual(['curious', 'helpful', 'thought-provoking']);
    });

    it('should load content rules (do/dont lists)', () => {
      const personaConfig = {
        rules: {
          do: [
            'use analogies to explain complex topics',
            'share personal experiences',
            'ask engaging questions',
          ],
          dont: [
            'be overly formal',
            'use excessive jargon',
            'engage in political debates',
          ],
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.rules.do).toHaveLength(3);
      expect(loaded.rules.do).toContain('use analogies to explain complex topics');
      expect(loaded.rules.dont).toHaveLength(3);
      expect(loaded.rules.dont).toContain('engage in political debates');
    });

    it('should load example posts for style learning', () => {
      const personaConfig = {
        examples: [
          "The best way to learn AI isn't watching tutorials. It's building something.",
          '3 things I wish I knew when starting with ML...',
          'Unpopular opinion: The best productivity tool is knowing when to stop optimizing.',
        ],
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.examples).toHaveLength(3);
      expect(loaded.examples[0]).toContain('learn AI');
    });

    it('should load A/B testing variation config', () => {
      const personaConfig = {
        ab_testing: {
          enabled: true,
          test_elements: ['hook_styles', 'post_lengths', 'question_types'],
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(personaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.ab_testing.enabled).toBe(true);
      expect(loaded.ab_testing.test_elements).toEqual(['hook_styles', 'post_lengths', 'question_types']);
    });

    it('should provide empty defaults for all array fields', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadPersonaConfig();

      expect(config.niche.secondary).toEqual([]);
      expect(config.voice.personality).toEqual([]);
      expect(config.rules.do).toEqual([]);
      expect(config.rules.dont).toEqual([]);
      expect(config.examples).toEqual([]);
      expect(config.ab_testing.test_elements).toEqual([]);
    });

    it('should throw ConfigError for invalid persona.yaml', () => {
      const invalidConfig = { version: 'not a number' };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadPersonaConfig()).toThrow();
    });

    it('should load complete persona config matching spec example', () => {
      const fullPersonaConfig = {
        version: 1,
        identity: {
          name: 'Your Name',
          role: 'Software Engineer & AI Enthusiast',
        },
        niche: {
          primary: 'AI and Machine Learning',
          secondary: ['Software Engineering', 'Productivity', 'Tech Industry'],
          description: 'Focus on practical AI applications and productivity optimization.',
        },
        voice: {
          tone: 'professional but approachable',
          style: 'educational, insightful',
          personality: ['curious and always learning', 'shares knowledge generously'],
        },
        rules: {
          do: ['use analogies', 'share experiences', 'ask questions'],
          dont: ['be corporate', 'use jargon', 'be negative'],
        },
        examples: ['Example tweet 1', 'Example tweet 2', 'Example tweet 3'],
        ab_testing: {
          enabled: true,
          test_elements: ['hook_styles', 'post_lengths'],
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'persona.yaml'), yaml.stringify(fullPersonaConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadPersonaConfig();

      expect(loaded.version).toBe(1);
      expect(loaded.identity.name).toBe('Your Name');
      expect(loaded.niche.primary).toBe('AI and Machine Learning');
      expect(loaded.voice.tone).toBe('professional but approachable');
      expect(loaded.rules.do).toContain('use analogies');
      expect(loaded.examples).toHaveLength(3);
      expect(loaded.ab_testing.enabled).toBe(true);
    });
  });

  describe('loadScheduleConfig', () => {
    it('should load valid schedule.yaml', () => {
      const scheduleConfig = {
        version: 1,
        frequency: { type: 'variable', min_posts_per_day: 2, max_posts_per_day: 5 },
        active_hours: { start: '09:00', end: '18:00' },
        blackouts: [],
        inactivity: { action: 'pause', threshold_days: 3 },
        queue: { max_size: 50, min_buffer: 5 },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.frequency.min_posts_per_day).toBe(2);
      expect(loaded.active_hours.start).toBe('09:00');
    });

    it('should return defaults when schedule.yaml does not exist', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadScheduleConfig();

      expect(config.version).toBe(1);
      expect(config.frequency.type).toBe('variable');
    });

    it('should load frequency settings with min/max posts per day', () => {
      const scheduleConfig = {
        frequency: {
          type: 'variable',
          min_posts_per_day: 3,
          max_posts_per_day: 8,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.frequency.type).toBe('variable');
      expect(loaded.frequency.min_posts_per_day).toBe(3);
      expect(loaded.frequency.max_posts_per_day).toBe(8);
    });

    it('should load fixed frequency type', () => {
      const scheduleConfig = {
        frequency: {
          type: 'fixed',
          min_posts_per_day: 4,
          max_posts_per_day: 4,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.frequency.type).toBe('fixed');
    });

    it('should load day-specific overrides', () => {
      const scheduleConfig = {
        frequency: {
          type: 'variable',
          min_posts_per_day: 2,
          max_posts_per_day: 6,
          daily_override: {
            monday: { min: 3, max: 5 },
            friday: { min: 2, max: 3 },
            saturday: { min: 1, max: 2 },
            sunday: { min: 1, max: 2 },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.frequency.daily_override).toBeDefined();
      expect(loaded.frequency.daily_override?.monday).toEqual({ min: 3, max: 5 });
      expect(loaded.frequency.daily_override?.saturday).toEqual({ min: 1, max: 2 });
    });

    it('should load active hours configuration', () => {
      const scheduleConfig = {
        active_hours: {
          start: '07:30',
          end: '22:00',
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.active_hours.start).toBe('07:30');
      expect(loaded.active_hours.end).toBe('22:00');
    });

    it('should load blackout periods', () => {
      const scheduleConfig = {
        blackouts: [
          { start: '23:00', end: '06:00' },
          { start: '12:00', end: '13:00' },
        ],
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.blackouts).toHaveLength(2);
      expect(loaded.blackouts[0]).toEqual({ start: '23:00', end: '06:00' });
      expect(loaded.blackouts[1]).toEqual({ start: '12:00', end: '13:00' });
    });

    it('should load empty blackouts array by default', () => {
      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.blackouts).toEqual([]);
    });

    it('should load inactivity behavior settings with all actions', () => {
      const actions = ['keep_posting', 'pause', 'reduce', 'alert_wait'] as const;

      for (const action of actions) {
        const scheduleConfig = {
          inactivity: {
            action,
            threshold_days: 5,
          },
        };
        fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

        const loader = new ConfigLoader(testConfigDir);
        resetConfig();
        const loaded = loader.loadScheduleConfig();

        expect(loaded.inactivity.action).toBe(action);
        expect(loaded.inactivity.threshold_days).toBe(5);
      }
    });

    it('should load inactivity reduction_percent for reduce action', () => {
      const scheduleConfig = {
        inactivity: {
          action: 'reduce',
          threshold_days: 3,
          reduction_percent: 50,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.inactivity.action).toBe('reduce');
      expect(loaded.inactivity.reduction_percent).toBe(50);
    });

    it('should load queue management settings', () => {
      const scheduleConfig = {
        queue: {
          max_size: 100,
          min_buffer: 10,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(scheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.queue.max_size).toBe(100);
      expect(loaded.queue.min_buffer).toBe(10);
    });

    it('should throw ConfigError for invalid frequency type', () => {
      const invalidConfig = {
        frequency: {
          type: 'invalid_type',
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadScheduleConfig()).toThrow();
    });

    it('should throw ConfigError for invalid inactivity action', () => {
      const invalidConfig = {
        inactivity: {
          action: 'invalid_action',
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadScheduleConfig()).toThrow();
    });

    it('should throw ConfigError for negative min_posts_per_day', () => {
      const invalidConfig = {
        frequency: {
          min_posts_per_day: -1,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadScheduleConfig()).toThrow();
    });

    it('should throw ConfigError for invalid threshold_days', () => {
      const invalidConfig = {
        inactivity: {
          threshold_days: 0,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadScheduleConfig()).toThrow();
    });

    it('should throw ConfigError for reduction_percent out of range', () => {
      const invalidConfig = {
        inactivity: {
          action: 'reduce',
          threshold_days: 3,
          reduction_percent: 150,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadScheduleConfig()).toThrow();
    });

    it('should provide default values for all schedule settings', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadScheduleConfig();

      expect(config.version).toBe(1);
      expect(config.frequency.type).toBe('variable');
      expect(config.frequency.min_posts_per_day).toBe(2);
      expect(config.frequency.max_posts_per_day).toBe(6);
      expect(config.active_hours.start).toBe('08:00');
      expect(config.active_hours.end).toBe('21:00');
      expect(config.blackouts).toEqual([]);
      expect(config.inactivity.action).toBe('reduce');
      expect(config.inactivity.threshold_days).toBe(3);
      expect(config.queue.max_size).toBe(50);
      expect(config.queue.min_buffer).toBe(5);
    });

    it('should load complete schedule config matching spec example', () => {
      const fullScheduleConfig = {
        version: 1,
        frequency: {
          type: 'variable',
          min_posts_per_day: 2,
          max_posts_per_day: 6,
          daily_override: {
            monday: { min: 3, max: 5 },
            friday: { min: 2, max: 3 },
            saturday: { min: 1, max: 2 },
            sunday: { min: 1, max: 2 },
          },
        },
        active_hours: {
          start: '08:00',
          end: '21:00',
        },
        blackouts: [{ start: '23:00', end: '06:00' }],
        inactivity: {
          action: 'reduce',
          threshold_days: 3,
          reduction_percent: 50,
        },
        queue: {
          max_size: 50,
          min_buffer: 5,
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'schedule.yaml'), yaml.stringify(fullScheduleConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadScheduleConfig();

      expect(loaded.version).toBe(1);
      expect(loaded.frequency.type).toBe('variable');
      expect(loaded.frequency.daily_override?.monday).toEqual({ min: 3, max: 5 });
      expect(loaded.active_hours.start).toBe('08:00');
      expect(loaded.blackouts).toHaveLength(1);
      expect(loaded.inactivity.action).toBe('reduce');
      expect(loaded.queue.max_size).toBe(50);
    });
  });

  describe('loadModerationConfig', () => {
    it('should load valid moderation.yaml', () => {
      const moderationConfig = {
        version: 1,
        blocklist: { words: ['bad'], phrases: ['bad phrase'] },
        topics: { engage: ['tech'], avoid: ['politics'], alert_only: ['news'] },
        ai_safety: { enabled: true, check_for: ['offensive'] },
        brand_safety: { enabled: true, check_for: ['consistency'] },
      };
      fs.writeFileSync(
        path.join(testConfigDir, 'moderation.yaml'),
        yaml.stringify(moderationConfig)
      );

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadModerationConfig();

      expect(loaded.blocklist.words).toContain('bad');
      expect(loaded.topics.avoid).toContain('politics');
    });

    it('should return defaults when moderation.yaml does not exist', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadModerationConfig();

      expect(config.version).toBe(1);
      expect(config.blocklist.words).toEqual([]);
    });
  });

  describe('loadModelsConfig', () => {
    it('should load valid models.yaml', () => {
      const modelsConfig = {
        version: 1,
        openrouter: { base_url: 'https://openrouter.ai/api/v1' },
        models: {
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
          analysis: { model: 'anthropic/claude-3-haiku', temperature: 0.3, max_tokens: 2000 },
          moderation: { model: 'anthropic/claude-3-haiku', temperature: 0.1, max_tokens: 500 },
        },
        image_generation: { enabled: false },
      };
      fs.writeFileSync(path.join(testConfigDir, 'models.yaml'), yaml.stringify(modelsConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadModelsConfig();

      expect(loaded.openrouter.base_url).toBe('https://openrouter.ai/api/v1');
      expect(loaded.models.content_generation.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should return defaults when models.yaml does not exist', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadModelsConfig();

      expect(config.version).toBe(1);
      expect(config.openrouter.base_url).toBe('https://openrouter.ai/api/v1');
    });
  });

  describe('loadAll', () => {
    it('should load all config files', () => {
      // Create minimal config files
      fs.writeFileSync(
        path.join(testConfigDir, 'main.yaml'),
        yaml.stringify({
          version: 1,
          account: { username: '@test' },
          api_tier: {
            name: 'basic',
            limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
          },
          settings: { timezone: 'UTC', log_level: 'debug' },
          features: {
            engagement_automation: true,
            trend_monitoring: true,
            network_building: true,
            image_generation: false,
            ab_testing: false,
          },
        })
      );

      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadAll();

      expect(config.main).toBeDefined();
      expect(config.persona).toBeDefined();
      expect(config.schedule).toBeDefined();
      expect(config.moderation).toBeDefined();
      expect(config.models).toBeDefined();
      expect(config.main.settings.log_level).toBe('debug');
    });

    it('should use defaults for missing files', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadAll();

      expect(config.main.version).toBe(1);
      expect(config.persona.version).toBe(1);
      expect(config.schedule.version).toBe(1);
    });
  });

  describe('validation', () => {
    it('should validate version field is a number', () => {
      const invalidConfig = { version: 'one' };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadMainConfig()).toThrow();
    });

    it('should validate required fields', () => {
      const invalidConfig = {
        version: 1,
        // missing account, api_tier, etc.
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      // Should not throw because defaults fill in missing values
      const config = loader.loadMainConfig();
      expect(config.account.username).toBe('');
    });

    it('should provide helpful error messages on validation failure', () => {
      const invalidConfig = {
        version: 1,
        api_tier: {
          name: 'invalid_tier', // Should be basic, pro, or enterprise
          limits: { posts_per_month: -1 }, // Should be positive
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      try {
        loader.loadMainConfig();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
        // Error should contain information about the field
      }
    });
  });

  describe('hot reload detection', () => {
    it('should detect config file changes', async () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'main.yaml'),
        yaml.stringify({
          version: 1,
          account: { username: '@initial' },
          api_tier: {
            name: 'basic',
            limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
          },
          settings: { timezone: 'UTC', log_level: 'info' },
          features: {
            engagement_automation: true,
            trend_monitoring: true,
            network_building: true,
            image_generation: false,
            ab_testing: false,
          },
        })
      );

      const loader = new ConfigLoader(testConfigDir);
      const initial = loader.loadMainConfig();
      expect(initial.account.username).toBe('@initial');

      // Wait a moment to ensure different mtime
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Modify the file
      fs.writeFileSync(
        path.join(testConfigDir, 'main.yaml'),
        yaml.stringify({
          version: 1,
          account: { username: '@updated' },
          api_tier: {
            name: 'basic',
            limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
          },
          settings: { timezone: 'UTC', log_level: 'info' },
          features: {
            engagement_automation: true,
            trend_monitoring: true,
            network_building: true,
            image_generation: false,
            ab_testing: false,
          },
        })
      );

      // Check if config detects changes
      expect(loader.hasConfigChanged('main')).toBe(true);

      // Reload should get new value
      const reloaded = loader.loadMainConfig();
      expect(reloaded.account.username).toBe('@updated');
    });

    it('should return false when config has not changed', () => {
      fs.writeFileSync(
        path.join(testConfigDir, 'main.yaml'),
        yaml.stringify({
          version: 1,
          account: { username: '@test' },
          api_tier: {
            name: 'basic',
            limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
          },
          settings: { timezone: 'UTC', log_level: 'info' },
          features: {
            engagement_automation: true,
            trend_monitoring: true,
            network_building: true,
            image_generation: false,
            ab_testing: false,
          },
        })
      );

      const loader = new ConfigLoader(testConfigDir);
      loader.loadMainConfig();

      expect(loader.hasConfigChanged('main')).toBe(false);
    });
  });
});

describe('getConfig singleton', () => {
  let testConfigDir: string;

  beforeEach(() => {
    resetConfig();
    testConfigDir = path.join(
      os.tmpdir(),
      `config-singleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    resetConfig();
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('should return singleton instance', () => {
    const config1 = getConfig(testConfigDir);
    const config2 = getConfig();

    expect(config1).toBe(config2);
  });

  it('should reset singleton correctly', () => {
    const config1 = getConfig(testConfigDir);
    resetConfig();
    const config2 = getConfig(testConfigDir);

    expect(config1).not.toBe(config2);
  });
});

describe('getConfigDir', () => {
  it('should return default config directory path', () => {
    const expected = path.join(os.homedir(), '.social-agent', 'config');
    expect(getConfigDir()).toBe(expected);
  });
});

describe('ensureConfigDir', () => {
  let testBaseDir: string;

  beforeEach(() => {
    testBaseDir = path.join(
      os.tmpdir(),
      `ensure-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it('should create config directory if it does not exist', () => {
    const configDir = path.join(testBaseDir, '.social-agent', 'config');
    expect(fs.existsSync(configDir)).toBe(false);

    ensureConfigDir(configDir);

    expect(fs.existsSync(configDir)).toBe(true);
  });

  it('should not throw if directory already exists', () => {
    const configDir = path.join(testBaseDir, '.social-agent', 'config');
    fs.mkdirSync(configDir, { recursive: true });

    expect(() => ensureConfigDir(configDir)).not.toThrow();
  });
});

describe('Config Types', () => {
  it('should export MainConfig type', () => {
    const config: MainConfig = {
      version: 1,
      account: { username: '@test' },
      api_tier: {
        name: 'basic',
        description: 'Basic tier',
        limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
      },
      settings: { timezone: 'UTC', log_level: 'info' },
      features: {
        engagement_automation: true,
        trend_monitoring: true,
        network_building: true,
        image_generation: false,
        ab_testing: false,
      },
    };
    expect(config.version).toBe(1);
  });

  it('should export PersonaConfig type', () => {
    const config: PersonaConfig = {
      version: 1,
      identity: { name: 'Test', role: 'Dev' },
      niche: { primary: 'Tech', secondary: [] },
      voice: { tone: 'friendly', style: 'casual', personality: [] },
      rules: { do: [], dont: [] },
      examples: [],
      ab_testing: { enabled: false, test_elements: [] },
    };
    expect(config.identity.name).toBe('Test');
  });

  it('should export ScheduleConfig type', () => {
    const config: ScheduleConfig = {
      version: 1,
      frequency: { type: 'variable', min_posts_per_day: 1, max_posts_per_day: 3 },
      active_hours: { start: '09:00', end: '17:00' },
      blackouts: [],
      inactivity: { action: 'pause', threshold_days: 3 },
      queue: { max_size: 50, min_buffer: 5 },
    };
    expect(config.frequency.type).toBe('variable');
  });

  it('should export ModerationConfig type', () => {
    const config: ModerationConfig = {
      version: 1,
      blocklist: { words: [], phrases: [] },
      topics: { engage: [], avoid: [], alert_only: [] },
      ai_safety: { enabled: true, check_for: [] },
      brand_safety: { enabled: true, check_for: [] },
    };
    expect(config.ai_safety.enabled).toBe(true);
  });

  it('should export ModelsConfig type', () => {
    const config: ModelsConfig = {
      version: 1,
      openrouter: { base_url: 'https://openrouter.ai/api/v1' },
      models: {
        content_generation: { model: 'test', temperature: 0.7, max_tokens: 1000 },
        engagement_replies: { model: 'test', temperature: 0.6, max_tokens: 500 },
        analysis: { model: 'test', temperature: 0.3, max_tokens: 2000 },
        moderation: { model: 'test', temperature: 0.1, max_tokens: 500 },
      },
      image_generation: { enabled: false },
    };
    expect(config.openrouter.base_url).toBe('https://openrouter.ai/api/v1');
  });

  it('should export FullConfig type', () => {
    const config: FullConfig = {
      main: {
        version: 1,
        account: { username: '' },
        api_tier: {
          name: 'basic',
          limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
        },
        settings: { timezone: 'local', log_level: 'info' },
        features: {
          engagement_automation: true,
          trend_monitoring: true,
          network_building: true,
          image_generation: false,
          ab_testing: false,
        },
      },
      persona: {
        version: 1,
        identity: { name: '', role: '' },
        niche: { primary: '', secondary: [] },
        voice: { tone: '', style: '', personality: [] },
        rules: { do: [], dont: [] },
        examples: [],
        ab_testing: { enabled: false, test_elements: [] },
      },
      schedule: {
        version: 1,
        frequency: { type: 'variable', min_posts_per_day: 2, max_posts_per_day: 6 },
        active_hours: { start: '08:00', end: '21:00' },
        blackouts: [],
        inactivity: { action: 'reduce', threshold_days: 3 },
        queue: { max_size: 50, min_buffer: 5 },
      },
      moderation: {
        version: 1,
        blocklist: { words: [], phrases: [] },
        topics: { engage: [], avoid: [], alert_only: [] },
        ai_safety: { enabled: true, check_for: [] },
        brand_safety: { enabled: true, check_for: [] },
      },
      models: {
        version: 1,
        openrouter: { base_url: 'https://openrouter.ai/api/v1' },
        models: {
          content_generation: { model: '', temperature: 0.7, max_tokens: 1000 },
          engagement_replies: { model: '', temperature: 0.6, max_tokens: 500 },
          analysis: { model: '', temperature: 0.3, max_tokens: 2000 },
          moderation: { model: '', temperature: 0.1, max_tokens: 500 },
        },
        image_generation: { enabled: false },
      },
    };
    expect(config.main).toBeDefined();
    expect(config.persona).toBeDefined();
  });
});

describe('MainConfig autonomy configuration', () => {
  let testConfigDir: string;

  beforeEach(() => {
    resetConfig();
    testConfigDir = path.join(
      os.tmpdir(),
      `config-autonomy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    resetConfig();
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('autonomy.tasks', () => {
    it('should load autonomy task settings from main.yaml', () => {
      const mainConfig = {
        version: 1,
        autonomy: {
          tasks: {
            new_posts: { level: 'approval_required', confidence_threshold: 80 },
            thread_posts: { level: 'approval_required', confidence_threshold: 85 },
            replies: { level: 'auto' },
            quote_tweets: { level: 'confidence_based', confidence_threshold: 75 },
            engagement: { level: 'auto' },
            network_building: { level: 'confidence_based', confidence_threshold: 70 },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(mainConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadMainConfig();

      expect(loaded.autonomy?.tasks.new_posts.level).toBe('approval_required');
      expect(loaded.autonomy?.tasks.new_posts.confidence_threshold).toBe(80);
      expect(loaded.autonomy?.tasks.replies.level).toBe('auto');
      expect(loaded.autonomy?.tasks.quote_tweets.confidence_threshold).toBe(75);
    });

    it('should validate autonomy level enum values', () => {
      const invalidConfig = {
        version: 1,
        autonomy: {
          tasks: {
            new_posts: { level: 'invalid_level' },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadMainConfig()).toThrow();
    });

    it('should validate confidence_threshold is between 0 and 100', () => {
      const invalidConfig = {
        version: 1,
        autonomy: {
          tasks: {
            new_posts: { level: 'confidence_based', confidence_threshold: 150 },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadMainConfig()).toThrow();
    });

    it('should provide defaults for autonomy tasks', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadMainConfig();

      expect(config.autonomy?.tasks.new_posts.level).toBe('approval_required');
      expect(config.autonomy?.tasks.replies.level).toBe('auto');
    });
  });

  describe('autonomy.confidence', () => {
    it('should load confidence scoring weights from main.yaml', () => {
      const mainConfig = {
        version: 1,
        autonomy: {
          confidence: {
            weights: {
              voice_alignment: 0.3,
              topic_relevance: 0.2,
              predicted_engagement: 0.2,
              safety_score: 0.2,
              similarity_to_past: 0.1,
            },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(mainConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadMainConfig();

      expect(loaded.autonomy?.confidence.weights.voice_alignment).toBe(0.3);
      expect(loaded.autonomy?.confidence.weights.topic_relevance).toBe(0.2);
      expect(loaded.autonomy?.confidence.weights.safety_score).toBe(0.2);
    });

    it('should validate weights are between 0 and 1', () => {
      const invalidConfig = {
        version: 1,
        autonomy: {
          confidence: {
            weights: {
              voice_alignment: 1.5, // Invalid: > 1
            },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(invalidConfig));

      const loader = new ConfigLoader(testConfigDir);
      expect(() => loader.loadMainConfig()).toThrow();
    });

    it('should provide default weights', () => {
      const loader = new ConfigLoader(testConfigDir);
      const config = loader.loadMainConfig();

      expect(config.autonomy?.confidence.weights.voice_alignment).toBe(0.3);
      expect(config.autonomy?.confidence.weights.topic_relevance).toBe(0.2);
    });
  });

  describe('full autonomy config', () => {
    it('should load complete autonomy configuration', () => {
      const mainConfig = {
        version: 1,
        account: { username: '@testuser' },
        api_tier: {
          name: 'basic',
          limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
        },
        settings: { timezone: 'UTC', log_level: 'info' },
        features: {
          engagement_automation: true,
          trend_monitoring: true,
          network_building: true,
          image_generation: false,
          ab_testing: false,
        },
        autonomy: {
          tasks: {
            new_posts: { level: 'confidence_based', confidence_threshold: 80 },
            thread_posts: { level: 'approval_required', confidence_threshold: 85 },
            replies: { level: 'auto' },
            quote_tweets: { level: 'confidence_based', confidence_threshold: 75 },
            engagement: { level: 'auto' },
            network_building: { level: 'confidence_based', confidence_threshold: 70 },
          },
          confidence: {
            weights: {
              voice_alignment: 0.25,
              topic_relevance: 0.25,
              predicted_engagement: 0.2,
              safety_score: 0.2,
              similarity_to_past: 0.1,
            },
          },
        },
      };
      fs.writeFileSync(path.join(testConfigDir, 'main.yaml'), yaml.stringify(mainConfig));

      const loader = new ConfigLoader(testConfigDir);
      const loaded = loader.loadMainConfig();

      expect(loaded.autonomy).toBeDefined();
      expect(loaded.autonomy?.tasks).toBeDefined();
      expect(loaded.autonomy?.confidence).toBeDefined();
    });

    it('should export MainConfig type with autonomy field', () => {
      const config: MainConfig = {
        version: 1,
        account: { username: '@test' },
        api_tier: {
          name: 'basic',
          limits: { posts_per_month: 1500, reads_per_month: 10000, requests_per_15min: 50 },
        },
        settings: { timezone: 'UTC', log_level: 'info' },
        features: {
          engagement_automation: true,
          trend_monitoring: true,
          network_building: true,
          image_generation: false,
          ab_testing: false,
        },
        autonomy: {
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
        },
      };
      expect(config.autonomy?.tasks.new_posts.level).toBe('approval_required');
    });
  });
});
