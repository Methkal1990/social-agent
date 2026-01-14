# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**social-agent** is an AI-powered CLI/TUI social media management agent for X (Twitter). It provides configurable autonomy levels, AI-generated content, engagement automation, and network building features.

### Path Alias

Use `@/*` for imports from `src/*`:
```typescript
import { something } from '@/config';
```

## Specifications

Detailed specs in `specs/` directory:
- `01-overview.md` - Project scope and goals
- `02-architecture.md` - Technical architecture
- `03-features-core.md` through `06-features-engagement.md` - Feature specs
- `07-tui-design.md` - TUI component designs
- `08-configuration.md` - Config schema definitions
- `12-development-plan.md` - Implementation phases
- `13-agent-sdk.md` - Vercel AI SDK integration patterns

PLAN MODE:
- make the plan extremely concise.sacrifice grammer for sake of concision.
- at the end of each plan, give me a list of unresolved questions to answer, if any.