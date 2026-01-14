# Error Handling & Resilience

## 1. Error Philosophy

### Fail, Log, and Exit
For critical errors, the agent:
1. Logs the error with full context
2. Saves any pending work to queue
3. Exits cleanly with informative message

### Non-Critical Graceful Handling
For recoverable errors:
1. Log the issue
2. Attempt retry (if applicable)
3. Continue with degraded functionality

## 2. Error Categories

### Critical Errors (Exit)
- API authentication failures
- Configuration file corruption
- Missing required environment variables
- Unrecoverable network failures

### Recoverable Errors (Retry)
- Temporary API unavailability
- Rate limit exceeded
- Network timeout
- Transient API errors

### Operational Errors (Log & Continue)
- Single post failure (queue for retry)
- Media upload failure
- Individual engagement action failure

## 3. Retry Strategy

### Simple Exponential Backoff
```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 2000,  // 2 seconds
  maxDelay: 8000,      // 8 seconds
  factor: 2            // Double each time
};

async function withRetry<T>(
  operation: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxAttempts) break;
      if (!isRetryable(error)) break;

      const delay = Math.min(
        config.initialDelay * Math.pow(config.factor, attempt - 1),
        config.maxDelay
      );

      log.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Retryable Errors
```typescript
function isRetryable(error: Error): boolean {
  // Network errors
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'ETIMEDOUT') return true;

  // API rate limits
  if (error instanceof XAPIError && error.code === 429) return true;

  // Temporary service errors
  if (error instanceof XAPIError && error.code >= 500) return true;

  return false;
}
```

## 4. Error Messages

### Dual Mode System

#### User-Friendly Mode (Default)
Clear, actionable messages for end users:
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Couldn't post to X                                     │
├─────────────────────────────────────────────────────────────┤
│  The X API seems temporarily unavailable.                   │
│                                                             │
│  What happened:                                             │
│  • Your post has been saved to the queue                   │
│  • It will be posted when service is restored              │
│                                                             │
│  What you can do:                                          │
│  • Wait a few minutes and try again                        │
│  • Check X's status page for outages                       │
│  • Run 'social-agent queue' to see pending posts           │
└─────────────────────────────────────────────────────────────┘
```

#### Verbose Mode (--verbose flag)
Technical details for debugging:
```
┌─────────────────────────────────────────────────────────────┐
│  Error: XAPIError                                           │
├─────────────────────────────────────────────────────────────┤
│  Message: Service Unavailable                               │
│  Code: 503                                                  │
│  Endpoint: POST /2/tweets                                   │
│  Timestamp: 2024-01-15T10:30:00.123Z                       │
│                                                             │
│  Request:                                                   │
│  { "text": "AI productivity tip..." }                      │
│                                                             │
│  Response:                                                  │
│  { "errors": [{ "message": "Service Unavailable" }] }      │
│                                                             │
│  Stack:                                                     │
│  at XClient.post (src/api/x/client.ts:145:11)              │
│  at ContentEngine.publish (src/core/content/engine.ts:89)  │
│  at QueueProcessor.process (src/core/scheduler/queue.ts:56)│
│                                                             │
│  Retry attempts: 3/3                                       │
│  Next retry available: 2024-01-15T10:35:00Z                │
└─────────────────────────────────────────────────────────────┘
```

## 5. Logging System

### Configurable Log Levels
```yaml
# In main.yaml
settings:
  log_level: "info"  # error, warn, info, debug, trace
```

### Log Level Details
| Level | Description | Use Case |
|-------|-------------|----------|
| `error` | Critical failures only | Production, minimal output |
| `warn` | Warnings + errors | Normal operation |
| `info` | Operations + warnings + errors | Default |
| `debug` | Detailed + API calls | Troubleshooting |
| `trace` | Everything + AI reasoning | Deep debugging |

### Log Format
```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: object;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Example log entry
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "error",
  "component": "XClient",
  "message": "Failed to post tweet",
  "data": {
    "endpoint": "/2/tweets",
    "attempt": 3
  },
  "error": {
    "name": "XAPIError",
    "message": "Service Unavailable",
    "stack": "..."
  }
}
```

### Log Files
```
~/.social-agent/logs/
├── social-agent.log       # Main application log
└── ai-reasoning.log       # AI decision reasoning (trace level)
```

## 6. Network Connectivity Handling

### Graceful Network Handling
```typescript
interface NetworkState {
  connected: boolean;
  lastCheck: Date;
  services: {
    x: boolean;
    openrouter: boolean;
  };
}

class NetworkMonitor {
  async checkConnectivity(): Promise<NetworkState> {
    const [x, openrouter] = await Promise.allSettled([
      this.pingX(),
      this.pingOpenRouter()
    ]);

    return {
      connected: x.status === 'fulfilled' || openrouter.status === 'fulfilled',
      lastCheck: new Date(),
      services: {
        x: x.status === 'fulfilled',
        openrouter: openrouter.status === 'fulfilled'
      }
    };
  }
}
```

### Network Status Display
```
┌─────────────────────────────────────────────────────────────┐
│  Network Status                                             │
├─────────────────────────────────────────────────────────────┤
│  X API:        🟡 Degraded (rate limited, resets in 5min)  │
│  OpenRouter:   🟢 Connected                                 │
│  Overall:      🟡 Partial connectivity                      │
│                                                             │
│  Queued operations: 3 (will retry when available)          │
└─────────────────────────────────────────────────────────────┘
```

### Offline Behavior
When network unavailable:
1. Queue all write operations
2. Show clear status indicator
3. Process queue when connectivity restored
4. Log all queued operations

## 7. Data Recovery

### Corrupted File Handling
```typescript
async function loadWithRecovery<T>(
  path: string,
  defaultValue: T
): Promise<T> {
  try {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, use default
      return defaultValue;
    }

    // File corrupted, try backup
    log.warn(`Corrupted file: ${path}, attempting recovery...`);
    return await recoverFromBackup(path, defaultValue);
  }
}
```

### Backup Recovery
```typescript
async function recoverFromBackup<T>(
  path: string,
  defaultValue: T
): Promise<T> {
  const backups = await listBackups();

  for (const backup of backups.reverse()) {
    try {
      const backupPath = join(backup.path, path);
      const data = await fs.readFile(backupPath, 'utf-8');
      log.info(`Recovered from backup: ${backup.date}`);
      return JSON.parse(data);
    } catch {
      continue;
    }
  }

  log.error(`No valid backup found for ${path}, using defaults`);
  return defaultValue;
}
```

## 8. Graceful Shutdown

### Clean Exit Process
```typescript
async function gracefulShutdown(signal: string) {
  log.info(`Received ${signal}, shutting down gracefully...`);

  // 1. Stop accepting new operations
  scheduler.pause();

  // 2. Wait for in-progress operations (max 10s)
  await Promise.race([
    waitForPendingOperations(),
    sleep(10000)
  ]);

  // 3. Save state
  await saveState();

  // 4. Close connections
  await closeConnections();

  log.info('Shutdown complete');
  process.exit(0);
}

// Register handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```

## 9. Error Reporting

### Error Context Collection
```typescript
interface ErrorContext {
  timestamp: Date;
  operation: string;
  component: string;
  input?: object;
  state?: object;
  environment: {
    nodeVersion: string;
    platform: string;
    agentVersion: string;
  };
}

function collectErrorContext(error: Error, operation: string): ErrorContext {
  return {
    timestamp: new Date(),
    operation,
    component: error.constructor.name,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      agentVersion: packageJson.version
    }
  };
}
```

## 10. TUI Error Display

### Error Notification Component
```typescript
// Ink component for errors
const ErrorNotification = ({ error, verbose }) => (
  <Box borderStyle="single" borderColor="red">
    <Text color="red">⚠️ {error.userMessage}</Text>
    {verbose && (
      <Box marginTop={1}>
        <Text dimColor>{error.technicalDetails}</Text>
      </Box>
    )}
    <Box marginTop={1}>
      <Text>[r]etry [d]ismiss {!verbose && '[v]erbose'}</Text>
    </Box>
  </Box>
);
```
