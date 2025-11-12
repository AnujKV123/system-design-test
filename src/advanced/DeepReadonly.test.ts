import { describe, it, expectTypeOf } from 'vitest';
import { DeepReadonly } from './DeepReadonly';

/**
 * Test type definitions for DeepReadonly
 */

// Simple nested object
interface User {
  id: number;
  name: string;
  address: {
    street: string;
    city: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
}

// Object with arrays
interface Blog {
  title: string;
  posts: Array<{
    id: number;
    content: string;
    tags: string[];
  }>;
  metadata: {
    authors: string[];
    categories: string[];
  };
}

// Complex nested structure with various types
interface ComplexStructure {
  id: number;
  name: string;
  nested: {
    level1: {
      level2: {
        level3: {
          value: string;
          items: number[];
        };
      };
    };
  };
  arrayOfObjects: Array<{
    id: number;
    data: {
      values: string[];
    };
  }>;
  mixedArray: Array<string | number | { key: string }>;
  optionalField?: string;
  nullableField: string | null;
}

// Structure with Map and Set
interface CollectionStructure {
  id: number;
  tags: Set<string>;
  metadata: Map<string, { value: number }>;
  nestedCollections: {
    items: Set<{ id: number; name: string }>;
    mapping: Map<number, string[]>;
  };
}

describe('DeepReadonly', () => {
  describe('nested objects', () => {
    it('should make all top-level properties readonly', () => {
      type ReadonlyUser = DeepReadonly<User>;

      expectTypeOf<ReadonlyUser>().toHaveProperty('id').toEqualTypeOf<number>();
      expectTypeOf<ReadonlyUser>().toHaveProperty('name').toEqualTypeOf<string>();
      
      // Verify readonly at top level - properties should be readonly
      expectTypeOf<ReadonlyUser>().toMatchTypeOf<{ readonly id: number; readonly name: string }>();
    });

    it('should recursively make nested object properties readonly', () => {
      type ReadonlyUser = DeepReadonly<User>;

      // Check nested address object
      expectTypeOf<ReadonlyUser['address']>().toHaveProperty('street').toEqualTypeOf<string>();
      expectTypeOf<ReadonlyUser['address']>().toHaveProperty('city').toEqualTypeOf<string>();
      
      // Check deeply nested coordinates
      expectTypeOf<ReadonlyUser['address']['coordinates']>().toHaveProperty('lat').toEqualTypeOf<number>();
      expectTypeOf<ReadonlyUser['address']['coordinates']>().toHaveProperty('lng').toEqualTypeOf<number>();
    });

    it('should preserve the original type structure', () => {
      type ReadonlyUser = DeepReadonly<User>;

      // Structure should be preserved
      expectTypeOf<ReadonlyUser>().toMatchTypeOf<{
        readonly id: number;
        readonly name: string;
        readonly address: {
          readonly street: string;
          readonly city: string;
          readonly coordinates: {
            readonly lat: number;
            readonly lng: number;
          };
        };
      }>();
    });

    it('should handle optional and nullable fields', () => {
      type ReadonlyComplex = DeepReadonly<ComplexStructure>;

      expectTypeOf<ReadonlyComplex>().toHaveProperty('optionalField').toEqualTypeOf<string | undefined>();
      expectTypeOf<ReadonlyComplex>().toHaveProperty('nullableField').toEqualTypeOf<string | null>();
    });
  });

  describe('arrays of objects', () => {
    it('should make arrays readonly', () => {
      type ReadonlyBlog = DeepReadonly<Blog>;

      // Array should be ReadonlyArray
      expectTypeOf<ReadonlyBlog['posts']>().toEqualTypeOf<ReadonlyArray<{
        readonly id: number;
        readonly content: string;
        readonly tags: ReadonlyArray<string>;
      }>>();
    });

    it('should recursively make array elements readonly', () => {
      type ReadonlyBlog = DeepReadonly<Blog>;

      // Array elements should have readonly properties
      type PostType = ReadonlyBlog['posts'][number];
      expectTypeOf<PostType>().toHaveProperty('id').toEqualTypeOf<number>();
      expectTypeOf<PostType>().toHaveProperty('content').toEqualTypeOf<string>();
      expectTypeOf<PostType>().toHaveProperty('tags').toEqualTypeOf<ReadonlyArray<string>>();
    });

    it('should handle nested arrays within objects', () => {
      type ReadonlyBlog = DeepReadonly<Blog>;

      // Nested arrays should also be readonly
      expectTypeOf<ReadonlyBlog['metadata']['authors']>().toEqualTypeOf<ReadonlyArray<string>>();
      expectTypeOf<ReadonlyBlog['metadata']['categories']>().toEqualTypeOf<ReadonlyArray<string>>();
    });

    it('should handle arrays of primitives', () => {
      interface SimpleArray {
        numbers: number[];
        strings: string[];
      }

      type ReadonlySimple = DeepReadonly<SimpleArray>;

      expectTypeOf<ReadonlySimple['numbers']>().toEqualTypeOf<ReadonlyArray<number>>();
      expectTypeOf<ReadonlySimple['strings']>().toEqualTypeOf<ReadonlyArray<string>>();
    });
  });

  describe('complex nested structures', () => {
    it('should handle deeply nested objects with multiple levels', () => {
      type ReadonlyComplex = DeepReadonly<ComplexStructure>;

      // Navigate through multiple nesting levels
      type Level3Type = ReadonlyComplex['nested']['level1']['level2']['level3'];
      
      expectTypeOf<Level3Type>().toHaveProperty('value').toEqualTypeOf<string>();
      expectTypeOf<Level3Type>().toHaveProperty('items').toEqualTypeOf<ReadonlyArray<number>>();
    });

    it('should handle arrays of objects with nested properties', () => {
      type ReadonlyComplex = DeepReadonly<ComplexStructure>;

      type ArrayElement = ReadonlyComplex['arrayOfObjects'][number];
      
      expectTypeOf<ArrayElement>().toHaveProperty('id').toEqualTypeOf<number>();
      expectTypeOf<ArrayElement>().toHaveProperty('data').toMatchTypeOf<{
        readonly values: ReadonlyArray<string>;
      }>();
    });

    it('should handle mixed type arrays', () => {
      type ReadonlyComplex = DeepReadonly<ComplexStructure>;

      // Mixed array should preserve union types with readonly applied
      type MixedElement = ReadonlyComplex['mixedArray'][number];
      
      expectTypeOf<MixedElement>().toEqualTypeOf<string | number | { readonly key: string }>();
    });

    it('should handle Map types', () => {
      type ReadonlyCollection = DeepReadonly<CollectionStructure>;

      // Map should become ReadonlyMap with readonly key and value types
      expectTypeOf<ReadonlyCollection['metadata']>().toEqualTypeOf<
        ReadonlyMap<string, { readonly value: number }>
      >();
    });

    it('should handle Set types', () => {
      type ReadonlyCollection = DeepReadonly<CollectionStructure>;

      // Set should become ReadonlySet
      expectTypeOf<ReadonlyCollection['tags']>().toEqualTypeOf<ReadonlySet<string>>();
    });

    it('should handle nested collections', () => {
      type ReadonlyCollection = DeepReadonly<CollectionStructure>;

      // Nested Set with object elements
      expectTypeOf<ReadonlyCollection['nestedCollections']['items']>().toEqualTypeOf<
        ReadonlySet<{ readonly id: number; readonly name: string }>
      >();

      // Nested Map with array values
      expectTypeOf<ReadonlyCollection['nestedCollections']['mapping']>().toEqualTypeOf<
        ReadonlyMap<number, ReadonlyArray<string>>
      >();
    });

    it('should handle primitives without modification', () => {
      type ReadonlyString = DeepReadonly<string>;
      type ReadonlyNumber = DeepReadonly<number>;
      type ReadonlyBoolean = DeepReadonly<boolean>;
      type ReadonlyNull = DeepReadonly<null>;
      type ReadonlyUndefined = DeepReadonly<undefined>;

      expectTypeOf<ReadonlyString>().toEqualTypeOf<string>();
      expectTypeOf<ReadonlyNumber>().toEqualTypeOf<number>();
      expectTypeOf<ReadonlyBoolean>().toEqualTypeOf<boolean>();
      expectTypeOf<ReadonlyNull>().toEqualTypeOf<null>();
      expectTypeOf<ReadonlyUndefined>().toEqualTypeOf<undefined>();
    });

    it('should work with union types', () => {
      type UnionType = { a: string } | { b: number };
      type ReadonlyUnion = DeepReadonly<UnionType>;

      expectTypeOf<ReadonlyUnion>().toEqualTypeOf<
        { readonly a: string } | { readonly b: number }
      >();
    });

    it('should work with intersection types', () => {
      type Base = { id: number };
      type Extended = Base & { name: string; nested: { value: string } };
      type ReadonlyExtended = DeepReadonly<Extended>;

      expectTypeOf<ReadonlyExtended>().toMatchTypeOf<{
        readonly id: number;
        readonly name: string;
        readonly nested: { readonly value: string };
      }>();
    });

    it('should handle empty objects and arrays', () => {
      type EmptyObject = DeepReadonly<{}>;
      type EmptyArray = DeepReadonly<never[]>;

      expectTypeOf<EmptyObject>().toEqualTypeOf<{}>();
      expectTypeOf<EmptyArray>().toEqualTypeOf<ReadonlyArray<never>>();
    });

    it('should handle tuple types', () => {
      type Tuple = [string, number, { value: string }];
      type ReadonlyTuple = DeepReadonly<Tuple>;

      // Tuples are treated as arrays, so they become ReadonlyArray
      expectTypeOf<ReadonlyTuple>().toEqualTypeOf<
        ReadonlyArray<string | number | { readonly value: string }>
      >();
    });
  });

  describe('real-world scenarios', () => {
    it('should work with API response types', () => {
      interface ApiResponse {
        status: number;
        data: {
          users: Array<{
            id: string;
            profile: {
              name: string;
              email: string;
              preferences: {
                notifications: boolean;
                theme: string;
              };
            };
          }>;
          metadata: {
            total: number;
            page: number;
          };
        };
      }

      type ReadonlyResponse = DeepReadonly<ApiResponse>;

      // Verify deep nesting is readonly
      type UserProfile = ReadonlyResponse['data']['users'][number]['profile'];
      expectTypeOf<UserProfile>().toMatchTypeOf<{
        readonly name: string;
        readonly email: string;
        readonly preferences: {
          readonly notifications: boolean;
          readonly theme: string;
        };
      }>();
    });

    it('should work with configuration objects', () => {
      interface Config {
        server: {
          host: string;
          port: number;
          ssl: {
            enabled: boolean;
            cert: string;
            key: string;
          };
        };
        database: {
          connections: Array<{
            name: string;
            url: string;
            options: Map<string, string>;
          }>;
        };
        features: Set<string>;
      }

      type ReadonlyConfig = DeepReadonly<Config>;

      // Verify all levels are readonly
      expectTypeOf<ReadonlyConfig['server']['ssl']>().toMatchTypeOf<{
        readonly enabled: boolean;
        readonly cert: string;
        readonly key: string;
      }>();

      expectTypeOf<ReadonlyConfig['database']['connections']>().toEqualTypeOf<
        ReadonlyArray<{
          readonly name: string;
          readonly url: string;
          readonly options: ReadonlyMap<string, string>;
        }>
      >();

      expectTypeOf<ReadonlyConfig['features']>().toEqualTypeOf<ReadonlySet<string>>();
    });
  });
});
