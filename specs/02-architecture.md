# Technical Architecture

## Technology Stack

### Runtime & Language
- **Language**: TypeScript
- **Runtime**: Node.js (LTS)
- **Package Manager**: npm or pnpm

### TUI Framework
- **Primary**: [Ink](https://github.com/vadimdemedes/ink) - React-like terminal UI
- **Why Ink**:
  - React paradigm familiar to many developers
  - Component-based architecture
  - Great ecosystem of components
  - Active maintenance

### Data Storage
- **Type**: Local file-based (JSON/YAML)
- **Structure**:
  - `config/` - YAML configuration files
  - `data/` - JSON data files (queue, drafts, analytics)
  - `logs/` - Log files with configurable levels
  - `backups/` - Auto-backup directory

### External APIs
- **X (Twitter)**: Official X API v2 with API key authentication
- **OpenRouter**: LLM access for AI features (model-agnostic)
- **Image Generation**: Via OpenRouter or configurable model endpoint

## System Architecture

### Monolithic Design
Single application with modular internal structure:

```
social-agent/
├── src/
│   ├── cli/              # CLI entry point and commands
│   ├── tui/              # Ink TUI components
│   │   ├── components/   # Reusable UI components
│   │   ├── screens/      # Tab screens (dashboard, queue, etc.)
│   │   └── hooks/        # React hooks for state/data
│   ├── core/             # Core business logic
│   │   ├── content/      # Content generation & management
│   │   ├── scheduler/    # Queue and scheduling logic
│   │   ├── engagement/   # Auto-reply and engagement
│   │   ├── analytics/    # Metrics and learning
│   │   └── network/      # Network building features
│   ├── ai/               # AI integration layer
│   │   ├── openrouter/   # OpenRouter client
│   │   ├── prompts/      # Prompt templates
│   │   ├── reasoning/    # Decision logging
│   │   └── image/        # Image generation
│   ├── api/              # External API clients
│   │   └── x/            # X API client
│   ├── storage/          # Data persistence layer
│   ├── config/           # Configuration management
│   └── utils/            # Shared utilities
├── config/               # User configuration files
├── data/                 # Runtime data storage
├── logs/                 # Log files
└── backups/             # Auto-backups
```

## Execution Model

### On-Demand Execution
- Agent runs only when invoked by user
- No background daemon or cron jobs
- Processes queue, performs scheduled actions, then exits
- User controls when agent runs

### Command Structure
Flat command pattern:
```bash
social-agent dashboard    # Launch TUI dashboard
social-agent post         # Create/queue a post
social-agent queue        # View/manage queue
social-agent trends       # View trending topics
social-agent engage       # Run engagement loop
social-agent analytics    # View analytics
social-agent config       # Configuration management
social-agent setup        # Interactive setup wizard
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User (TUI/CLI)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Command Router                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Content    │    │  Engagement   │    │   Analytics   │
│    Engine     │    │    Engine     │    │    Engine     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Layer (OpenRouter)                   │
│  - Content Generation    - Reply Generation                  │
│  - Image Generation      - Decision Making                   │
│  - Confidence Scoring    - Learning/Optimization             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      X API Layer                             │
│  - Post/Thread Creation  - Timeline Reading                  │
│  - Reply Posting         - User Lookup                       │
│  - Media Upload          - Engagement Actions                │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

### API Key Management
- All API keys stored in environment variables
- `.env` file supported (gitignored)
- No keys in configuration files

### Environment Variables
```bash
X_API_KEY=xxx
X_API_SECRET=xxx
X_ACCESS_TOKEN=xxx
X_ACCESS_TOKEN_SECRET=xxx
OPENROUTER_API_KEY=xxx
```

## Error Handling Strategy

### Retry Pattern
- Simple exponential backoff for API errors
- Max 3 retry attempts
- Log errors and exit on persistent failure

### Network Resilience
- Queue failed operations for retry on next run
- Status indicator for network state
- Graceful degradation when connectivity issues

## Logging System

### Configurable Levels
- `error`: Only errors and critical events
- `warn`: Warnings and errors
- `info`: Standard operations + warnings + errors
- `debug`: Verbose with API calls
- `trace`: Full detail including AI reasoning

### Log Output
- File-based logs in `logs/` directory
- Console output respects log level
- Timestamps on all entries

## Extensibility

### Future Integration Points
- Plugin architecture considerations in design
- Abstract API clients for easy additions
- Config-driven feature enablement
