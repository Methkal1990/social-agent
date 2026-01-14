# Core Features

## 1. Content Generation

### Multi-Source Content Creation
The agent generates content from three sources:

#### Original Content Generation
- AI creates posts from scratch based on:
  - Configured topics and niche
  - User's voice/style profile
  - Current trends
  - Performance data (what works)

#### Content Repurposing
- Transform long-form content into social posts:
  - Blog posts → tweet threads
  - Articles → key takeaways
  - Ideas → multiple angles

#### Trend-Based Content
- Monitor trending topics in user's niche
- Generate timely, relevant content
- Capitalize on viral opportunities

### Content Types
All types supported and configurable:
- **Educational/Tips**: How-tos, insights, knowledge sharing
- **Personal Stories**: Experiences, lessons, behind-the-scenes
- **Engagement Posts**: Questions, discussions, debates
- **Commentary**: Thoughts on industry news/trends

### Post Length
- AI determines optimal length based on content
- Context-dependent: short punchy vs full 280 chars
- Thread decision made automatically

## 2. Threading System

### Smart Threading
AI automatically decides when content should be:
- Single tweet (concise, impactful)
- Multi-tweet thread (complex, detailed)

### Thread Features
- Automatic numbering and continuation
- Coherent narrative across tweets
- Natural breaks between ideas
- Thread intro and conclusion optimization

## 3. Queue System

### Queue-Based Scheduling
- All content goes through a queue
- AI picks optimal posting times
- Variable frequency based on configuration

### Queue Management
```
┌─────────────────────────────────────────┐
│  Content Queue                          │
├─────────────────────────────────────────┤
│  [Approved] Ready to post               │
│  [Pending]  Awaiting confidence check   │
│  [Review]   Needs human approval        │
│  [Draft]    Work in progress            │
└─────────────────────────────────────────┘
```

### Scheduling Configuration
- Posting frequency: Variable/configurable
- Different frequencies for different days
- Blackout periods (no posting times)
- Timezone: Local time

## 4. Media Support

### AI Image Generation
- Generate images via OpenRouter
- Configurable model selection
- Custom prompt templates for image generation
- Image attached to posts automatically

### Media Types Supported
- Images (generated or provided)
- Videos (user-provided)
- GIFs (user-provided)

## 5. Quote Tweets

### Strategic Quote Tweeting
- AI identifies viral/relevant content
- Generates insightful commentary
- Strategic timing for maximum impact
- Follows brand voice

### Quote Tweet Workflow
1. AI monitors for quotable content
2. Scores opportunity (viral potential, relevance)
3. Generates commentary draft
4. Confidence-based approval
5. Posts at optimal time

## 6. Draft Management

### Simple Save List
- Flat list of saved content ideas
- Generated content saved for later
- Easy edit/schedule/delete
- No complex categorization

### Draft States
- `idea`: Raw content idea
- `drafted`: Written but not finalized
- `ready`: Ready to queue

## 7. No Hashtags Policy
- Agent does not add hashtags (per X recommendations)
- Focus on natural, organic content
- Keyword blocking includes hashtag prevention

## 8. Content Deduplication

### Full Content Graph
- Track all posted content
- Detect semantic similarity
- Ensure variety in output
- Prevent repetition of ideas

### Similarity Detection
- Exact match prevention
- Semantic similarity scoring
- Topic overlap detection
- Configurable similarity threshold

## 9. A/B Testing

### Full Optimization System
- AI creates content variants
- Tracks performance of each variant
- Automatic winner selection
- Continuous experimentation

### A/B Test Types
- Copy variations (wording, tone)
- Timing tests (when to post)
- Format tests (thread vs single)
- Hook tests (opening lines)

## 10. Export Features

### Multi-Format Export
- **Markdown**: Posts formatted as markdown
- **JSON**: Structured data export
- **CSV**: Spreadsheet-compatible

### Export Scope
- All posts
- Date range
- Performance filtered
- Drafts included option
