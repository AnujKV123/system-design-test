import { TransformFn } from './types';

/**
 * Common normalized event format - target format for all source types
 */
export interface NormalizedEvent {
  userId: string;
  eventType: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  source: 'web' | 'mobile';
}

/**
 * Web analytics event format (Source A)
 * Uses snake_case naming and unix timestamp
 */
export interface WebAnalyticsEvent {
  user_id: string;
  event_type: string;
  timestamp: number; // Unix timestamp in milliseconds
  props: Record<string, unknown>;
}

/**
 * Mobile analytics event format (Source B)
 * Uses camelCase naming and ISO timestamp string
 */
export interface MobileAnalyticsEvent {
  userId: string;
  eventName: string;
  occurredAt: string; // ISO 8601 timestamp string
  metadata: Record<string, unknown>;
}

/**
 * Field mapping configuration for normalization
 */
export interface FieldMapping<TSource, TTarget> {
  /** Maps source field names to target field names */
  fields: {
    [K in keyof TTarget]?: keyof TSource | ((source: TSource) => TTarget[K]);
  };
  /** Optional custom transformation logic */
  transform?: (source: TSource) => Partial<TTarget>;
}

/**
 * Creates a normalization transformer that converts different source formats
 * to a common target format using field mapping configuration.
 * 
 * @template TSource - The source data type
 * @template TTarget - The target normalized type
 * @param mapping - Field mapping configuration
 * @returns A transform function that normalizes source data to target format
 */
export function normalize<TSource, TTarget>(
  mapping: FieldMapping<TSource, TTarget>
): TransformFn<TSource, TTarget> {
  return (source: TSource): TTarget => {
    const result: any = {};

    // Apply field mappings
    for (const targetKey in mapping.fields) {
      const sourceMapping = mapping.fields[targetKey];
      
      if (typeof sourceMapping === 'function') {
        // Custom mapping function
        result[targetKey] = sourceMapping(source);
      } else if (sourceMapping) {
        // Direct field mapping
        result[targetKey] = source[sourceMapping as keyof TSource];
      }
    }

    // Apply custom transformation if provided
    if (mapping.transform) {
      const customFields = mapping.transform(source);
      Object.assign(result, customFields);
    }

    return result as TTarget;
  };
}

/**
 * Creates a normalization transformer specifically for web analytics events.
 * Converts snake_case fields and unix timestamps to the common format.
 * 
 * @returns A transform function that normalizes web analytics events
 */
export function normalizeWebAnalytics(): TransformFn<WebAnalyticsEvent, NormalizedEvent> {
  return normalize<WebAnalyticsEvent, NormalizedEvent>({
    fields: {
      userId: 'user_id',
      eventType: 'event_type',
      timestamp: (source) => new Date(source.timestamp),
      properties: 'props',
      source: () => 'web' as const
    }
  });
}

/**
 * Creates a normalization transformer specifically for mobile analytics events.
 * Converts camelCase fields and ISO timestamp strings to the common format.
 * 
 * @returns A transform function that normalizes mobile analytics events
 */
export function normalizeMobileAnalytics(): TransformFn<MobileAnalyticsEvent, NormalizedEvent> {
  return normalize<MobileAnalyticsEvent, NormalizedEvent>({
    fields: {
      userId: 'userId',
      eventType: 'eventName',
      timestamp: (source) => new Date(source.occurredAt),
      properties: 'metadata',
      source: () => 'mobile' as const
    }
  });
}

/**
 * Validation error thrown when data fails validation
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Type constraint for validation rules
 */
type ValidationRule<T = any> = {
  /** Check if field is required (must be present and not null/undefined) */
  required?: boolean;
  /** Expected type of the field */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  /** Minimum value (for numbers) or minimum length (for strings/arrays) */
  min?: number;
  /** Maximum value (for numbers) or maximum length (for strings/arrays) */
  max?: number;
  /** Regular expression pattern (for strings) */
  pattern?: RegExp;
  /** Custom validation function */
  custom?: (value: T) => boolean | string;
};

/**
 * Schema definition mapping field names to validation rules
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

/**
 * Creates a validation transformer that checks data against schema rules.
 * Throws ValidationError with descriptive messages when validation fails.
 * 
 * @template T - The data type to validate
 * @param schema - Validation schema with rules for each field
 * @returns A transform function that validates data and returns it unchanged if valid
 * @throws {ValidationError} When validation fails
 */
export function validate<T extends Record<string, any>>(
  schema: ValidationSchema<T>
): TransformFn<T, T> {
  return (data: T): T => {
    // Validate each field according to schema rules
    for (const fieldName in schema) {
      const rules = schema[fieldName];
      if (!rules) continue;

      const value = data[fieldName];

      // Check required fields
      if (rules.required && (value === null || value === undefined)) {
        throw new ValidationError(
          `Field '${String(fieldName)}' is required but was ${value === null ? 'null' : 'undefined'}`,
          String(fieldName),
          value
        );
      }

      // Skip further validation if value is null/undefined and not required
      if (value === null || value === undefined) {
        continue;
      }

      // Check type
      if (rules.type) {
        const actualType = getValueType(value);
        if (actualType !== rules.type) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must be of type '${rules.type}' but got '${actualType}'`,
            String(fieldName),
            value
          );
        }
      }

      // Check min constraint
      if (rules.min !== undefined) {
        if (typeof value === 'number' && value < rules.min) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must be at least ${rules.min} but got ${value}`,
            String(fieldName),
            value
          );
        }
        if (typeof value === 'string' && value.length < rules.min) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must have at least ${rules.min} characters but got ${value.length}`,
            String(fieldName),
            value
          );
        }
        if (Array.isArray(value) && value.length < rules.min) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must have at least ${rules.min} items but got ${value.length}`,
            String(fieldName),
            value
          );
        }
      }

      // Check max constraint
      if (rules.max !== undefined) {
        if (typeof value === 'number' && value > rules.max) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must be at most ${rules.max} but got ${value}`,
            String(fieldName),
            value
          );
        }
        if (typeof value === 'string' && value.length > rules.max) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must have at most ${rules.max} characters but got ${value.length}`,
            String(fieldName),
            value
          );
        }
        if (Array.isArray(value) && value.length > rules.max) {
          throw new ValidationError(
            `Field '${String(fieldName)}' must have at most ${rules.max} items but got ${value.length}`,
            String(fieldName),
            value
          );
        }
      }

      // Check pattern constraint (for strings)
      if (rules.pattern && typeof value === 'string') {
        if (!rules.pattern.test(value)) {
          throw new ValidationError(
            `Field '${String(fieldName)}' does not match required pattern ${rules.pattern}`,
            String(fieldName),
            value
          );
        }
      }

      // Check custom validation
      if (rules.custom) {
        const result = rules.custom(value);
        if (result === false) {
          throw new ValidationError(
            `Field '${String(fieldName)}' failed custom validation`,
            String(fieldName),
            value
          );
        }
        if (typeof result === 'string') {
          throw new ValidationError(
            result,
            String(fieldName),
            value
          );
        }
      }
    }

    // Return data unchanged if all validations pass
    return data;
  };
}

/**
 * Helper function to determine the type of a value for validation
 */
function getValueType(value: any): string {
  if (value instanceof Date) return 'date';
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * Creates an enrichment transformer that adds computed properties to data.
 * The enricher function receives the original data and returns additional properties
 * to be merged with the original data. Type safety is preserved through intersection types.
 * 
 * @template T - The input data type
 * @template TEnriched - The type of enriched properties to add
 * @param enricher - Function that computes additional properties from the input data
 * @returns A transform function that returns the original data merged with enriched properties
 * 
 * @example
 * ```typescript
 * interface User { name: string; age: number; }
 * interface Enriched { isAdult: boolean; category: string; }
 * 
 * const enrichUser = enrich<User, Enriched>((user) => ({
 *   isAdult: user.age >= 18,
 *   category: user.age < 18 ? 'minor' : user.age < 65 ? 'adult' : 'senior'
 * }));
 * 
 * const result = enrichUser({ name: 'Alice', age: 25 });
 * // result: { name: 'Alice', age: 25, isAdult: true, category: 'adult' }
 * ```
 */
export function enrich<T, TEnriched>(
  enricher: (data: T) => TEnriched
): (data: T) => T & TEnriched {
  return (data: T): T & TEnriched => {
    // Compute enriched properties
    const enrichedProperties = enricher(data);
    
    // Merge original data with enriched properties
    // Using object spread to create a new object (immutable)
    return {
      ...data,
      ...enrichedProperties
    } as T & TEnriched;
  };
}
