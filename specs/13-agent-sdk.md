# Vercel AI SDK Integration

## 1. Framework Choice

### Vercel AI SDK
- **Package**: `ai` (core) + `@ai-sdk/openai` (provider)
- **Why Vercel AI SDK**:
  - TypeScript-native with excellent type inference
  - Built-in tool calling with Zod schema validation
  - Streaming support out of the box
  - Works seamlessly with OpenRouter
  - Lightweight and minimal dependencies
  - Active maintenance and community

## 2. OpenRouter as Provider

### Setup with AI SDK
```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Create OpenRouter provider using OpenAI-compatible interface
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': 'https://social-agent.app',
    'X-Title': 'social-agent'
  }
});

// Get model instance
const model = openrouter('anthropic/claude-3.5-sonnet');
```

### Model Selection Utility
```typescript
function getModel(task: 'content' | 'reply' | 'analysis' | 'fast') {
  const models = {
    content: 'anthropic/claude-3.5-sonnet',
    reply: 'anthropic/claude-3-haiku',
    analysis: 'anthropic/claude-3-haiku',
    fast: 'anthropic/claude-3-haiku'
  };
  return openrouter(models[task]);
}
```

## 3. Tool Definitions

### Tool Structure with Zod
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const postTweetTool = tool({
  description: 'Post a new tweet to X',
  parameters: z.object({
    content: z.string().max(280).describe('The tweet content'),
    replyTo: z.string().optional().describe('Tweet ID to reply to'),
    mediaIds: z.array(z.string()).optional().describe('Media IDs to attach')
  }),
  execute: async ({ content, replyTo, mediaIds }) => {
    const result = await xClient.post(content, { replyTo, mediaIds });
    return { success: true, tweetId: result.id, url: result.url };
  }
});
```

### Tool Categories

#### X Operations Tools
```typescript
const xTools = {
  postTweet: tool({ /* post single tweet */ }),
  postThread: tool({ /* post multi-tweet thread */ }),
  replyToTweet: tool({ /* reply to a tweet */ }),
  quoteTweet: tool({ /* quote tweet with commentary */ }),
  deleteTweet: tool({ /* delete a tweet */ }),
  searchTweets: tool({ /* search for tweets */ }),
  getTrends: tool({ /* get trending topics */ })
};
```

#### Engagement Tools
```typescript
const engagementTools = {
  likeTweet: tool({ /* like a tweet */ }),
  unlikeTweet: tool({ /* unlike a tweet */ }),
  retweet: tool({ /* retweet */ }),
  followUser: tool({ /* follow a user */ }),
  unfollowUser: tool({ /* unfollow a user */ }),
  getMentions: tool({ /* get mentions */ }),
  getTimeline: tool({ /* get user timeline */ }),
  analyzeAccount: tool({ /* analyze an account */ }),
  suggestFollows: tool({ /* suggest accounts to follow */ })
};
```

#### Content Management Tools
```typescript
const contentTools = {
  addToQueue: tool({ /* add content to posting queue */ }),
  getQueueStatus: tool({ /* get current queue status */ }),
  saveDraft: tool({ /* save content as draft */ }),
  generateImage: tool({ /* generate image for post */ }),
  checkContentSafety: tool({ /* run moderation checks */ }),
  getAnalytics: tool({ /* get performance analytics */ }),
  getAudienceInsights: tool({ /* get audience analysis */ })
};
```

## 4. Agent Execution

### Basic Generation
```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: getModel('content'),
  system: systemPrompt,
  prompt: userRequest,
  tools: { ...xTools, ...contentTools },
  maxSteps: 10, // Allow up to 10 tool calls
});
```

### Streaming with Tool Calls
```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: getModel('content'),
  system: systemPrompt,
  prompt: userRequest,
  tools: allTools,
  maxSteps: 10,
  onStepFinish: ({ stepType, toolCalls, toolResults }) => {
    // Log each step for transparency
    logger.logStep(stepType, toolCalls, toolResults);
  }
});

// Stream text to TUI
for await (const chunk of result.textStream) {
  updateTUI(chunk);
}
```

### Agent Executor Class
```typescript
class AgentExecutor {
  private model: LanguageModel;
  private tools: Record<string, Tool>;
  private memory: AgentMemory;
  private reasoningLog: ReasoningLogger;

  async execute(task: string, options?: ExecuteOptions): Promise<AgentResult> {
    const systemPrompt = this.buildSystemPrompt();

    const result = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: task,
      tools: this.tools,
      maxSteps: options?.maxSteps ?? 10,
      onStepFinish: (step) => {
        this.reasoningLog.logStep(step);
        this.memory.addToHistory(step);
      }
    });

    return {
      response: result.text,
      toolCalls: result.toolCalls,
      steps: result.steps,
      usage: result.usage
    };
  }
}
```

## 5. Memory System

### Memory Types
```typescript
interface AgentMemory {
  // Short-term: Current conversation
  conversation: Message[];

  // Working memory: Current task context
  currentTask: TaskContext | null;

  // Long-term: Persisted knowledge
  learnings: Learning[];

  // Episodic: Past successful interactions
  episodes: Episode[];
}
```

### Memory Implementation
```typescript
class AgentMemory {
  private shortTerm: Message[] = [];
  private longTerm: StoredMemory;

  async addToHistory(message: Message) {
    this.shortTerm.push(message);

    // Summarize if too long
    if (this.shortTerm.length > 20) {
      await this.summarizeAndArchive();
    }
  }

  async getRelevantContext(query: string): Promise<string> {
    // Retrieve relevant long-term memories
    const relevant = await this.searchLongTerm(query);
    return this.formatForPrompt(relevant);
  }

  async persist() {
    await storage.write('memory.json', {
      longTerm: this.longTerm,
      lastConversation: this.shortTerm.slice(-10)
    });
  }
}
```

## 6. System Prompts

### Base System Prompt
```typescript
function buildSystemPrompt(config: Config, context: Context): string {
  return `
You are a social media management agent for X (Twitter).

## Your Identity
Name: ${config.persona.identity.name}
Role: ${config.persona.identity.role}
Niche: ${config.persona.niche.primary}

## Your Voice
Tone: ${config.persona.voice.tone}
Style: ${config.persona.voice.style}

## Rules
Do: ${config.persona.rules.do.join(', ')}
Don't: ${config.persona.rules.dont.join(', ')}

## Current Context
Time: ${context.currentTime}
Day: ${context.dayOfWeek}
Recent posts: ${context.recentPosts.length}
Queue status: ${context.queueStatus}

## Available Tools
You have access to tools for posting, engaging, and managing content.
Always explain your reasoning before taking actions.
`.trim();
}
```

### Task-Specific Prompts
```typescript
const taskPrompts = {
  contentGeneration: `
Generate engaging content for X based on the given topic or trend.
Consider the optimal length, format (single vs thread), and timing.
Run content through safety checks before queuing.
`,

  engagement: `
Process mentions and opportunities for engagement.
Generate replies that match the user's voice.
Prioritize high-value interactions.
`,

  networkBuilding: `
Identify accounts to follow and engage with.
Look for community leaders and relevant voices.
Build genuine connections, not just follower counts.
`
};
```

## 7. Multi-Step Reasoning

### Step-by-Step Execution
```typescript
const result = await generateText({
  model,
  system: systemPrompt,
  prompt: "Create a thread about AI productivity tips",
  tools: allTools,
  maxSteps: 10,
  onStepFinish: async ({ stepType, toolCalls, toolResults, text }) => {
    console.log(`Step: ${stepType}`);

    if (toolCalls) {
      for (const call of toolCalls) {
        console.log(`  Tool: ${call.toolName}`);
        console.log(`  Args: ${JSON.stringify(call.args)}`);
      }
    }

    if (toolResults) {
      for (const result of toolResults) {
        console.log(`  Result: ${JSON.stringify(result.result)}`);
      }
    }

    if (text) {
      console.log(`  Reasoning: ${text}`);
    }
  }
});
```

### Reasoning Chain Storage
```typescript
interface ReasoningStep {
  timestamp: Date;
  stepNumber: number;
  type: 'text' | 'tool_call' | 'tool_result';
  content: string | ToolCall | ToolResult;
  reasoning?: string;
}

class ReasoningLogger {
  private steps: ReasoningStep[] = [];

  logStep(step: StepResult) {
    this.steps.push({
      timestamp: new Date(),
      stepNumber: this.steps.length + 1,
      type: step.stepType,
      content: step.toolCalls || step.text,
      reasoning: step.text
    });
  }

  getFullChain(): string {
    return this.steps.map(s =>
      `[${s.stepNumber}] ${s.type}: ${JSON.stringify(s.content)}`
    ).join('\n');
  }
}
```

## 8. State Management

### Agent State
```typescript
interface AgentState {
  // Current execution
  currentTask: string | null;
  currentStep: number;
  isRunning: boolean;

  // Progress
  toolCallsExecuted: number;
  tokensUsed: number;

  // Results
  lastResult: AgentResult | null;
  errors: Error[];
}

class AgentStateManager {
  private state: AgentState;

  startTask(task: string) {
    this.state = {
      currentTask: task,
      currentStep: 0,
      isRunning: true,
      toolCallsExecuted: 0,
      tokensUsed: 0,
      lastResult: null,
      errors: []
    };
  }

  updateProgress(step: number, usage: TokenUsage) {
    this.state.currentStep = step;
    this.state.tokensUsed += usage.totalTokens;
  }

  async persist() {
    await storage.write('agent-state.json', this.state);
  }

  async recover(): Promise<AgentState | null> {
    return storage.read('agent-state.json');
  }
}
```

## 9. Streaming in TUI

### Streaming Component
```typescript
// TUI component for streaming responses
const StreamingResponse = ({ stream }: { stream: AsyncIterable<string> }) => {
  const [text, setText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    (async () => {
      for await (const chunk of stream) {
        setText(prev => prev + chunk);
      }
      setIsComplete(true);
    })();
  }, [stream]);

  return (
    <Box>
      <Text>{text}</Text>
      {!isComplete && <Spinner />}
    </Box>
  );
};
```

### Tool Call Display
```typescript
const ToolCallDisplay = ({ toolCall }: { toolCall: ToolCall }) => (
  <Box borderStyle="round" borderColor="blue">
    <Text color="blue">🔧 {toolCall.toolName}</Text>
    <Text dimColor>{JSON.stringify(toolCall.args, null, 2)}</Text>
  </Box>
);
```

## 10. Error Handling

### AI SDK Error Types
```typescript
import { APICallError, InvalidResponseError } from 'ai';

async function executeWithErrorHandling(task: string) {
  try {
    return await agentExecutor.execute(task);
  } catch (error) {
    if (error instanceof APICallError) {
      // API call failed (network, auth, rate limit)
      logger.error('API call failed', {
        message: error.message,
        statusCode: error.statusCode
      });
    } else if (error instanceof InvalidResponseError) {
      // Model returned invalid response
      logger.error('Invalid model response', {
        message: error.message
      });
    }
    throw error;
  }
}
```

## 11. Integration with Existing Components

### Architecture Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     User Request (TUI/CLI)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent Executor                          │
│  - Vercel AI SDK generateText/streamText                    │
│  - System prompt with persona                               │
│  - Tool definitions                                         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │ X Tools   │   │ Content   │   │ Engage    │
        │           │   │ Tools     │   │ Tools     │
        └───────────┘   └───────────┘   └───────────┘
              │               │               │
              ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │ X API     │   │ Content   │   │ Engagement│
        │ Client    │   │ Engine    │   │ Engine    │
        └───────────┘   └───────────┘   └───────────┘
```

### Tool-to-Service Wiring
```typescript
// Wire tools to existing services
const tools = {
  postTweet: tool({
    description: 'Post a tweet',
    parameters: postTweetSchema,
    execute: async (args) => xClient.post(args.content, args.options)
  }),

  addToQueue: tool({
    description: 'Add content to posting queue',
    parameters: addToQueueSchema,
    execute: async (args) => queueManager.addToQueue(args)
  }),

  checkSafety: tool({
    description: 'Check content safety',
    parameters: checkSafetySchema,
    execute: async (args) => moderationPipeline.check(args.content)
  })
};
```
