# API Integrations

## 1. X (Twitter) API

### API Version
- X API v2 (current version)
- REST endpoints for all operations

### Authentication
- API Key authentication (OAuth 1.0a User Context)
- Keys stored in environment variables
- No browser-based OAuth flow (CLI-focused)

### Required Credentials
```bash
X_API_KEY=consumer_key
X_API_SECRET=consumer_secret
X_ACCESS_TOKEN=access_token
X_ACCESS_TOKEN_SECRET=access_token_secret
```

### API Tier Configuration
The agent is designed to work with any API tier. Users provide tier information:

```yaml
api_tier:
  name: "basic"  # User specifies their tier
  description: |
    The Basic tier ($100/month) includes:
    - Tweet cap: 1,500 posts/month
    - Read operations: 10,000/month
    - Rate limit: 50 requests per 15 minutes

    Limitations:
    - No ads API access
    - Limited historical data
    - No real-time streaming

  # AI uses these limits intelligently
  limits:
    posts_per_month: 1500
    reads_per_month: 10000
    requests_per_15min: 50
```

### X API Endpoints Used

#### Posting
| Operation | Endpoint | Method |
|-----------|----------|--------|
| Create tweet | `/2/tweets` | POST |
| Delete tweet | `/2/tweets/:id` | DELETE |
| Create thread | Multiple `/2/tweets` | POST |

#### Reading
| Operation | Endpoint | Method |
|-----------|----------|--------|
| Get user timeline | `/2/users/:id/tweets` | GET |
| Get mentions | `/2/users/:id/mentions` | GET |
| Get tweet details | `/2/tweets/:id` | GET |
| Search tweets | `/2/tweets/search/recent` | GET |

#### Engagement
| Operation | Endpoint | Method |
|-----------|----------|--------|
| Like tweet | `/2/users/:id/likes` | POST |
| Unlike tweet | `/2/users/:id/likes/:tweet_id` | DELETE |
| Retweet | `/2/users/:id/retweets` | POST |
| Follow user | `/2/users/:id/following` | POST |

#### Media
| Operation | Endpoint | Method |
|-----------|----------|--------|
| Upload media | `/1.1/media/upload.json` | POST |
| Check status | `/1.1/media/upload.json` | GET |

### X API Client Architecture
```typescript
// src/api/x/client.ts
class XClient {
  // Core methods
  async post(content: string, options?: PostOptions): Promise<Tweet>
  async postThread(tweets: string[]): Promise<Thread>
  async reply(tweetId: string, content: string): Promise<Tweet>

  // Reading
  async getTimeline(userId: string, options?: TimelineOptions): Promise<Tweet[]>
  async getMentions(userId: string): Promise<Tweet[]>
  async searchTweets(query: string): Promise<Tweet[]>

  // Engagement
  async like(tweetId: string): Promise<void>
  async retweet(tweetId: string): Promise<void>
  async follow(userId: string): Promise<void>

  // Media
  async uploadMedia(file: Buffer, type: MediaType): Promise<MediaId>
}
```

### Sandbox Account Support
For testing without posting to real account:
```bash
# Separate credentials for sandbox
X_SANDBOX_API_KEY=sandbox_key
X_SANDBOX_ACCESS_TOKEN=sandbox_token
```

```bash
# Run in sandbox mode
social-agent --sandbox
```

## 2. OpenRouter API

### Purpose
Model-agnostic LLM access for all AI features

### Base Configuration
```yaml
openrouter:
  base_url: "https://openrouter.ai/api/v1"
  site_url: "https://your-domain.com"  # For rankings
  app_name: "social-agent"
```

### Authentication
```bash
OPENROUTER_API_KEY=sk-or-v1-xxx
```

### Endpoints Used
| Operation | Endpoint | Method |
|-----------|----------|--------|
| Chat completion | `/chat/completions` | POST |
| List models | `/models` | GET |
| Check limits | `/auth/key` | GET |

### OpenRouter Client Architecture
```typescript
// src/ai/openrouter/client.ts
class OpenRouterClient {
  async complete(options: CompletionOptions): Promise<CompletionResponse>
  async listModels(): Promise<Model[]>
  async checkLimits(): Promise<LimitInfo>
}

interface CompletionOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}
```

### Model Usage by Feature
```typescript
const modelConfig = {
  content_generation: {
    model: "anthropic/claude-3.5-sonnet",
    purpose: "High-quality content creation"
  },
  quick_replies: {
    model: "anthropic/claude-3-haiku",
    purpose: "Fast, cost-effective replies"
  },
  analysis: {
    model: "anthropic/claude-3-haiku",
    purpose: "Analytics and pattern detection"
  },
  image_generation: {
    model: "openai/dall-e-3",
    purpose: "AI image generation"
  },
  moderation: {
    model: "anthropic/claude-3-haiku",
    purpose: "Safety checks"
  }
};
```

### Image Generation via OpenRouter
```typescript
// For models that support image generation
async function generateImage(prompt: string): Promise<ImageUrl> {
  const response = await openrouter.complete({
    model: config.models.image_generation.model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt }
      ]
    }],
    // Image-specific parameters
  });
  return response.image_url;
}
```

## 3. RSS Feed Integration

### Purpose
Import content ideas from RSS feeds for inspiration

### Configuration
```yaml
rss_feeds:
  enabled: true
  feeds:
    - url: "https://example.com/feed.xml"
      name: "Tech News"
      check_interval: "1h"
    - url: "https://another.com/rss"
      name: "AI Research"
      check_interval: "6h"
```

### RSS Client
```typescript
// src/core/content/rss.ts
class RSSClient {
  async fetchFeed(url: string): Promise<FeedItem[]>
  async checkAllFeeds(): Promise<ContentIdea[]>
}

interface FeedItem {
  title: string;
  description: string;
  link: string;
  published: Date;
}

interface ContentIdea {
  source: string;
  title: string;
  summary: string;
  link: string;
  relevance_score: number;
}
```

## 4. Error Handling for APIs

### Retry Strategy
Simple exponential backoff:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await sleep(delay);
    }
  }
}
```

### API Error Types
```typescript
class XAPIError extends Error {
  code: number;
  endpoint: string;
  resetTime?: Date;
}

class OpenRouterError extends Error {
  code: string;
  model: string;
}
```

### Rate Limit Handling
```typescript
// Track rate limits
interface RateLimitState {
  remaining: number;
  reset: Date;
  limit: number;
}

// Check before operations
function canMakeRequest(state: RateLimitState): boolean {
  if (state.remaining > 0) return true;
  if (new Date() > state.reset) return true;
  return false;
}
```

## 5. Network Resilience

### Connection Check
```typescript
async function checkConnectivity(): Promise<NetworkStatus> {
  const checks = await Promise.allSettled([
    pingX(),
    pingOpenRouter()
  ]);

  return {
    x: checks[0].status === 'fulfilled',
    openrouter: checks[1].status === 'fulfilled',
    overall: checks.every(c => c.status === 'fulfilled')
  };
}
```

### Graceful Degradation
- Queue failed operations for retry
- Status indicator in TUI
- Continue with available services
- Log connectivity issues

## 6. API Response Caching

### Cache Strategy
```typescript
// Cache read-only API responses
const cache = new Map<string, CacheEntry>();

interface CacheEntry {
  data: any;
  expires: Date;
}

async function cachedRequest<T>(
  key: string,
  request: () => Promise<T>,
  ttl: number = 60000
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > new Date()) {
    return cached.data;
  }

  const data = await request();
  cache.set(key, {
    data,
    expires: new Date(Date.now() + ttl)
  });
  return data;
}
```

## 7. Future Extensibility

### Integration Interface
```typescript
// Abstract interface for future platforms
interface SocialPlatformClient {
  post(content: Content): Promise<PostResult>
  getTimeline(): Promise<Post[]>
  engage(action: EngagementAction): Promise<void>
}

// X implementation
class XPlatformClient implements SocialPlatformClient { }

// Future: LinkedIn, etc.
class LinkedInClient implements SocialPlatformClient { }
```

### Plugin Architecture Consideration
Design allows adding new integrations via:
- New client implementations
- Configuration additions
- Feature flags for platform-specific features
