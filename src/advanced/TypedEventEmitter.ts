/**
 * EventMap type - a record mapping event names to their payload types
 */
export type EventMap = {
  [eventName: string]: any;
};

/**
 * TypedEventEmitter - A type-safe event emitter that enforces compile-time
 * type checking for event names and their corresponding payload types.
 * 
 * @template TEvents - An EventMap defining the available events and their payload types
 * 
 * @example
 * ```typescript
 * type MyEvents = {
 *   userLoggedIn: { userId: string; timestamp: Date };
 *   dataUpdated: { id: number; value: string };
 *   error: { message: string };
 * };
 * 
 * const emitter = new TypedEventEmitter<MyEvents>();
 * 
 * emitter.on('userLoggedIn', (payload) => {
 *   console.log(payload.userId); // TypeScript knows the shape of payload
 * });
 * 
 * emitter.emit('userLoggedIn', { userId: '123', timestamp: new Date() });
 * ```
 */
export class TypedEventEmitter<TEvents extends EventMap> {
  /**
   * Private storage for event listeners using mapped types
   * Maps each event name to an array of listener functions
   */
  private listeners: {
    [K in keyof TEvents]?: Array<(payload: TEvents[K]) => void>;
  } = {};

  /**
   * Register a listener for a specific event
   * 
   * @param event - The event name (must be a key of TEvents)
   * @param listener - The callback function that receives the typed payload
   * 
   * @example
   * ```typescript
   * emitter.on('userLoggedIn', (payload) => {
   *   // payload is automatically typed as { userId: string; timestamp: Date }
   *   console.log(payload.userId);
   * });
   * ```
   */
  on<K extends keyof TEvents>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  /**
   * Emit an event with a typed payload
   * 
   * @param event - The event name (must be a key of TEvents)
   * @param payload - The event payload (must match the type defined in TEvents[K])
   * 
   * @example
   * ```typescript
   * emitter.emit('userLoggedIn', { userId: '123', timestamp: new Date() });
   * // TypeScript will error if payload doesn't match the expected type
   * ```
   */
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      // Execute all listeners for this event
      // Catch errors in individual listeners to prevent one failing listener
      // from breaking others
      for (const listener of eventListeners) {
        try {
          listener(payload);
        } catch (error) {
          // Log error but don't throw to prevent breaking other listeners
          console.error(`Error in listener for event "${String(event)}":`, error);
        }
      }
    }
  }

  /**
   * Remove a specific listener for an event
   * 
   * @param event - The event name (must be a key of TEvents)
   * @param listener - The specific listener function to remove
   * 
   * @example
   * ```typescript
   * const handler = (payload) => console.log(payload);
   * emitter.on('userLoggedIn', handler);
   * emitter.off('userLoggedIn', handler); // Remove the specific handler
   * ```
   */
  off<K extends keyof TEvents>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all listeners for all events
   * 
   * @param event - Optional event name. If provided, removes all listeners for that event.
   *                If omitted, removes all listeners for all events.
   */
  removeAllListeners<K extends keyof TEvents>(event?: K): void {
    if (event !== undefined) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  /**
   * Get the count of listeners for a specific event
   * 
   * @param event - The event name
   * @returns The number of listeners registered for the event
   */
  listenerCount<K extends keyof TEvents>(event: K): number {
    return this.listeners[event]?.length ?? 0;
  }
}
