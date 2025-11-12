# Real-Time Notification System Design

## Architecture Overview

This document outlines the design for a scalable, real-time notification system that delivers messages to connected clients with high reliability and low latency. The system is built around five core components that work together to manage connections, route messages, and handle failures gracefully.

### Core Components

#### 1. WebSocket Manager
The WebSocket Manager is responsible for the lifecycle of WebSocket connections between clients and the server. It handles:
- Establishing new WebSocket connections with authentication
- Maintaining active connection state
- Detecting connection failures through heartbeat monitoring
- Gracefully closing connections
- Managing connection-level configuration (timeouts, buffer sizes)

#### 2. Message Queue
The Message Queue provides reliable message delivery by buffering messages during temporary disconnections. It:
- Queues outgoing messages when a client is disconnected
- Persists messages to prevent loss during server restarts
- Implements message ordering guarantees (FIFO per topic)
- Handles message expiration for time-sensitive notifications
- Provides backpressure mechanisms to prevent memory exhaustion

#### 3. Subscription Manager
The Subscription Manager tracks which clients are interested in which notification topics. It:
- Maintains a mapping of topics to subscribed clients
- Handles subscription requests from clients
- Manages unsubscription and cleanup
- Supports wildcard topic patterns (e.g., "user.123.*")
- Tracks subscription metadata (subscription time, filters)

#### 4. State Manager
The State Manager maintains the overall system state and coordinates between components. It:
- Tracks connection states (disconnected, connecting, connected, reconnecting)
- Stores subscription state for recovery after reconnection
- Manages client session information
- Provides state synchronization across distributed servers
- Handles state persistence for durability

#### 5. Retry Controller
The Retry Controller implements intelligent reconnection logic to handle transient failures. It:
- Manages exponential backoff for reconnection attempts
- Tracks retry attempts and failure reasons
- Implements circuit breaker patterns to prevent cascading failures
- Provides configurable retry policies per connection type
- Monitors retry metrics for system health

### Component Interaction Flow

```
Client                WebSocket Manager    Subscription Manager    Message Queue    State Manager
  |                          |                      |                    |                |
  |---connect()------------->|                      |                    |                |
  |                          |---authenticate------>|                    |                |
  |                          |                      |---update state---->|                |
  |<--connected--------------|                      |                    |                |
  |                          |                      |                    |                |
  |---subscribe(topic)------>|                      |                    |                |
  |                          |---add subscription-->|                    |                |
  |                          |                      |---persist--------->|                |
  |<--subscribed-------------|                      |                    |                |
  |                          |                      |                    |                |
  |                          |<--message(topic)-----|                    |                |
  |<--notification-----------|                      |                    |                |
  |                          |                      |                    |                |
  |  [connection lost]       |                      |                    |                |
  |                          |---detect failure---->|                    |                |
  |                          |                      |---buffer msgs----->|                |
  |                          |                      |                    |                |
  |---reconnect()----------->|                      |                    |                |
  |                          |---restore state----->|                    |                |
  |                          |                      |---replay msgs----->|                |
  |<--buffered messages------|                      |                    |                |
```

## TypeScript Interfaces

### NotificationClient Interface

```typescript
/**
 * Main client interface for interacting with the notification system
 */
interface NotificationClient {
  /**
   * Establishes a connection to the notification server
   * @throws {ConnectionError} if connection fails after all retries
   */
  connect(): Promise<void>;

  /**
   * Gracefully closes the connection
   */
  disconnect(): Promise<void>;

  /**
   * Subscribes to a notification topic
   * @param topic - The topic name or pattern to subscribe to
   * @param handler - Callback function to handle incoming messages
   * @param options - Optional subscription configuration
   * @returns Subscription object for managing the subscription
   */
  subscribe<T = unknown>(
    topic: string,
    handler: MessageHandler<T>,
    options?: SubscriptionOptions
  ): Subscription;

  /**
   * Unsubscribes from a topic
   * @param subscriptionId - The unique identifier of the subscription
   */
  unsubscribe(subscriptionId: string): void;

  /**
   * Gets the current connection state
   */
  getConnectionState(): ConnectionState;

  /**
   * Registers a listener for connection state changes
   */
  onStateChange(listener: (state: ConnectionState) => void): void;

  /**
   * Gets statistics about the connection
   */
  getStats(): ConnectionStats;
}
```

### MessageHandler Interface

```typescript
/**
 * Callback function type for handling incoming notifications
 */
interface MessageHandler<T = unknown> {
  (message: NotificationMessage<T>): void | Promise<void>;
}

/**
 * Error handler for message processing failures
 */
interface MessageErrorHandler {
  (error: Error, message: NotificationMessage): void;
}
```

### NotificationMessage Interface

```typescript
/**
 * Structure of a notification message
 */
interface NotificationMessage<T = unknown> {
  /**
   * Unique identifier for the message
   */
  id: string;

  /**
   * The topic this message was published to
   */
  topic: string;

  /**
   * The message payload
   */
  payload: T;

  /**
   * When the message was created
   */
  timestamp: Date;

  /**
   * Optional metadata about the message
   */
  metadata?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    expiresAt?: Date;
    correlationId?: string;
    source?: string;
  };
}
```

### ConnectionState Type

```typescript
/**
 * Discriminated union representing all possible connection states
 */
type ConnectionState =
  | {
      status: 'disconnected';
      reason?: DisconnectReason;
      lastConnectedAt?: Date;
    }
  | {
      status: 'connecting';
      attempt: number;
      startedAt: Date;
    }
  | {
      status: 'connected';
      connectedAt: Date;
      serverId: string;
      latency: number;
    }
  | {
      status: 'reconnecting';
      attempt: number;
      lastError: Error;
      nextRetryAt: Date;
      backoffDelay: number;
    };

type DisconnectReason =
  | 'client_initiated'
  | 'server_initiated'
  | 'network_error'
  | 'authentication_failed'
  | 'timeout'
  | 'protocol_error';
```

### Supporting Interfaces

```typescript
/**
 * Subscription configuration options
 */
interface SubscriptionOptions {
  /**
   * Filter function to selectively receive messages
   */
  filter?: (message: NotificationMessage) => boolean;

  /**
   * Error handler for this subscription
   */
  onError?: MessageErrorHandler;

  /**
   * Whether to receive messages that were queued during disconnection
   */
  replayMissed?: boolean;

  /**
   * Maximum age of messages to replay (in milliseconds)
   */
  maxReplayAge?: number;
}

/**
 * Subscription handle for managing an active subscription
 */
interface Subscription {
  /**
   * Unique identifier for this subscription
   */
  readonly id: string;

  /**
   * The topic being subscribed to
   */
  readonly topic: string;

  /**
   * When the subscription was created
   */
  readonly createdAt: Date;

  /**
   * Unsubscribe from the topic
   */
  unsubscribe(): void;

  /**
   * Check if the subscription is still active
   */
  isActive(): boolean;
}

/**
 * Connection statistics
 */
interface ConnectionStats {
  messagesReceived: number;
  messagesSent: number;
  reconnectCount: number;
  averageLatency: number;
  uptime: number;
  lastHeartbeat: Date;
}

/**
 * Configuration for the notification client
 */
interface NotificationClientConfig {
  /**
   * WebSocket server URL
   */
  url: string;

  /**
   * Authentication token or credentials
   */
  auth: string | (() => Promise<string>);

  /**
   * Heartbeat interval in milliseconds
   */
  heartbeatInterval?: number;

  /**
   * Heartbeat timeout in milliseconds
   */
  heartbeatTimeout?: number;

  /**
   * Retry configuration
   */
  retryConfig?: RetryConfig;

  /**
   * Message queue configuration
   */
  queueConfig?: QueueConfig;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

interface RetryConfig {
  /**
   * Maximum number of retry attempts (0 = infinite)
   */
  maxRetries: number;

  /**
   * Initial delay before first retry (ms)
   */
  initialDelay: number;

  /**
   * Maximum delay between retries (ms)
   */
  maxDelay: number;

  /**
   * Multiplier for exponential backoff
   */
  backoffMultiplier: number;

  /**
   * Add random jitter to prevent thundering herd
   */
  jitter: boolean;
}

interface QueueConfig {
  /**
   * Maximum number of messages to buffer
   */
  maxSize: number;

  /**
   * Maximum age of buffered messages (ms)
   */
  maxAge: number;

  /**
   * Strategy when queue is full
   */
  overflowStrategy: 'drop-oldest' | 'drop-newest' | 'reject';
}
```

## Connection Management Strategy

### Initial Connection

1. **Connection Establishment**
   - Client initiates WebSocket connection to server URL
   - Client sends authentication message with token/credentials
   - Server validates authentication and responds with session info
   - Connection state transitions to 'connected'
   - Client retrieves and restores any previous subscriptions from State Manager

2. **Authentication Flow**
   ```typescript
   // Client sends
   {
     type: 'auth',
     token: 'jwt-token-here',
     clientId: 'unique-client-id'
   }
   
   // Server responds
   {
     type: 'auth_success',
     sessionId: 'session-123',
     serverId: 'server-01',
     capabilities: ['wildcard-topics', 'message-replay']
   }
   ```

### Heartbeat Mechanism

The heartbeat mechanism ensures connection health and detects failures quickly:

1. **Ping-Pong Protocol**
   - Client sends PING frame every 30 seconds (configurable)
   - Server must respond with PONG within 5 seconds
   - If PONG not received, connection is considered dead
   - Triggers reconnection logic

2. **Implementation**
   ```typescript
   class HeartbeatMonitor {
     private pingInterval: NodeJS.Timer;
     private pongTimeout: NodeJS.Timer;
     
     start() {
       this.pingInterval = setInterval(() => {
         this.sendPing();
         this.pongTimeout = setTimeout(() => {
           this.onHeartbeatFailure();
         }, 5000);
       }, 30000);
     }
     
     onPongReceived() {
       clearTimeout(this.pongTimeout);
     }
     
     onHeartbeatFailure() {
       // Trigger reconnection
       this.retryController.initiateReconnect('heartbeat_timeout');
     }
   }
   ```

### Reconnection Strategy

When a connection is lost, the Retry Controller implements an exponential backoff strategy:

1. **Backoff Calculation**
   ```typescript
   function calculateBackoff(attempt: number, config: RetryConfig): number {
     const baseDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
     const cappedDelay = Math.min(baseDelay, config.maxDelay);
     
     // Add jitter to prevent thundering herd
     if (config.jitter) {
       const jitterAmount = cappedDelay * 0.3; // 30% jitter
       return cappedDelay + (Math.random() * jitterAmount * 2 - jitterAmount);
     }
     
     return cappedDelay;
   }
   ```

2. **Reconnection Sequence**
   - Attempt 1: 1 second delay
   - Attempt 2: 2 seconds delay
   - Attempt 3: 4 seconds delay
   - Attempt 4: 8 seconds delay
   - Attempt 5+: 30 seconds delay (capped)

3. **Connection State During Reconnection**
   - State transitions to 'reconnecting'
   - Message Queue buffers outgoing messages
   - Subscription Manager maintains subscription list
   - After successful reconnection, subscriptions are restored

### Message Buffering

Messages are buffered during disconnection to ensure reliable delivery:

1. **Buffer Strategy**
   - Incoming messages from server: Cannot be received during disconnection, server must buffer
   - Outgoing messages from client: Buffered in local Message Queue
   - Maximum buffer size: 1000 messages (configurable)
   - Maximum message age: 5 minutes (configurable)

2. **Buffer Overflow Handling**
   - `drop-oldest`: Remove oldest messages when buffer is full
   - `drop-newest`: Reject new messages when buffer is full
   - `reject`: Throw error when buffer is full

3. **Message Replay on Reconnection**
   ```typescript
   async function onReconnected() {
     // 1. Restore subscriptions
     await this.subscriptionManager.restoreSubscriptions();
     
     // 2. Request missed messages from server
     const lastMessageId = this.stateManager.getLastReceivedMessageId();
     await this.sendReplayRequest(lastMessageId);
     
     // 3. Flush buffered outgoing messages
     await this.messageQueue.flush();
   }
   ```

## Subscription Recovery

After a reconnection, subscriptions must be restored to ensure continued message delivery:

### Recovery Process

1. **Subscription State Persistence**
   - State Manager persists all active subscriptions to local storage
   - Includes topic name, handler reference, and subscription options
   - Updated on every subscribe/unsubscribe operation

2. **Restoration Flow**
   ```typescript
   async function restoreSubscriptions() {
     const savedSubscriptions = await this.stateManager.getSubscriptions();
     
     for (const sub of savedSubscriptions) {
       try {
         // Re-subscribe to the topic
         await this.sendSubscribeMessage(sub.topic, sub.options);
         
         // Request replay of missed messages if enabled
         if (sub.options.replayMissed) {
           const since = sub.lastMessageTimestamp;
           await this.requestMessageReplay(sub.topic, since);
         }
       } catch (error) {
         // Log error but continue with other subscriptions
         this.handleSubscriptionRestoreError(sub, error);
       }
     }
   }
   ```

3. **Message Replay**
   - Client requests messages published since last received message
   - Server queries message history and sends missed messages
   - Messages are delivered in order with `replayed: true` flag
   - Client can choose to handle replayed messages differently

4. **Subscription Verification**
   - After restoration, client sends subscription list to server
   - Server confirms which subscriptions are active
   - Client removes any subscriptions that failed to restore

### Edge Cases

- **Subscription Changed During Disconnection**: Server-side subscription state is authoritative
- **Topic No Longer Exists**: Subscription fails gracefully, client is notified
- **Permission Changes**: Re-authentication may be required for certain topics

## Scalability Considerations

### Horizontal Scaling

To support millions of concurrent connections, the system must scale horizontally:

1. **Load Balancing**
   - Use Layer 7 load balancer (e.g., HAProxy, NGINX) with WebSocket support
   - Sticky sessions based on client ID to maintain connection affinity
   - Health checks to detect and remove unhealthy servers
   - Graceful connection draining during deployments

2. **Message Distribution with Redis Pub/Sub**
   ```typescript
   // Server A receives message for topic "user.123.notifications"
   class NotificationServer {
     async publishMessage(topic: string, message: NotificationMessage) {
       // Publish to Redis so all servers receive it
       await this.redis.publish(`topic:${topic}`, JSON.stringify(message));
     }
     
     async initialize() {
       // Subscribe to Redis channels
       await this.redis.subscribe('topic:*');
       
       this.redis.on('message', (channel, data) => {
         const message = JSON.parse(data);
         // Deliver to locally connected clients subscribed to this topic
         this.deliverToLocalClients(message);
       });
     }
   }
   ```

3. **Shared State with Redis**
   - Store subscription mappings in Redis: `topic:user.123 -> [server-01, server-02]`
   - Store client session data in Redis for cross-server access
   - Use Redis Cluster for high availability and partitioning

### Connection Pooling

Efficient connection management is critical for scalability:

1. **Server-Side Connection Limits**
   - Limit connections per server instance (e.g., 10,000 connections)
   - Use connection pooling for database and Redis connections
   - Implement backpressure when approaching limits

2. **Client-Side Connection Pooling**
   - Reuse WebSocket connections across multiple subscription contexts
   - Multiplex multiple logical channels over single WebSocket
   - Connection sharing for same-origin requests

### Message Batching

Batching reduces overhead and improves throughput:

1. **Outbound Batching**
   ```typescript
   class MessageBatcher {
     private batch: NotificationMessage[] = [];
     private batchTimeout: NodeJS.Timer;
     
     addMessage(message: NotificationMessage) {
       this.batch.push(message);
       
       // Send batch when size threshold reached
       if (this.batch.length >= 10) {
         this.flush();
       } else if (!this.batchTimeout) {
         // Or send after timeout (100ms)
         this.batchTimeout = setTimeout(() => this.flush(), 100);
       }
     }
     
     flush() {
       if (this.batch.length > 0) {
         this.sendBatch(this.batch);
         this.batch = [];
       }
       clearTimeout(this.batchTimeout);
       this.batchTimeout = null;
     }
   }
   ```

2. **Batching Strategy**
   - Batch size: 10-50 messages
   - Batch timeout: 100ms
   - Priority messages bypass batching
   - Configurable per topic or client

### Topic Partitioning

Distribute topics across servers for load distribution:

1. **Consistent Hashing**
   - Hash topic name to determine responsible server
   - Clients connect to server responsible for their topics
   - Rebalancing when servers are added/removed

2. **Topic Sharding**
   ```
   Topic: user.123.notifications
   Hash: hash("user.123") % num_servers = server_index
   Server: notification-server-03
   ```

3. **Wildcard Topic Handling**
   - Wildcard subscriptions (e.g., `user.*`) may span multiple servers
   - Use Redis pub/sub for cross-server wildcard delivery
   - Cache wildcard patterns for efficient matching

### Performance Metrics

Key metrics to monitor for scalability:

- **Connection Metrics**: Active connections, connection rate, disconnection rate
- **Message Metrics**: Messages/second, message latency, queue depth
- **Resource Metrics**: CPU usage, memory usage, network bandwidth
- **Error Metrics**: Failed connections, dropped messages, retry rate

## Trade-offs and Design Decisions

### WebSocket vs Server-Sent Events (SSE)

**Decision: WebSocket**

Advantages:
- Bidirectional communication (client can send messages to server)
- Lower overhead per message (no HTTP headers on each message)
- Better support for binary data
- More flexible protocol

Disadvantages:
- More complex to implement and debug
- Requires WebSocket-aware load balancers
- No automatic reconnection (must implement manually)
- Firewall/proxy compatibility issues in some networks

**When SSE Would Be Better:**
- Unidirectional communication (server to client only)
- Simpler infrastructure requirements
- Automatic reconnection built into browser
- Better compatibility with HTTP infrastructure

### Buffering vs Dropping Messages

**Decision: Buffer with Configurable Limits**

Advantages:
- Reliable message delivery during temporary disconnections
- Better user experience (no missed notifications)
- Supports offline-first applications

Disadvantages:
- Memory usage grows during extended disconnections
- Potential for stale messages after long disconnection
- Complexity in managing buffer lifecycle

**Configuration Options:**
```typescript
{
  queueConfig: {
    maxSize: 1000,           // Drop after 1000 messages
    maxAge: 300000,          // Drop after 5 minutes
    overflowStrategy: 'drop-oldest'  // Drop oldest when full
  }
}
```

**When Dropping Would Be Better:**
- Real-time data where old messages have no value (e.g., stock prices)
- Memory-constrained environments
- High-volume, low-importance notifications

### Reconnection Aggressiveness

**Decision: Exponential Backoff with Jitter**

Advantages:
- Prevents thundering herd problem
- Reduces server load during outages
- Gives server time to recover
- Configurable for different use cases

Disadvantages:
- Longer delays before reconnection
- Potential for extended notification delays
- User may perceive system as slow

**Backoff Configuration:**
```typescript
{
  retryConfig: {
    maxRetries: 10,
    initialDelay: 1000,      // 1 second
    maxDelay: 30000,         // 30 seconds
    backoffMultiplier: 2,    // Double each time
    jitter: true             // Add randomness
  }
}
```

**Alternative Strategies:**
- **Aggressive**: Fixed 1-second retry for real-time gaming
- **Conservative**: Linear backoff for non-critical notifications
- **Adaptive**: Adjust based on server health signals

### Message Ordering Guarantees

**Decision: Per-Topic FIFO Ordering**

Advantages:
- Predictable message order within a topic
- Simpler application logic
- Easier to reason about state changes

Disadvantages:
- Head-of-line blocking if one message fails
- Reduced throughput for high-volume topics
- Complexity in distributed scenarios

**Trade-off:**
- Strict ordering within a topic
- No ordering guarantees across topics
- Option to disable ordering for high-throughput scenarios

### Authentication Strategy

**Decision: Token-Based Authentication with Refresh**

Advantages:
- Stateless authentication
- Easy to implement and scale
- Supports token refresh without reconnection

Disadvantages:
- Token theft risk
- Requires secure token storage
- Token expiration handling complexity

**Implementation:**
```typescript
{
  auth: async () => {
    // Fetch fresh token if expired
    if (this.tokenExpired()) {
      return await this.refreshToken();
    }
    return this.currentToken;
  }
}
```

## Conclusion

This notification system design prioritizes reliability, scalability, and developer experience. The architecture supports millions of concurrent connections through horizontal scaling, ensures message delivery through intelligent buffering and retry logic, and provides a type-safe API for easy integration.

Key strengths:
- Robust connection management with automatic recovery
- Flexible subscription model with wildcard support
- Scalable architecture using Redis for coordination
- Comprehensive error handling and observability

Areas for future enhancement:
- Message persistence for long-term history
- Advanced filtering and routing rules
- Multi-region deployment support
- Protocol buffer support for binary efficiency
- GraphQL subscription integration
