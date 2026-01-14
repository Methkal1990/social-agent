# Data Storage & Backup

## 1. Storage Philosophy

### Local File-Based Storage
- All data stored locally on user's machine
- Human-readable formats (JSON, YAML)
- Easy to backup, restore, and version control
- No external database dependencies

## 2. Directory Structure

```
~/.social-agent/
├── config/              # Configuration (YAML)
│   ├── main.yaml
│   ├── persona.yaml
│   ├── schedule.yaml
│   ├── moderation.yaml
│   └── models.yaml
├── data/                # Runtime data (JSON)
│   ├── queue.json       # Content queue
│   ├── drafts.json      # Saved drafts
│   ├── analytics.json   # Performance metrics
│   ├── learning.json    # AI learning data
│   ├── content-graph.json # Deduplication data
│   ├── network.json     # Network building data
│   └── state.json       # Application state
├── logs/                # Log files
│   ├── social-agent.log
│   └── ai-reasoning.log
└── backups/             # Auto-backups
    ├── 2024-01-15/
    ├── 2024-01-14/
    └── 2024-01-13/
```

## 3. Data Schemas

### queue.json - Content Queue
```json
{
  "version": 1,
  "updated_at": "2024-01-15T10:30:00Z",
  "items": [
    {
      "id": "uuid-123",
      "type": "single",
      "status": "approved",
      "content": "AI is transforming how we work...",
      "media": null,
      "scheduled_at": "2024-01-15T14:00:00Z",
      "created_at": "2024-01-15T08:00:00Z",
      "confidence_score": 0.92,
      "source": "generated",
      "metadata": {
        "topic": "AI productivity",
        "content_type": "educational",
        "generation_prompt": "..."
      }
    },
    {
      "id": "uuid-456",
      "type": "thread",
      "status": "pending_review",
      "content": [
        "Thread: Why AI matters for developers...",
        "1/ First, it automates repetitive tasks...",
        "2/ Second, it helps with code review...",
        "3/ Finally, it accelerates learning..."
      ],
      "media": ["image-uuid-1"],
      "scheduled_at": null,
      "created_at": "2024-01-15T09:00:00Z",
      "confidence_score": 0.68,
      "source": "trend_based",
      "metadata": {
        "topic": "AI for developers",
        "content_type": "thread",
        "trend_reference": "AI productivity trending"
      }
    }
  ]
}
```

### drafts.json - Saved Drafts
```json
{
  "version": 1,
  "updated_at": "2024-01-15T10:30:00Z",
  "items": [
    {
      "id": "draft-123",
      "content": "Quick tip about AI tools...",
      "type": "single",
      "status": "idea",
      "created_at": "2024-01-14T15:00:00Z",
      "updated_at": "2024-01-15T08:00:00Z",
      "notes": "Expand on this later"
    }
  ]
}
```

### analytics.json - Performance Data
```json
{
  "version": 1,
  "updated_at": "2024-01-15T10:30:00Z",
  "posts": [
    {
      "id": "tweet-123456",
      "queue_id": "uuid-100",
      "content": "AI productivity tip...",
      "posted_at": "2024-01-14T14:00:00Z",
      "metrics": {
        "likes": 245,
        "retweets": 32,
        "replies": 12,
        "impressions": 5200,
        "collected_at": "2024-01-15T10:00:00Z"
      },
      "performance_score": 0.85,
      "metadata": {
        "topic": "AI productivity",
        "content_type": "educational",
        "length": 142,
        "posted_hour": 14,
        "posted_day": "sunday"
      }
    }
  ],
  "aggregates": {
    "daily": {
      "2024-01-14": {
        "posts": 4,
        "total_likes": 523,
        "total_impressions": 12400,
        "engagement_rate": 0.034
      }
    },
    "weekly": {},
    "monthly": {}
  }
}
```

### learning.json - AI Learning Data
```json
{
  "version": 1,
  "updated_at": "2024-01-15T10:30:00Z",
  "patterns": {
    "best_posting_times": [
      { "day": "tuesday", "hour": 9, "score": 0.92 },
      { "day": "thursday", "hour": 18, "score": 0.88 }
    ],
    "top_topics": [
      { "topic": "AI tools", "avg_engagement": 0.041 },
      { "topic": "productivity", "avg_engagement": 0.035 }
    ],
    "content_insights": {
      "threads_vs_single": {
        "threads_avg_engagement": 0.042,
        "single_avg_engagement": 0.028
      },
      "optimal_length": {
        "range": [120, 200],
        "avg_engagement": 0.038
      }
    }
  },
  "ab_tests": [
    {
      "id": "test-123",
      "name": "Hook style test",
      "status": "completed",
      "winner": "variant_b",
      "confidence": 0.94,
      "variants": {
        "variant_a": { "pattern": "Here's what I learned...", "engagement": 0.028 },
        "variant_b": { "pattern": "Most people don't know...", "engagement": 0.041 }
      }
    }
  ],
  "model_weights": {
    "voice_alignment": 0.32,
    "topic_relevance": 0.25,
    "timing_factor": 0.18,
    "length_factor": 0.15,
    "hook_style": 0.10
  }
}
```

### content-graph.json - Deduplication
```json
{
  "version": 1,
  "updated_at": "2024-01-15T10:30:00Z",
  "posts": [
    {
      "id": "uuid-123",
      "content_hash": "abc123...",
      "semantic_vector": [0.1, 0.2, ...],
      "topics": ["AI", "productivity"],
      "posted_at": "2024-01-14T14:00:00Z"
    }
  ],
  "similarity_threshold": 0.75
}
```

### network.json - Network Building
```json
{
  "version": 1,
  "updated_at": "2024-01-15T10:30:00Z",
  "suggested_follows": [
    {
      "username": "@ai_researcher",
      "reason": "High engagement in AI topics",
      "relevance_score": 0.89,
      "status": "pending"
    }
  ],
  "engagement_targets": [
    {
      "username": "@industry_leader",
      "interactions": [
        { "type": "reply", "date": "2024-01-14", "response": true }
      ],
      "relationship_score": 0.45
    }
  ],
  "communities": [
    {
      "name": "AI Tools & Productivity",
      "members": ["@user1", "@user2"],
      "discovered_at": "2024-01-10"
    }
  ]
}
```

## 4. Auto-Backup System

### Backup Configuration
```yaml
# In main.yaml
backup:
  enabled: true
  frequency: "daily"
  retention_days: 30
  include:
    - "data/"
    - "config/"
  exclude:
    - "logs/"
```

### Backup Process
1. Runs automatically on agent start (if >24h since last backup)
2. Creates timestamped backup folder
3. Copies all data and config files
4. Removes backups older than retention period

### Backup Structure
```
backups/
├── 2024-01-15/
│   ├── data/
│   │   ├── queue.json
│   │   ├── drafts.json
│   │   └── ...
│   ├── config/
│   │   ├── main.yaml
│   │   └── ...
│   └── backup-info.json
```

### Manual Backup Commands
```bash
social-agent backup create              # Create immediate backup
social-agent backup list                # List all backups
social-agent backup restore 2024-01-14  # Restore from date
```

## 5. Data Migration

### Version Handling
- Each file includes a `version` field
- Migrations run automatically on version mismatch
- Backward compatible where possible

### Migration Example
```typescript
const migrations = {
  queue: {
    1: (data) => data, // Initial version
    2: (data) => {
      // Add new field to all items
      data.items = data.items.map(item => ({
        ...item,
        new_field: 'default_value'
      }));
      data.version = 2;
      return data;
    }
  }
};
```

## 6. Data Integrity

### Validation
- Schema validation on read/write
- Corrupted file detection
- Automatic recovery from backup

### Atomic Writes
```typescript
// Write to temp file, then rename (atomic)
async function safeWrite(path: string, data: object) {
  const tempPath = `${path}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fs.rename(tempPath, path);
}
```

## 7. Export Capabilities

### Export Formats
```bash
social-agent export --format json --output ./export/
social-agent export --format csv --output ./export/
social-agent export --format markdown --output ./export/
```

### Export Contents
- All posts (content, metrics)
- Analytics summaries
- Configuration (sanitized, no API keys)
- Learning insights
