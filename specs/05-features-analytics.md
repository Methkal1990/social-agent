# Analytics & Reporting

## 1. Basic Metrics (Core)

### Per-Post Metrics
- **Likes**: Total likes received
- **Retweets**: Total retweets/reposts
- **Replies**: Number of replies
- **Impressions**: Total views

### Display Format
```
┌─────────────────────────────────────────────────────────┐
│  Recent Posts                                           │
├─────────────────────────────────────────────────────────┤
│  "AI is transforming how we..."                         │
│  📊 245 👍  32 🔄  12 💬  5.2K views                     │
│  Posted: 2h ago                                         │
├─────────────────────────────────────────────────────────┤
│  "3 tips for better productivity..."                    │
│  📊 189 👍  28 🔄  8 💬   4.1K views                     │
│  Posted: 6h ago                                         │
└─────────────────────────────────────────────────────────┘
```

## 2. Audience Intelligence

### Full Audience Analysis
- **When Followers Are Active**: Optimal posting times
- **Follower Interests**: Topics that resonate
- **Engagement Patterns**: What content types work
- **Growth Recommendations**: AI-powered suggestions

### Audience Insights Data
```
┌─────────────────────────────────────────────────────────┐
│  Audience Insights                                      │
├─────────────────────────────────────────────────────────┤
│  Most Active Times:                                     │
│    Mon-Fri: 9am, 12pm, 6pm                             │
│    Weekend: 10am, 3pm                                   │
│                                                         │
│  Top Engaging Content Types:                            │
│    1. Educational threads (4.2% engagement)             │
│    2. Personal stories (3.8% engagement)                │
│    3. Quick tips (2.9% engagement)                      │
│                                                         │
│  Growth Trend: +127 followers this week (+12%)          │
└─────────────────────────────────────────────────────────┘
```

## 3. Performance Scoring

### Post Scoring System
Each post receives a performance score:
- Based on engagement relative to followers
- Compared to account average
- Weighted by impressions

### Score Calculation
```
Score = (
  (likes × 1) +
  (retweets × 2) +
  (replies × 3)
) / impressions × 1000

Normalized against account average
```

### Top Performers Tracking
- Identify highest-scoring posts
- Extract success patterns
- Feed back into content generation

## 4. AI Learning Loop Integration

### Performance → Learning Pipeline
```
Post Published
      │
      ▼
Metrics Collected (24h, 48h, 7d)
      │
      ▼
Performance Scored
      │
      ▼
Patterns Extracted
      │
      ▼
Learning Model Updated
      │
      ▼
Future Content Improved
```

### What AI Learns From
- High-performing post characteristics
- Optimal posting times for YOUR audience
- Topic combinations that work
- Hook styles that drive engagement
- Thread vs single post performance

## 5. Trend Analysis

### Full Trend Monitoring
- **Real-time Trending Topics**: What's hot now
- **Viral Content Detection**: Content gaining momentum
- **Opportunity Alerts**: Relevant trends to capitalize on

### Trend Display
```
┌─────────────────────────────────────────────────────────┐
│  Trending in Your Niche                                 │
├─────────────────────────────────────────────────────────┤
│  🔥 #AIProductivity - 12.5K posts/hour (+340%)          │
│     Opportunity: High relevance, good timing            │
│                                                         │
│  📈 "GPT-5 rumors" - Gaining momentum                   │
│     Your take could perform well                        │
│                                                         │
│  ⚡ Competitor @techguru posted viral thread            │
│     Consider: Quote tweet with your perspective         │
└─────────────────────────────────────────────────────────┘
```

## 6. Configurable Reports

### Report Types
- **Daily Summary**: Quick snapshot of yesterday
- **Weekly Digest**: Comprehensive weekly review
- **Monthly Report**: Deep dive with trends

### Report Configuration
```yaml
reports:
  daily:
    enabled: true
    time: "09:00"
    include: ["posts", "engagement", "highlights"]
  weekly:
    enabled: true
    day: "monday"
    include: ["growth", "top_posts", "recommendations"]
  monthly:
    enabled: true
    day: 1
    include: ["full_analytics", "trends", "comparisons"]
```

### Report Contents
```
┌─────────────────────────────────────────────────────────┐
│  Weekly Digest - Jan 8-14, 2024                         │
├─────────────────────────────────────────────────────────┤
│  📊 Summary                                             │
│  • Posts published: 18                                  │
│  • Total impressions: 45.2K                             │
│  • Engagement rate: 3.4% (+0.6%)                        │
│  • New followers: 89                                    │
│                                                         │
│  🏆 Top Performer                                        │
│  "The future of AI in everyday tools..."                │
│  892 likes, 156 retweets, 12.3K impressions             │
│                                                         │
│  💡 AI Recommendations                                   │
│  • Post more threads (2.1x avg engagement)              │
│  • Best times: Tue 9am, Thu 6pm                         │
│  • Topic opportunity: "AI tools" trending               │
└─────────────────────────────────────────────────────────┘
```

## 7. A/B Test Results

### Test Performance Tracking
- Track variant performance
- Statistical significance detection
- Automatic winner selection

### A/B Results Display
```
┌─────────────────────────────────────────────────────────┐
│  A/B Test: Hook Style Experiment                        │
├─────────────────────────────────────────────────────────┤
│  Variant A: "Here's what I learned..."                  │
│  • Engagement: 2.8%                                     │
│  • Impressions: 2.1K avg                                │
│                                                         │
│  Variant B: "Most people don't know..."                 │
│  • Engagement: 4.1% ⭐ WINNER                           │
│  • Impressions: 3.4K avg                                │
│                                                         │
│  Confidence: 94%                                        │
│  Applying winner to future posts...                     │
└─────────────────────────────────────────────────────────┘
```

## 8. Network Building Analytics

### Follow Suggestions Performance
- Track suggested accounts followed
- Measure follow-back rate
- Engagement from new connections

### Engagement Target Results
- High-value accounts engaged with
- Response rate from targets
- Relationship building progress

## 9. Historical Comparisons

### Time-Based Comparisons
- Week over week
- Month over month
- Growth trajectory

### Benchmark Tracking
- Personal bests
- Average performance
- Improvement trends

## 10. Export & Data Access

### Analytics Export
```bash
social-agent analytics export --format csv --range 30d
social-agent analytics export --format json --all
```

### Exported Data
- All metrics per post
- Aggregate statistics
- Learning model insights
- A/B test results
