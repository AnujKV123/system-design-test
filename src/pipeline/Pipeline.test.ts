import { describe, it, expect } from 'vitest';
import { Pipeline } from './Pipeline';
import {
  WebAnalyticsEvent,
  MobileAnalyticsEvent,
  NormalizedEvent,
  normalizeWebAnalytics,
  normalizeMobileAnalytics,
  validate,
  ValidationError,
  ValidationSchema,
  enrich
} from './transformers';

describe('Pipeline with Sample Data', () => {
  // Sample web analytics event data
  const sampleWebEvents: WebAnalyticsEvent[] = [
    {
      user_id: 'web-user-001',
      event_type: 'page_view',
      timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
      props: {
        page: '/home',
        referrer: 'google.com'
      }
    },
    {
      user_id: 'web-user-002',
      event_type: 'button_click',
      timestamp: 1704070800000, // 2024-01-01 01:00:00 UTC
      props: {
        button_id: 'signup-btn',
        page: '/landing'
      }
    },
    {
      user_id: 'web-user-003',
      event_type: 'form_submit',
      timestamp: 1704074400000, // 2024-01-01 02:00:00 UTC
      props: {
        form_id: 'contact-form',
        fields: ['name', 'email']
      }
    }
  ];

  // Sample mobile analytics event data
  const sampleMobileEvents: MobileAnalyticsEvent[] = [
    {
      userId: 'mobile-user-001',
      eventName: 'app_open',
      occurredAt: '2024-01-01T00:00:00.000Z',
      metadata: {
        platform: 'iOS',
        version: '1.2.3'
      }
    },
    {
      userId: 'mobile-user-002',
      eventName: 'screen_view',
      occurredAt: '2024-01-01T01:00:00.000Z',
      metadata: {
        screen: 'profile',
        platform: 'Android'
      }
    },
    {
      userId: 'mobile-user-003',
      eventName: 'purchase',
      occurredAt: '2024-01-01T02:00:00.000Z',
      metadata: {
        product_id: 'prod-123',
        amount: 29.99,
        currency: 'USD'
      }
    }
  ];

  it('should normalize web analytics data through pipeline', async () => {
    const pipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
      .transform(normalizeWebAnalytics(), 'normalizeWeb');

    const result = await pipeline.execute(sampleWebEvents);

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.totalCount).toBe(3);
    expect(result.successful).toHaveLength(3);
    expect(result.failed).toHaveLength(0);

    // Verify first normalized event
    const firstEvent = result.successful[0];
    expect(firstEvent.userId).toBe('web-user-001');
    expect(firstEvent.eventType).toBe('page_view');
    expect(firstEvent.timestamp).toBeInstanceOf(Date);
    expect(firstEvent.timestamp.getTime()).toBe(1704067200000);
    expect(firstEvent.properties).toEqual({
      page: '/home',
      referrer: 'google.com'
    });
    expect(firstEvent.source).toBe('web');

    // Verify all events have correct structure
    result.successful.forEach(event => {
      expect(event).toHaveProperty('userId');
      expect(event).toHaveProperty('eventType');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('properties');
      expect(event).toHaveProperty('source');
      expect(event.source).toBe('web');
    });
  });

  it('should normalize mobile analytics data through pipeline', async () => {
    const pipeline = new Pipeline<MobileAnalyticsEvent, MobileAnalyticsEvent>()
      .transform(normalizeMobileAnalytics(), 'normalizeMobile');

    const result = await pipeline.execute(sampleMobileEvents);

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.totalCount).toBe(3);
    expect(result.successful).toHaveLength(3);
    expect(result.failed).toHaveLength(0);

    // Verify first normalized event
    const firstEvent = result.successful[0];
    expect(firstEvent.userId).toBe('mobile-user-001');
    expect(firstEvent.eventType).toBe('app_open');
    expect(firstEvent.timestamp).toBeInstanceOf(Date);
    expect(firstEvent.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(firstEvent.properties).toEqual({
      platform: 'iOS',
      version: '1.2.3'
    });
    expect(firstEvent.source).toBe('mobile');

    // Verify all events have correct structure
    result.successful.forEach(event => {
      expect(event).toHaveProperty('userId');
      expect(event).toHaveProperty('eventType');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('properties');
      expect(event).toHaveProperty('source');
      expect(event.source).toBe('mobile');
    });
  });

  it('should chain normalize, validate, and enrich transformations', async () => {
    // Define validation schema
    const eventSchema: ValidationSchema<NormalizedEvent> = {
      userId: { required: true, type: 'string' as const, min: 5 },
      eventType: { required: true, type: 'string' as const },
      timestamp: { required: true, type: 'date' as const },
      source: { required: true, type: 'string' as const }
    };

    // Define enrichment function
    interface EnrichedEvent {
      dayOfWeek: string;
      hour: number;
      isWeekend: boolean;
    }

    const enrichEvent = enrich<NormalizedEvent, EnrichedEvent>((event) => {
      const dayOfWeek = event.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = event.timestamp.getHours();
      const day = event.timestamp.getDay();
      const isWeekend = day === 0 || day === 6;

      return {
        dayOfWeek,
        hour,
        isWeekend
      };
    });

    // Create pipeline with chained transformations
    const pipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
      .transform(normalizeWebAnalytics(), 'normalize')
      .transform(validate(eventSchema), 'validate')
      .transform(enrichEvent, 'enrich');

    const result = await pipeline.execute(sampleWebEvents);

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.totalCount).toBe(3);

    // Verify enriched properties are present
    const firstEvent = result.successful[0];
    expect(firstEvent).toHaveProperty('userId');
    expect(firstEvent).toHaveProperty('eventType');
    expect(firstEvent).toHaveProperty('timestamp');
    expect(firstEvent).toHaveProperty('properties');
    expect(firstEvent).toHaveProperty('source');
    expect(firstEvent).toHaveProperty('dayOfWeek');
    expect(firstEvent).toHaveProperty('hour');
    expect(firstEvent).toHaveProperty('isWeekend');

    // Verify enriched values
    expect(typeof firstEvent.dayOfWeek).toBe('string');
    expect(typeof firstEvent.hour).toBe('number');
    expect(typeof firstEvent.isWeekend).toBe('boolean');
    expect(firstEvent.hour).toBeGreaterThanOrEqual(0);
    expect(firstEvent.hour).toBeLessThan(24);
  });

  it('should handle partial failure with mix of valid and invalid data', async () => {
    // Mix of valid and invalid web events
    const mixedEvents: WebAnalyticsEvent[] = [
      // Valid event
      {
        user_id: 'valid-user-001',
        event_type: 'click',
        timestamp: 1704067200000,
        props: { page: '/home' }
      },
      // Invalid event - will fail validation (userId too short)
      {
        user_id: 'usr',
        event_type: 'view',
        timestamp: 1704070800000,
        props: { page: '/about' }
      },
      // Valid event
      {
        user_id: 'valid-user-002',
        event_type: 'submit',
        timestamp: 1704074400000,
        props: { form: 'contact' }
      },
      // Invalid event - will fail validation (userId too short)
      {
        user_id: 'u1',
        event_type: 'error',
        timestamp: 1704078000000,
        props: { error: 'test' }
      }
    ];

    const eventSchema = {
      userId: { required: true, type: 'string' as const, min: 5 },
      eventType: { required: true, type: 'string' as const }
    };

    const pipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
      .transform(normalizeWebAnalytics(), 'normalize')
      .transform(validate(eventSchema), 'validate');

    const result = await pipeline.execute(mixedEvents);

    // Verify counts
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(2);
    expect(result.totalCount).toBe(4);
    expect(result.successful).toHaveLength(2);
    expect(result.failed).toHaveLength(2);

    // Verify successful records
    expect(result.successful[0].userId).toBe('valid-user-001');
    expect(result.successful[1].userId).toBe('valid-user-002');

    // Verify failed records contain error context
    expect(result.failed[0].error).toBeInstanceOf(ValidationError);
    expect(result.failed[0].step).toBe('validate');
    expect(result.failed[0].originalData).toEqual(mixedEvents[1]);

    expect(result.failed[1].error).toBeInstanceOf(ValidationError);
    expect(result.failed[1].step).toBe('validate');
    expect(result.failed[1].originalData).toEqual(mixedEvents[3]);
  });

  it('should verify detailed result reporting with counts and error messages', async () => {
    // Create events that will fail at different stages
    const testEvents: WebAnalyticsEvent[] = [
      // Valid event
      {
        user_id: 'user-success-001',
        event_type: 'page_view',
        timestamp: 1704067200000,
        props: { page: '/home' }
      },
      // Will fail validation - userId too short
      {
        user_id: 'usr',
        event_type: 'click',
        timestamp: 1704070800000,
        props: { button: 'submit' }
      },
      // Will fail validation - missing eventType
      {
        user_id: 'user-fail-002',
        event_type: '',
        timestamp: 1704074400000,
        props: {}
      } as any,
      // Valid event
      {
        user_id: 'user-success-002',
        event_type: 'form_submit',
        timestamp: 1704078000000,
        props: { form: 'signup' }
      }
    ];

    const eventSchema = {
      userId: { required: true, type: 'string' as const, min: 5 },
      eventType: { required: true, type: 'string' as const, min: 1 }
    };

    const pipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
      .transform(normalizeWebAnalytics(), 'normalize')
      .transform(validate(eventSchema), 'validate');

    const result = await pipeline.execute(testEvents);

    // Verify detailed counts
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(2);
    expect(result.totalCount).toBe(4);
    expect(result.successCount + result.failureCount).toBe(result.totalCount);

    // Verify successful records
    expect(result.successful).toHaveLength(2);
    expect(result.successful[0].userId).toBe('user-success-001');
    expect(result.successful[1].userId).toBe('user-success-002');

    // Verify failed records with detailed error information
    expect(result.failed).toHaveLength(2);

    // First failure - userId too short
    const firstFailure = result.failed[0];
    expect(firstFailure.error).toBeInstanceOf(ValidationError);
    expect(firstFailure.error.message).toContain('userId');
    expect(firstFailure.error.message).toContain('at least 5 characters');
    expect(firstFailure.step).toBe('validate');
    expect(firstFailure.originalData).toBe(testEvents[1]);

    // Second failure - eventType too short
    const secondFailure = result.failed[1];
    expect(secondFailure.error).toBeInstanceOf(ValidationError);
    expect(secondFailure.error.message).toContain('eventType');
    expect(secondFailure.error.message).toContain('at least 1 character');
    expect(secondFailure.step).toBe('validate');
    expect(secondFailure.originalData).toBe(testEvents[2]);

    // Verify error messages are descriptive
    result.failed.forEach(failure => {
      expect(failure.error.message).toBeTruthy();
      expect(failure.error.message.length).toBeGreaterThan(0);
      expect(failure.step).toBeTruthy();
    });
  });

  it('should process mixed web and mobile events in separate pipelines', async () => {
    // Process web events
    const webPipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
      .transform(normalizeWebAnalytics(), 'normalizeWeb');

    const webResult = await webPipeline.execute(sampleWebEvents);

    // Process mobile events
    const mobilePipeline = new Pipeline<MobileAnalyticsEvent, MobileAnalyticsEvent>()
      .transform(normalizeMobileAnalytics(), 'normalizeMobile');

    const mobileResult = await mobilePipeline.execute(sampleMobileEvents);

    // Both should succeed
    expect(webResult.successCount).toBe(3);
    expect(mobileResult.successCount).toBe(3);

    // Verify sources are correctly set
    webResult.successful.forEach(event => {
      expect(event.source).toBe('web');
    });

    mobileResult.successful.forEach(event => {
      expect(event.source).toBe('mobile');
    });

    // Combine results
    const allEvents = [...webResult.successful, ...mobileResult.successful];
    expect(allEvents).toHaveLength(6);

    // Verify all have normalized structure
    allEvents.forEach(event => {
      expect(event).toHaveProperty('userId');
      expect(event).toHaveProperty('eventType');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('properties');
      expect(event).toHaveProperty('source');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  it('should isolate failures and continue processing remaining records', async () => {
    // Create a custom transformer that fails on specific condition
    const failOnSpecificUser = (event: NormalizedEvent): NormalizedEvent => {
      if (event.userId === 'web-user-002') {
        throw new Error('Simulated processing error for user-002');
      }
      return event;
    };

    const pipeline = new Pipeline<WebAnalyticsEvent, WebAnalyticsEvent>()
      .transform(normalizeWebAnalytics(), 'normalize')
      .transform(failOnSpecificUser, 'customCheck');

    const result = await pipeline.execute(sampleWebEvents);

    // Should have 2 successes and 1 failure
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.totalCount).toBe(3);

    // Verify the failed record
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].step).toBe('customCheck');
    expect(result.failed[0].error.message).toContain('Simulated processing error');

    // Verify successful records are the ones that didn't fail
    const successfulUserIds = result.successful.map(e => e.userId);
    expect(successfulUserIds).toContain('web-user-001');
    expect(successfulUserIds).toContain('web-user-003');
    expect(successfulUserIds).not.toContain('web-user-002');
  });
});
