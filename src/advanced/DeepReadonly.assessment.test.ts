import { describe, it, expectTypeOf } from 'vitest';
import { DeepReadonly } from './DeepReadonly';

/**
 * Test cases from the assessment requirements
 */

describe('DeepReadonly - Assessment Test Cases', () => {
  it('Test1: should make nested object properties readonly', () => {
    // Test case from assessment:
    // type Test1 = DeepReadonly<{ a: string; b: { c: number } }>;
    // Should be: { readonly a: string; readonly b: { readonly c: number } }
    
    type Test1 = DeepReadonly<{ a: string; b: { c: number } }>;
    
    // Verify structure matches expected type
    expectTypeOf<Test1>().toEqualTypeOf<{
      readonly a: string;
      readonly b: {
        readonly c: number;
      };
    }>();
  });

  it('Test2: should make arrays and their contents readonly', () => {
    // Test case from assessment:
    // type Test2 = DeepReadonly<{ arr: Array<{ id: string }> }>;
    // Arrays and their contents should also be readonly
    
    type Test2 = DeepReadonly<{ arr: Array<{ id: string }> }>;
    
    // Verify array becomes ReadonlyArray with readonly contents
    expectTypeOf<Test2>().toEqualTypeOf<{
      readonly arr: ReadonlyArray<{
        readonly id: string;
      }>;
    }>();
  });
});
