# TypeScript Assessment

Comprehensive TypeScript assessment demonstrating proficiency in API client design, data transformation pipelines, system design, code review, and advanced TypeScript features.

## Table of Contents

- [Setup Instructions](#setup-instructions)
- [Project Structure](#project-structure)
- [Usage Examples](#usage-examples)
  - [API Client](#api-client-usage)
  - [Data Transformation Pipeline](#data-transformation-pipeline-usage)
  - [TypedEventEmitter](#typedeventemitter-usage)
  - [DeepReadonly](#deepreadonly-usage)
- [Design Decisions](#design-decisions)
- [Trade-offs](#trade-offs)
- [Additional Libraries](#additional-libraries)

## Setup Instructions

### Prerequisites

- **Node.js**: 18.x or higher (tested with 18.x and 20.x)
- **npm**: 9.x or higher

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Test Suite:**
- 83 comprehensive tests covering all components
- Focus on core functionality, edge cases, and error handling
- Coverage reports generated in text, JSON, and HTML formats
- HTML coverage report available at `coverage/index.html` after running coverage

**Current Coverage:**
- API Client: ~97% statement coverage
- Pipeline: ~92% statement coverage  
- Advanced TypeScript: 100% statement coverage
- Overall: ~74% statement coverage (excluding example/review files)

### Type Checking

```bash
# Type check without emitting files
npm run type-check
```

### Building

```bash
# Compile TypeScript to JavaScript
npm run build
```

The compiled output will be in the `dist/` directory.

## Project Structure

```
typescript-assessment/
├── src/
│   ├── api-client/              # Type-safe HTTP client
│   │   ├── ApiClient.ts         # Main client implementation
│   │   ├── types.ts             # Type definitions and interfaces
│   │   └── ApiClient.test.ts    # Comprehensive test suite
│   ├── pipeline/                # Data transformation pipeline
│   │   ├── Pipeline.ts          # Pipeline core implementation
│   │   ├── types.ts             # Pipeline type definitions
│   │   ├── transformers.ts      # Reusable transformer functions
│   │   ├── Pipeline.test.ts     # Pipeline tests
│   │   └── transformers.test.ts # Transformer tests
│   ├── advanced/                # Advanced TypeScript features
│   │   ├── TypedEventEmitter.ts # Type-safe event emitter
│   │   ├── DeepReadonly.ts      # Deep readonly utility type
│   │   ├── TypedEventEmitter.test.ts
│   │   └── DeepReadonly.test.ts
│   ├── code-review/             # Code review examples
│   │   ├── UserService.original.ts  # Original code with issues
│   │   ├── UserService.refactored.ts # Improved implementation
│   │   └── review-notes.md      # Detailed review notes
│   ├── system-design/           # System design documentation
│   │   └── notification-system.md # Real-time notification system design
│   └── index.ts                 # Main entry point
├── package.json
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Test framework configuration
└── README.md
```

## Usage Examples

### API Client Usage

The API Client provides a type-safe HTTP client with full type inference, error handling, retry logic, and interceptors.

#### Basic Usage

```typescript
import { ApiClient } from './api-client/ApiClient';

// Create a client instance
const client = new ApiClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Make a GET request with type inference
interface User {
  id: number;
  name: string;
  email: string;
}

const response = await client.get<User>('/users/123');

// Handle response using discriminated union
if (response.status === 'success') {
  console.log(response.data.name); // Type-safe access
} else if (response.status === 'error') {
  console.error(response.error.message);
}
```

#### With Authentication

```typescript
const authenticatedClient = new ApiClient({
  baseURL: 'https://api.example.com',
  authToken: 'Bearer your-token-here',
});

// Token is automatically injected into request headers
const response = await authenticatedClient.get<User[]>('/users');
```

#### With Retry Logic

```typescript
const resilientClient = new ApiClient({
  baseURL: 'https://api.example.com',
  retryConfig: {
    maxRetries: 3,
    initialDelay: 1000,      // Start with 1 second
    maxDelay: 10000,         // Cap at 10 seconds
    backoffMultiplier: 2,    // Double delay each retry
  },
});

// Automatically retries on network errors and 5xx responses
const response = await resilientClient.get<User>('/users/123');
```

#### With Interceptors

```typescript
// Add request interceptor for logging
client.addRequestInterceptor((config) => {
  console.log(`Making ${config.method} request to ${config.url}`);
  return config;
});

// Add response interceptor for error logging
client.addResponseInterceptor((response) => {
  if (!response.ok) {
    console.error(`Request failed with status ${response.status}`);
  }
  return response;
});
```

#### POST/PUT/DELETE Requests

```typescript
interface CreateUserDto {
  name: string;
  email: string;
}

// POST with typed request body and response
const createResponse = await client.post<User, CreateUserDto>(
  '/users',
  { name: 'John Doe', email: 'john@example.com' }
);

// PUT with typed request body
const updateResponse = await client.put<User, Partial<User>>(
  '/users/123',
  { name: 'Jane Doe' }
);

// DELETE request
const deleteResponse = await client.delete<void>('/users/123');
```

### Data Transformation Pipeline Usage

The Pipeline provides a composable, type-safe way to transform data from multiple sources with partial failure handling.

#### Basic Pipeline

```typescript
import { Pipeline } from './pipeline/Pipeline';
import { normalize, validate, enrich } from './pipeline/transformers';

// Define source data types
interface WebAnalyticsEvent {
  user_id: string;
  event_type: string;
  timestamp: number;
  props: Record<string, unknown>;
}

interface NormalizedEvent {
  userId: string;
  eventType: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  source: 'web' | 'mobile';
}

// Create a pipeline with transformations
const pipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
  .transform(normalize<WebAnalyticsEvent, NormalizedEvent>({
    userId: 'user_id',
    eventType: 'event_type',
    timestamp: (e) => new Date(e.timestamp * 1000),
    properties: 'props',
    source: () => 'web' as const,
  }))
  .transform(validate<NormalizedEvent>({
    userId: { required: true, type: 'string' },
    eventType: { required: true, type: 'string' },
    timestamp: { required: true, type: 'date' },
  }))
  .transform(enrich((event) => ({
    processedAt: new Date(),
    isRecent: Date.now() - event.timestamp.getTime() < 3600000,
  })));

// Execute pipeline with data
const events: WebAnalyticsEvent[] = [
  { user_id: '123', event_type: 'click', timestamp: 1234567890, props: {} },
  { user_id: '456', event_type: 'view', timestamp: 1234567900, props: {} },
];

const result = await pipeline.execute(events);

console.log(`Processed ${result.successCount} of ${result.totalCount} events`);
console.log(`Failed: ${result.failureCount}`);

// Access successful results
result.successful.forEach((event) => {
  console.log(event.userId, event.processedAt, event.isRecent);
});

// Handle failures
result.failed.forEach((failure) => {
  console.error(`Failed at step ${failure.step}:`, failure.error.message);
});
```

#### Multi-Source Pipeline

```typescript
interface MobileAnalyticsEvent {
  userId: string;
  eventName: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

// Create separate pipelines for different sources
const webPipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
  .transform(normalize<WebAnalyticsEvent, NormalizedEvent>({
    userId: 'user_id',
    eventType: 'event_type',
    timestamp: (e) => new Date(e.timestamp * 1000),
    properties: 'props',
    source: () => 'web' as const,
  }));

const mobilePipeline = new Pipeline<MobileAnalyticsEvent, MobileAnalyticsEvent>()
  .transform(normalize<MobileAnalyticsEvent, NormalizedEvent>({
    userId: 'userId',
    eventType: 'eventName',
    timestamp: (e) => new Date(e.occurredAt),
    properties: 'metadata',
    source: () => 'mobile' as const,
  }));

// Process data from both sources
const webResult = await webPipeline.execute(webEvents);
const mobileResult = await mobilePipeline.execute(mobileEvents);

// Combine results
const allEvents = [...webResult.successful, ...mobileResult.successful];
```

#### Custom Transformers

```typescript
// Create custom transformer function
const addGeolocation = (event: NormalizedEvent) => ({
  ...event,
  location: {
    country: 'US',
    city: 'San Francisco',
  },
});

// Use in pipeline
const enrichedPipeline = pipeline.transform(addGeolocation);
```

### TypedEventEmitter Usage

The TypedEventEmitter provides compile-time type safety for event names and payloads.

#### Basic Usage

```typescript
import { TypedEventEmitter } from './advanced/TypedEventEmitter';

// Define event map
interface AppEvents {
  userLoggedIn: { userId: string; timestamp: Date };
  userLoggedOut: { userId: string };
  dataUpdated: { entityId: string; changes: Record<string, unknown> };
  error: { message: string; code: number };
}

// Create typed emitter
const emitter = new TypedEventEmitter<AppEvents>();

// Register listeners with type-safe payloads
emitter.on('userLoggedIn', (payload) => {
  // payload is automatically typed as { userId: string; timestamp: Date }
  console.log(`User ${payload.userId} logged in at ${payload.timestamp}`);
});

emitter.on('error', (payload) => {
  // payload is typed as { message: string; code: number }
  console.error(`Error ${payload.code}: ${payload.message}`);
});

// Emit events with type checking
emitter.emit('userLoggedIn', {
  userId: '123',
  timestamp: new Date(),
});

// TypeScript error: wrong payload type
// emitter.emit('userLoggedIn', { userId: 123 }); // Error: userId must be string

// TypeScript error: invalid event name
// emitter.emit('invalidEvent', {}); // Error: 'invalidEvent' is not a valid event
```

#### Multiple Listeners

```typescript
const listener1 = (payload: AppEvents['dataUpdated']) => {
  console.log('Listener 1:', payload.entityId);
};

const listener2 = (payload: AppEvents['dataUpdated']) => {
  console.log('Listener 2:', payload.changes);
};

emitter.on('dataUpdated', listener1);
emitter.on('dataUpdated', listener2);

// Both listeners are called
emitter.emit('dataUpdated', {
  entityId: 'entity-123',
  changes: { name: 'New Name' },
});

// Remove specific listener
emitter.off('dataUpdated', listener1);
```

### DeepReadonly Usage

The DeepReadonly utility type recursively makes all properties readonly at compile time.

#### Basic Usage

```typescript
import { DeepReadonly } from './advanced/DeepReadonly';

interface User {
  id: number;
  name: string;
  profile: {
    email: string;
    settings: {
      theme: string;
      notifications: boolean;
    };
  };
  tags: string[];
}

// Create deeply readonly version
type ReadonlyUser = DeepReadonly<User>;

const user: ReadonlyUser = {
  id: 1,
  name: 'John',
  profile: {
    email: 'john@example.com',
    settings: {
      theme: 'dark',
      notifications: true,
    },
  },
  tags: ['admin', 'user'],
};

// All of these produce TypeScript errors:
// user.name = 'Jane';                           // Error: readonly
// user.profile.email = 'jane@example.com';      // Error: readonly
// user.profile.settings.theme = 'light';        // Error: readonly
// user.tags.push('moderator');                  // Error: readonly array
// user.tags[0] = 'superadmin';                  // Error: readonly array
```

#### With Complex Structures

```typescript
interface AppState {
  users: User[];
  settings: Map<string, string>;
  activeIds: Set<number>;
  metadata: {
    version: string;
    features: {
      enabled: boolean;
      config: Record<string, unknown>;
    }[];
  };
}

type ImmutableAppState = DeepReadonly<AppState>;

// All nested structures are readonly
const state: ImmutableAppState = {
  users: [{ id: 1, name: 'John', profile: { /* ... */ }, tags: [] }],
  settings: new Map([['theme', 'dark']]),
  activeIds: new Set([1, 2, 3]),
  metadata: {
    version: '1.0.0',
    features: [{ enabled: true, config: {} }],
  },
};

// All mutations are prevented at compile time
// state.users[0].name = 'Jane';                    // Error
// state.settings.set('theme', 'light');            // Error
// state.activeIds.add(4);                          // Error
// state.metadata.features[0].enabled = false;      // Error
```

## Design Decisions

### API Client

**Discriminated Unions for Response States**: Using a `status` discriminator (`'success' | 'error' | 'loading'`) enables TypeScript's type narrowing, allowing exhaustive checking and type-safe access to response data or errors.

**Generic Type Parameters**: Methods like `get<T>()` and `post<T, B>()` provide full type inference, ensuring request bodies and response data are properly typed without manual type assertions.

**Interceptor Pattern**: Separates cross-cutting concerns (logging, authentication, error tracking) from core HTTP logic, making the client extensible without modification.

**Exponential Backoff with Jitter**: Implements jittered exponential backoff for retries to prevent thundering herd problems when multiple clients retry simultaneously.

**Fetch API**: Uses native fetch for broad compatibility and modern async/await patterns, avoiding additional HTTP client dependencies.

### Data Transformation Pipeline

**Immutable Transformations**: Each transformation step returns new data rather than mutating input, preventing side effects and making the pipeline predictable.

**Type Flow Through Generics**: Type parameters flow through the pipeline (`Pipeline<TInput, TOutput>`), maintaining type safety across transformation chains.

**Partial Failure Handling**: Uses a Result pattern to collect both successes and failures, ensuring one record's failure doesn't stop processing of others.

**Composable Pure Functions**: Each transformer is a pure function that can be reused and composed, following functional programming principles.

**Error Context Preservation**: Failed records include original data, error details, and the step where failure occurred for debugging.

### Advanced TypeScript

**Mapped Types for Event Emitter**: Uses `[K in keyof TEvents]` to ensure only valid event names are accepted, with `TEvents[K]` providing the correct payload type.

**Recursive Conditional Types for DeepReadonly**: Implements recursion with base cases for primitives and special handling for arrays, Maps, Sets, and objects.

**Type Inference Over Annotations**: Leverages TypeScript's inference capabilities to reduce boilerplate while maintaining type safety.

### Testing

**Vitest over Jest**: Chosen for faster execution, native ESM support, better TypeScript integration, and modern API design.

**Comprehensive Coverage**: Tests cover happy paths, error scenarios, edge cases, and type safety verification.

**Minimal Mocking**: Uses real implementations where possible, only mocking external dependencies like fetch.

## Trade-offs

### API Client

**Retry Logic Complexity vs Reliability**: Implementing exponential backoff adds complexity but significantly improves reliability in production environments with transient failures. The trade-off favors reliability.

**Interceptor Overhead vs Flexibility**: Interceptors add a small performance overhead but provide essential flexibility for authentication, logging, and error handling. The flexibility is worth the minimal cost.

**Type Safety vs Simplicity**: Discriminated unions and generic types add complexity compared to simple `any` types, but the compile-time safety prevents runtime errors and improves developer experience.

### Data Transformation Pipeline

**Memory vs Performance**: Collecting all results (successful and failed) in memory provides complete visibility but uses more memory than streaming. For typical use cases, the memory trade-off is acceptable for better debugging.

**Partial Failure Handling vs Fail-Fast**: Continuing processing after failures adds complexity but is essential for batch processing scenarios where some failures are acceptable.

**Type Safety vs Dynamic Flexibility**: Strong typing through generics reduces flexibility for dynamic schemas but prevents entire classes of runtime errors.

### Advanced TypeScript

**DeepReadonly Complexity**: The recursive conditional type is complex but provides compile-time immutability guarantees that prevent entire categories of bugs.

**TypedEventEmitter Verbosity**: Defining event maps upfront requires more initial setup but provides invaluable type safety and autocomplete for event-driven code.

## Additional Libraries

This project uses minimal dependencies to demonstrate TypeScript proficiency without relying on external libraries:

### Production Dependencies

**None** - The implementation uses only TypeScript standard library and Node.js built-ins (fetch API).

### Development Dependencies

**TypeScript (^5.3.3)**: Latest stable version providing advanced type system features including:
- Improved type inference
- Better error messages
- Enhanced generic type handling
- Strict mode improvements

**Vitest (^1.0.4)**: Modern test framework chosen for:
- Native ESM support (no transpilation needed)
- Fast execution with smart parallelization
- Built-in TypeScript support
- Compatible API with Jest for easy migration
- Better developer experience with clear error messages
- Built-in coverage reporting with v8 provider

The project includes 83 tests with comprehensive coverage of all components. Run `npm run test:coverage` to generate detailed coverage reports in text, JSON, and HTML formats.

**@types/node (^20.10.0)**: TypeScript type definitions for Node.js APIs, enabling:
- Type-safe usage of Node.js built-ins
- Autocomplete for Node.js APIs
- Compile-time checking for Node.js code

### Why No Additional Libraries?

The assessment intentionally avoids external libraries to demonstrate:
- Deep understanding of TypeScript's type system
- Ability to implement complex patterns from scratch
- Knowledge of JavaScript/TypeScript fundamentals
- Problem-solving without relying on frameworks

In a production environment, libraries like `axios` (HTTP client), `zod` (validation), or `rxjs` (reactive programming) might be appropriate depending on specific requirements.

## License

MIT
