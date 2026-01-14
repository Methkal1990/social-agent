# AI Features & Intelligence

## 1. LLM Integration

### OpenRouter Provider
- **Why OpenRouter**: Model-agnostic, access to any model
- Single API for multiple models
- Easy model switching without code changes

### Configurable Models
```yaml
ai:
  content_model: "anthropic/claude-3.5-sonnet"
  image_model: "openai/dall-e-3"
  analysis_model: "anthropic/claude-3-haiku"
```

Users can configure different models for:
- Content generation
- Image generation
- Analytics/analysis
- Engagement responses

## 2. Voice & Style Learning

### Multi-Method Style Learning
Combines three approaches for best results:

#### Style Guide Configuration
```yaml
persona:
  tone: "professional but approachable"
  topics:
    - "software engineering"
    - "AI/ML"
    - "productivity"
  do:
    - "use analogies to explain complex topics"
    - "share personal experiences"
    - "ask thought-provoking questions"
  dont:
    - "be overly formal"
    - "use jargon without explanation"
    - "engage in political debates"
```

#### Example-Based Learning
- Provide 10-20 example posts you like
- AI extracts patterns and style
- Continuous refinement from new examples

#### History Analysis (Optional)
- Analyze your past posts (if imported)
- Extract voice patterns
- Identify successful content themes

### Single Persona
- One consistent voice across all content
- Context adaptation within voice boundaries
- A/B testing different expressions of same voice

## 3. Configurable Autonomy

### Per-Task Autonomy Levels
```yaml
autonomy:
  new_posts: "approval_required"    # Always review new posts
  replies: "auto"                   # Full automation
  quote_tweets: "approval_required" # Review before posting
  engagement: "auto"                # Auto likes, follows
```

### Autonomy Options
- `auto`: Fully autonomous, no approval needed
- `confidence_based`: Auto if high confidence, review if low
- `approval_required`: Always requires human approval

## 4. Confidence-Based Approval

### Confidence Scoring
Every AI-generated content gets a confidence score:
- **High (80-100%)**: Auto-approved (if autonomy allows)
- **Medium (50-79%)**: AI improvement attempt, then review
- **Low (0-49%)**: Sent to review queue

### Scoring Factors
- Alignment with voice/style
- Topic relevance
- Potential engagement (predicted)
- Safety/moderation checks
- Similarity to successful past posts

### Low Confidence Workflow
```
Low Confidence Post
        │
        ▼
┌───────────────────┐
│ AI Improvement    │
│ Loop              │
│ - Refine content  │
│ - Adjust tone     │
│ - Improve hook    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Re-score          │
└───────────────────┘
        │
   ┌────┴────┐
   ▼         ▼
High/Med    Still Low
   │           │
   ▼           ▼
Process    Review Queue
Normally
```

## 5. AI Learning Loop

### Performance-Based Learning
Agent continuously improves by learning from:
- Post performance (engagement, reach)
- Best posting times
- Content patterns that work
- Audience preferences

### Full Signal Capture
Data collected for learning:
```
├── Engagement Metrics
│   ├── Likes
│   ├── Retweets
│   ├── Replies
│   └── Impressions
├── Timing Signals
│   ├── Day of week
│   ├── Hour posted
│   └── Time since last post
├── Content Features
│   ├── Length
│   ├── Type (educational, story, etc.)
│   ├── Topics mentioned
│   └── Sentiment
└── Audience Response
    ├── Follower engagement rate
    ├── New follower acquisition
    └── Profile visits
```

### Learning Application
- Adjust content generation prompts
- Optimize posting schedule
- Refine topic selection
- Improve hook writing

## 6. AI Reasoning Transparency

### Full Reasoning Logs
Every AI decision is logged with:
- Input context
- Decision factors considered
- Reasoning chain
- Final decision
- Confidence score

### Log Format
```json
{
  "decision_type": "content_generation",
  "timestamp": "2024-01-15T10:30:00Z",
  "input": {
    "topic": "AI productivity tips",
    "context": "Monday morning, tech audience"
  },
  "reasoning": [
    "Topic aligns with user niche (score: 0.9)",
    "Monday morning good for professional content",
    "Recent posts were short, suggesting longer thread",
    "No similar content in past 7 days"
  ],
  "decision": "Generate 4-tweet thread on AI productivity",
  "confidence": 0.85
}
```

## 7. Content Moderation

### Multi-Layer Safety System

#### Layer 1: Keyword Blocklist
- User-defined blocked words/phrases
- Automatic hashtag prevention
- Topic exclusions

#### Layer 2: AI Safety Check
- Secondary AI pass on all content
- Checks for:
  - Offensive content
  - Misinformation risk
  - Brand safety issues
  - Unintended implications

#### Layer 3: Brand Safety
- Ensures content aligns with persona
- Checks consistency with past messaging
- Prevents reputation risks

### Controversial Topics
```yaml
hot_topics:
  engage: ["AI ethics", "tech industry trends"]
  avoid: ["politics", "religion", "divisive issues"]
  alert_only: ["breaking news", "crisis events"]
```

## 8. Image Generation

### AI Image Pipeline
1. Content analyzed for image opportunity
2. Image prompt generated from content context
3. Model called via OpenRouter
4. Image attached to post

### Configuration
```yaml
image_generation:
  enabled: true
  model: "openai/dall-e-3"
  style: "modern, clean, professional"
  prompt_template: |
    Create an image for a social media post about: {topic}
    Style: {style}
    Mood: {mood}
```

## 9. Task Prioritization

### AI-Optimized Priority
Agent decides task order based on:
- Time sensitivity (trending topics decay)
- Engagement opportunity (reply to viral thread)
- Queue urgency (posts ready to go)
- Resource availability (API limits)

### Configurable Override
```yaml
priorities:
  engagement: "high"
  new_content: "medium"
  analytics: "low"
```

## 10. Context Awareness

### Comprehensive Context
AI considers:
- Full post history (patterns, topics)
- Current trends in niche
- User's defined niche/topics
- Recent engagement patterns
- Time of day/week factors

### Context Window
- Last 30 days of posts for pattern analysis
- Real-time trending topics
- Current queue contents
- Recent engagement activity
