# Configuration System

## 1. Configuration Approach

### Setup Wizard + Config Files
- Interactive wizard for initial setup
- YAML files for ongoing configuration
- Sensible defaults for all settings
- Hot-reload support for config changes

## 2. Configuration Directory Structure

```
~/.social-agent/
├── config/
│   ├── main.yaml          # Main configuration
│   ├── persona.yaml       # Voice and style settings
│   ├── schedule.yaml      # Scheduling preferences
│   ├── moderation.yaml    # Content moderation rules
│   └── models.yaml        # AI model configuration
├── data/
│   ├── queue.json         # Content queue
│   ├── drafts.json        # Saved drafts
│   ├── analytics.json     # Performance data
│   └── learning.json      # AI learning data
├── logs/
│   └── social-agent.log   # Log files
└── backups/
    └── YYYY-MM-DD/        # Daily backups
```

## 3. Main Configuration

### main.yaml
```yaml
# Social Agent Configuration
version: 1

# Account settings
account:
  username: "@yourusername"

# API tier configuration
api_tier:
  name: "basic"  # basic, pro, enterprise
  description: |
    Basic tier includes:
    - 1,500 tweets/month write
    - 10,000 tweets/month read
    - Rate limits: 50 requests/15 min
  limits:
    posts_per_month: 1500
    reads_per_month: 10000
    requests_per_15min: 50

# General settings
settings:
  timezone: "local"
  log_level: "info"  # error, warn, info, debug, trace

# Feature toggles
features:
  engagement_automation: true
  trend_monitoring: true
  network_building: true
  image_generation: true
  ab_testing: true
```

## 4. Persona Configuration

### persona.yaml
```yaml
# Persona and Voice Configuration
version: 1

# Core identity
identity:
  name: "Your Name"
  role: "Software Engineer & AI Enthusiast"

# Niche/topics (user-defined)
niche:
  primary: "AI and Machine Learning"
  secondary:
    - "Software Engineering"
    - "Productivity"
    - "Tech Industry"
  description: |
    Focus on practical AI applications, engineering
    best practices, and productivity optimization.

# Voice characteristics
voice:
  tone: "professional but approachable"
  style: "educational, insightful"
  personality:
    - "curious and always learning"
    - "shares knowledge generously"
    - "asks thought-provoking questions"

# Content rules
rules:
  do:
    - "use analogies to explain complex topics"
    - "share personal experiences and lessons"
    - "ask engaging questions"
    - "provide actionable advice"
  dont:
    - "be overly formal or corporate"
    - "use excessive jargon"
    - "engage in political debates"
    - "be negative about competitors"

# Example posts (for style learning)
examples:
  - "The best way to learn AI isn't watching tutorials. It's building something, breaking it, and figuring out why."
  - "3 things I wish I knew when starting with ML: 1) Start simple 2) Data quality > model complexity 3) Deploy early, iterate often"
  - "Unpopular opinion: The best productivity tool is knowing when to stop optimizing and just start doing."

# A/B testing variations
ab_testing:
  enabled: true
  test_elements:
    - "hook_styles"
    - "post_lengths"
    - "question_types"
```

## 5. Schedule Configuration

### schedule.yaml
```yaml
# Scheduling Configuration
version: 1

# Posting frequency
frequency:
  type: "variable"  # fixed, variable
  min_posts_per_day: 2
  max_posts_per_day: 6

  # Day-specific overrides
  daily_override:
    monday: { min: 3, max: 5 }
    friday: { min: 2, max: 3 }
    saturday: { min: 1, max: 2 }
    sunday: { min: 1, max: 2 }

# Active hours
active_hours:
  start: "08:00"
  end: "21:00"

# Blackout periods (no posting)
blackouts:
  - { start: "23:00", end: "06:00" }

# Inactivity behavior
inactivity:
  action: "reduce"  # keep_posting, pause, reduce, alert_wait
  threshold_days: 3
  reduction_percent: 50

# Queue management
queue:
  max_size: 50
  min_buffer: 5  # Alert when queue drops below this
```

## 6. Moderation Configuration

### moderation.yaml
```yaml
# Content Moderation Configuration
version: 1

# Keyword blocklist
blocklist:
  words:
    - "offensive_word1"
    - "controversial_term"
  phrases:
    - "problematic phrase"

# Topic rules
topics:
  engage:
    - "AI ethics"
    - "tech industry trends"
    - "productivity tips"
  avoid:
    - "politics"
    - "religion"
    - "divisive social issues"
  alert_only:
    - "breaking news"
    - "crisis events"
    - "industry drama"

# AI safety check
ai_safety:
  enabled: true
  check_for:
    - "offensive content"
    - "misinformation risk"
    - "brand safety issues"

# Brand safety
brand_safety:
  enabled: true
  check_for:
    - "consistency with persona"
    - "professional tone"
    - "reputation risks"
```

## 7. Model Configuration

### models.yaml
```yaml
# AI Model Configuration
version: 1

# OpenRouter settings
openrouter:
  base_url: "https://openrouter.ai/api/v1"

# Model assignments
models:
  content_generation:
    model: "anthropic/claude-3.5-sonnet"
    temperature: 0.7
    max_tokens: 1000

  engagement_replies:
    model: "anthropic/claude-3-haiku"
    temperature: 0.6
    max_tokens: 500

  analysis:
    model: "anthropic/claude-3-haiku"
    temperature: 0.3
    max_tokens: 2000

  image_generation:
    model: "openai/dall-e-3"
    size: "1024x1024"
    quality: "standard"

  moderation:
    model: "anthropic/claude-3-haiku"
    temperature: 0.1
    max_tokens: 500

# Image generation settings
image_generation:
  enabled: true
  style_prompt: "modern, clean, professional, tech-focused"
  prompt_template: |
    Create an image for a social media post about: {topic}
    Style: {style}
    The image should be suitable for a tech/AI focused audience.
```

## 8. Autonomy Configuration

### In main.yaml or separate autonomy.yaml
```yaml
# Autonomy Levels
autonomy:
  # Per-task autonomy settings
  tasks:
    new_posts:
      level: "approval_required"  # auto, confidence_based, approval_required
      confidence_threshold: 80

    thread_posts:
      level: "approval_required"
      confidence_threshold: 85

    replies:
      level: "auto"

    quote_tweets:
      level: "confidence_based"
      confidence_threshold: 75

    engagement:
      level: "auto"  # likes, follows

    network_building:
      level: "confidence_based"
      confidence_threshold: 70

# Confidence scoring weights
confidence:
  weights:
    voice_alignment: 0.3
    topic_relevance: 0.2
    predicted_engagement: 0.2
    safety_score: 0.2
    similarity_to_past: 0.1
```

## 9. Environment Variables

### Required Variables
```bash
# X API Credentials
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_key

# Optional: Sandbox account for testing
X_SANDBOX_API_KEY=sandbox_api_key
X_SANDBOX_ACCESS_TOKEN=sandbox_token
```

### .env File Support
```bash
# .env file in project root (gitignored)
X_API_KEY=xxx
X_API_SECRET=xxx
X_ACCESS_TOKEN=xxx
X_ACCESS_TOKEN_SECRET=xxx
OPENROUTER_API_KEY=xxx
```

## 10. Setup Wizard Flow

### Interactive Setup Steps
1. **Welcome & Overview**
   - Explain what the agent does
   - List required API keys

2. **X API Configuration**
   - Enter API credentials
   - Test connection
   - Detect API tier

3. **OpenRouter Configuration**
   - Enter API key
   - Test connection
   - Select preferred models

4. **Persona Setup**
   - Define niche/topics
   - Set voice and tone
   - Add example posts (optional)

5. **Schedule Preferences**
   - Set posting frequency
   - Define active hours
   - Configure inactivity behavior

6. **Review & Confirm**
   - Show all settings
   - Generate config files
   - Ready to use!

### Wizard Command
```bash
social-agent setup          # Full setup wizard
social-agent setup --api    # API setup only
social-agent setup --reset  # Reset all configuration
```
