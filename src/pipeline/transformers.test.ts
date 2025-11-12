import { describe, it, expect } from 'vitest';
import { validate, ValidationError, enrich } from './transformers';

describe('Validation Transformer', () => {
  it('should pass validation for valid data', () => {
    const schema = {
      userId: { required: true, type: 'string' as const },
      eventType: { required: true, type: 'string' as const },
      timestamp: { required: true, type: 'date' as const }
    };

    const validator = validate(schema);
    const validData = {
      userId: 'user123',
      eventType: 'click',
      timestamp: new Date(),
      properties: {},
      source: 'web' as const
    };

    expect(() => validator(validData)).not.toThrow();
    expect(validator(validData)).toEqual(validData);
  });

  it('should throw ValidationError for missing required field', () => {
    const schema = {
      userId: { required: true }
    };

    const validator = validate(schema);
    const invalidData = { eventType: 'click' } as any;

    expect(() => validator(invalidData)).toThrow(ValidationError);
    expect(() => validator(invalidData)).toThrow(/required/);
  });

  it('should throw ValidationError for incorrect type', () => {
    const schema = {
      userId: { type: 'string' as const }
    };

    const validator = validate(schema);
    const invalidData = { userId: 123 } as any;

    expect(() => validator(invalidData)).toThrow(ValidationError);
    expect(() => validator(invalidData)).toThrow(/type/);
  });

  it('should validate min constraint for numbers', () => {
    const schema = {
      age: { type: 'number' as const, min: 18 }
    };

    const validator = validate(schema);
    
    expect(() => validator({ age: 17 })).toThrow(ValidationError);
    expect(() => validator({ age: 17 })).toThrow(/at least 18/);
    expect(() => validator({ age: 18 })).not.toThrow();
    expect(() => validator({ age: 25 })).not.toThrow();
  });

  it('should validate max constraint for numbers', () => {
    const schema = {
      score: { type: 'number' as const, max: 100 }
    };

    const validator = validate(schema);
    
    expect(() => validator({ score: 101 })).toThrow(ValidationError);
    expect(() => validator({ score: 101 })).toThrow(/at most 100/);
    expect(() => validator({ score: 100 })).not.toThrow();
    expect(() => validator({ score: 50 })).not.toThrow();
  });

  it('should validate min length for strings', () => {
    const schema = {
      username: { type: 'string' as const, min: 3 }
    };

    const validator = validate(schema);
    
    expect(() => validator({ username: 'ab' })).toThrow(ValidationError);
    expect(() => validator({ username: 'ab' })).toThrow(/at least 3 characters/);
    expect(() => validator({ username: 'abc' })).not.toThrow();
  });

  it('should validate max length for strings', () => {
    const schema = {
      username: { type: 'string' as const, max: 10 }
    };

    const validator = validate(schema);
    
    expect(() => validator({ username: 'verylongusername' })).toThrow(ValidationError);
    expect(() => validator({ username: 'verylongusername' })).toThrow(/at most 10 characters/);
    expect(() => validator({ username: 'short' })).not.toThrow();
  });

  it('should validate pattern constraint for strings', () => {
    const schema = {
      email: { type: 'string' as const, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
    };

    const validator = validate(schema);
    
    expect(() => validator({ email: 'invalid-email' })).toThrow(ValidationError);
    expect(() => validator({ email: 'invalid-email' })).toThrow(/pattern/);
    expect(() => validator({ email: 'valid@example.com' })).not.toThrow();
  });

  it('should validate multiple fields', () => {
    const schema = {
      userId: { required: true, type: 'string' as const, min: 3 },
      age: { required: true, type: 'number' as const, min: 0, max: 150 },
      email: { type: 'string' as const, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
    };

    const validator = validate(schema);
    
    const validData = {
      userId: 'user123',
      age: 25,
      email: 'user@example.com'
    };
    
    expect(() => validator(validData)).not.toThrow();
    
    const invalidData1 = { userId: 'ab', age: 25, email: undefined };
    expect(() => validator(invalidData1 as any)).toThrow(/at least 3 characters/);
    
    const invalidData2 = { userId: 'user123', age: 200, email: undefined };
    expect(() => validator(invalidData2 as any)).toThrow(/at most 150/);
  });

  it('should skip validation for optional fields that are undefined', () => {
    const schema = {
      userId: { required: true, type: 'string' as const },
      optionalField: { type: 'string' as const, min: 5 }
    };

    const validator = validate(schema);
    const dataWithoutOptional = { userId: 'user123', optionalField: undefined };
    
    expect(() => validator(dataWithoutOptional as any)).not.toThrow();
  });
});

describe('Enrichment Transformer', () => {
  it('should add computed properties to data', () => {
    interface User {
      name: string;
      age: number;
    }

    interface Enriched {
      isAdult: boolean;
      category: string;
    }

    const enrichUser = enrich<User, Enriched>((user) => ({
      isAdult: user.age >= 18,
      category: user.age < 18 ? 'minor' : user.age < 65 ? 'adult' : 'senior'
    }));

    const result = enrichUser({ name: 'Alice', age: 25 });

    expect(result).toEqual({
      name: 'Alice',
      age: 25,
      isAdult: true,
      category: 'adult'
    });
  });

  it('should maintain original properties', () => {
    interface Product {
      id: string;
      price: number;
      quantity: number;
    }

    interface Enriched {
      total: number;
    }

    const enrichProduct = enrich<Product, Enriched>((product) => ({
      total: product.price * product.quantity
    }));

    const result = enrichProduct({ id: 'prod-1', price: 10, quantity: 5 });

    expect(result.id).toBe('prod-1');
    expect(result.price).toBe(10);
    expect(result.quantity).toBe(5);
    expect(result.total).toBe(50);
  });

  it('should preserve type safety with intersection types', () => {
    interface Event {
      userId: string;
      timestamp: Date;
    }

    interface Enriched {
      dayOfWeek: string;
      hour: number;
    }

    const enrichEvent = enrich<Event, Enriched>((event) => ({
      dayOfWeek: event.timestamp.toLocaleDateString('en-US', { weekday: 'long' }),
      hour: event.timestamp.getHours()
    }));

    const testDate = new Date('2024-01-15T14:30:00');
    const result = enrichEvent({ userId: 'user123', timestamp: testDate });

    // Type safety: result should have all properties from Event and Enriched
    expect(result.userId).toBe('user123');
    expect(result.timestamp).toEqual(testDate);
    expect(result.dayOfWeek).toBe('Monday');
    expect(result.hour).toBe(14);
  });

  it('should work with complex enrichment logic', () => {
    interface Order {
      items: number;
      subtotal: number;
      customerType: 'regular' | 'premium';
    }

    interface Enriched {
      discount: number;
      tax: number;
      total: number;
      shippingFee: number;
    }

    const enrichOrder = enrich<Order, Enriched>((order) => {
      const discount = order.customerType === 'premium' ? order.subtotal * 0.1 : 0;
      const discountedSubtotal = order.subtotal - discount;
      const tax = discountedSubtotal * 0.08;
      const shippingFee = order.items > 5 ? 0 : 5;
      const total = discountedSubtotal + tax + shippingFee;

      return {
        discount,
        tax,
        total,
        shippingFee
      };
    });

    const regularOrder = enrichOrder({ items: 3, subtotal: 100, customerType: 'regular' });
    expect(regularOrder.discount).toBe(0);
    expect(regularOrder.tax).toBe(8);
    expect(regularOrder.shippingFee).toBe(5);
    expect(regularOrder.total).toBe(113);

    const premiumOrder = enrichOrder({ items: 10, subtotal: 100, customerType: 'premium' });
    expect(premiumOrder.discount).toBe(10);
    expect(premiumOrder.tax).toBe(7.2);
    expect(premiumOrder.shippingFee).toBe(0);
    expect(premiumOrder.total).toBe(97.2);
  });
});
