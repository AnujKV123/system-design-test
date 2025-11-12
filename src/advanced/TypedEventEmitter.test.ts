import { describe, it, expect, vi } from 'vitest';
import { TypedEventEmitter } from './TypedEventEmitter';

/**
 * Test event map definitions
 */
type TestEvents = {
  userLoggedIn: { userId: string; timestamp: Date };
  dataUpdated: { id: number; value: string };
  error: { message: string };
  simpleEvent: string;
  numberEvent: number;
};

describe('TypedEventEmitter', () => {
  describe('listener registration and emission', () => {
    it('should register a listener and emit events to it', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const mockListener = vi.fn();

      emitter.on('userLoggedIn', mockListener);
      
      const payload = { userId: '123', timestamp: new Date() };
      emitter.emit('userLoggedIn', payload);

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener).toHaveBeenCalledWith(payload);
    });

    it('should call multiple listeners for the same event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.on('error', listener1);
      emitter.on('error', listener2);
      emitter.on('error', listener3);

      const payload = { message: 'Test error' };
      emitter.emit('error', payload);

      expect(listener1).toHaveBeenCalledWith(payload);
      expect(listener2).toHaveBeenCalledWith(payload);
      expect(listener3).toHaveBeenCalledWith(payload);
    });

    it('should handle events with no listeners gracefully', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      
      expect(() => {
        emitter.emit('userLoggedIn', { userId: '123', timestamp: new Date() });
      }).not.toThrow();
    });

    it('should pass correct payload types to listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      
      emitter.on('simpleEvent', (payload) => {
        expect(typeof payload).toBe('string');
      });

      emitter.on('numberEvent', (payload) => {
        expect(typeof payload).toBe('number');
      });

      emitter.emit('simpleEvent', 'test string');
      emitter.emit('numberEvent', 42);
    });
  });

  describe('multiple event types', () => {
    it('should handle multiple different event types independently', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const userListener = vi.fn();
      const dataListener = vi.fn();
      const errorListener = vi.fn();

      emitter.on('userLoggedIn', userListener);
      emitter.on('dataUpdated', dataListener);
      emitter.on('error', errorListener);

      const userPayload = { userId: '123', timestamp: new Date() };
      const dataPayload = { id: 1, value: 'test' };
      const errorPayload = { message: 'error occurred' };

      emitter.emit('userLoggedIn', userPayload);
      emitter.emit('dataUpdated', dataPayload);
      emitter.emit('error', errorPayload);

      expect(userListener).toHaveBeenCalledWith(userPayload);
      expect(userListener).toHaveBeenCalledTimes(1);
      
      expect(dataListener).toHaveBeenCalledWith(dataPayload);
      expect(dataListener).toHaveBeenCalledTimes(1);
      
      expect(errorListener).toHaveBeenCalledWith(errorPayload);
      expect(errorListener).toHaveBeenCalledTimes(1);
    });

    it('should not trigger listeners for different events', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const userListener = vi.fn();
      const dataListener = vi.fn();

      emitter.on('userLoggedIn', userListener);
      emitter.on('dataUpdated', dataListener);

      emitter.emit('userLoggedIn', { userId: '123', timestamp: new Date() });

      expect(userListener).toHaveBeenCalledTimes(1);
      expect(dataListener).not.toHaveBeenCalled();
    });

    it('should handle complex event payloads correctly', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener = vi.fn();

      emitter.on('dataUpdated', listener);

      const complexPayload = {
        id: 999,
        value: 'complex data with special chars: !@#$%'
      };

      emitter.emit('dataUpdated', complexPayload);

      expect(listener).toHaveBeenCalledWith(complexPayload);
      expect(listener.mock.calls[0][0].id).toBe(999);
      expect(listener.mock.calls[0][0].value).toContain('special chars');
    });
  });

  describe('listener removal', () => {
    it('should remove a specific listener', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on('error', listener1);
      emitter.on('error', listener2);

      emitter.off('error', listener1);

      emitter.emit('error', { message: 'test' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle removing non-existent listener gracefully', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener = vi.fn();

      expect(() => {
        emitter.off('error', listener);
      }).not.toThrow();
    });

    it('should allow re-adding a removed listener', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener = vi.fn();

      emitter.on('error', listener);
      emitter.off('error', listener);
      emitter.on('error', listener);

      emitter.emit('error', { message: 'test' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for a specific event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.on('error', listener1);
      emitter.on('error', listener2);
      emitter.on('userLoggedIn', listener3);

      emitter.removeAllListeners('error');

      emitter.emit('error', { message: 'test' });
      emitter.emit('userLoggedIn', { userId: '123', timestamp: new Date() });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for all events', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.on('error', listener1);
      emitter.on('dataUpdated', listener2);
      emitter.on('userLoggedIn', listener3);

      emitter.removeAllListeners();

      emitter.emit('error', { message: 'test' });
      emitter.emit('dataUpdated', { id: 1, value: 'test' });
      emitter.emit('userLoggedIn', { userId: '123', timestamp: new Date() });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });
  });

  describe('listener count', () => {
    it('should return correct listener count', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      expect(emitter.listenerCount('error')).toBe(0);

      emitter.on('error', vi.fn());
      expect(emitter.listenerCount('error')).toBe(1);

      emitter.on('error', vi.fn());
      expect(emitter.listenerCount('error')).toBe(2);

      emitter.on('error', vi.fn());
      expect(emitter.listenerCount('error')).toBe(3);
    });

    it('should update count after removing listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const listener = vi.fn();

      emitter.on('error', listener);
      emitter.on('error', vi.fn());
      expect(emitter.listenerCount('error')).toBe(2);

      emitter.off('error', listener);
      expect(emitter.listenerCount('error')).toBe(1);
    });
  });

  describe('error handling in listeners', () => {
    it('should catch errors in listeners and continue executing other listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      // Suppress console.error for this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emitter.on('error', errorListener);
      emitter.on('error', normalListener);

      emitter.emit('error', { message: 'test' });

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
