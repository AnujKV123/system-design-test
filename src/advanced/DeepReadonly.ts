/**
 * DeepReadonly Utility Type
 * 
 * A recursive utility type that makes all properties of an object deeply readonly,
 * including nested objects, arrays, Maps, and Sets.
 */

/**
 * Primitive type union for base types that don't need recursive processing
 */
export type Primitive = string | number | boolean | null | undefined | symbol | bigint;

/**
 * DeepReadonly utility type that recursively makes all properties readonly
 * 
 * @template T - The type to make deeply readonly
 * 
 * @example
 * ```typescript
 * interface User {
 *   name: string;
 *   address: {
 *     street: string;
 *     city: string;
 *   };
 *   tags: string[];
 * }
 * 
 * type ReadonlyUser = DeepReadonly<User>;
 * // All properties including nested ones are now readonly
 * ```
 */
export type DeepReadonly<T> = 
  // Base case: primitives are returned as-is
  T extends Primitive
    ? T
    // Handle Array types: convert to ReadonlyArray and recurse on elements
    : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    // Handle Map types: convert to ReadonlyMap and recurse on key and value
    : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    // Handle Set types: convert to ReadonlySet and recurse on elements
    : T extends Set<infer U>
    ? ReadonlySet<DeepReadonly<U>>
    // Handle object types: map over properties making each readonly and recurse
    : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    // Fallback for any other types
    : T;
