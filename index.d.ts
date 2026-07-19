/**
 * Represents the tuple of decreasing depth counters used to bound recursive inference.
 */
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Represents a brand that forbids symbol keys on entities.
 */
type NeverSymbol = Record<symbol, never>;

/**
 * Flattens an intersection into a single object type for readable hovers.
 */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Converts a union type into every tuple of its members, so the options of a
 * field may be listed in any order while the set itself stays exhaustive.
 */
type Permutation<T, U = T> = [T] extends [never] ? [] : U extends U ? [U, ...Permutation<Exclude<T, U>>] : never;

/**
 * Represents the primitive schema tokens. `Date` is supported for non-JSON sources such as database rows.
 */
export type Tokens = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor | null | undefined;

/**
 * Represents anything that can appear in a field position of a shape:
 * a primitive token, a nested shape, or a list of definitions.
 */
export type TokenDefinition = Tokens | AbstractShape | ReadonlyArray<TokenDefinition>;

/**
 * Represents a runtime shape definition.
 * @example
 * const userShape = {
 *   name: [String],
 *   age: [Number],
 *   note: [null, String],
 *   tags: [[String]],
 * } as const;
 */
export type AbstractShape = {
  [key: string]: TokenDefinition;
};

/**
 * The key of a record shape: `{ "*": definition }` validates every own enumerable value of the candidate.
 * Cannot be combined with other keys.
 * @example
 * const dictShape = { [WILDCARD_KEY]: [String, Number] };
 */
export declare const WILDCARD_KEY: "*";

/**
 * Represents the primitive values an entity may contain.
 */
type Types = string | number | boolean | Date | null | undefined;

/**
 * Represents any value an entity field may hold.
 */
type JSONValue = Types | JSONArray | Entity;

/**
 * Represents an array of entity values.
 */
type JSONArray = JSONValue[];

/**
 * Represents a plain data object composed of JSON-compatible values (plus `Date`).
 */
export type Entity = NeverSymbol & {
  [key: string]: JSONValue;
};

/**
 * Infers the schema token for a single entity value.
 */
type InferToken<T, D extends number> = [D] extends [0]
  ? never
  : T extends string
    ? StringConstructor
    : T extends number
      ? NumberConstructor
      : T extends boolean
        ? BooleanConstructor
        : T extends Date
          ? DateConstructor
          : T extends null | undefined
            ? T
            : T extends (infer U)[]
              ? Readonly<Permutation<InferToken<U, Depth[D]>>>
              : T extends Entity
                ? ShapeWithDepth<T, Depth[D]>
                : never;

/**
 * Derives a shape from an entity type with a bounded recursion depth.
 */
type ShapeWithDepth<T extends Entity, D extends number = 10> = {
  [K in keyof T]-?: Readonly<Permutation<InferToken<T[K], D>>>;
};

/**
 * Derives a runtime shape from an entity type (type -> shape).
 * Works with type aliases composed of JSON-compatible values; interfaces need an index signature.
 * @example
 * type Account = { id: string; amount: number; labels: string[] };
 * const accountShape: Shape<Account> = {
 *   id: [String],
 *   amount: [Number],
 *   labels: [[String]],
 * };
 */
export type Shape<T extends Entity> = {
  [K in keyof T]-?: Readonly<Permutation<InferToken<T[K], 10>>>;
};

/**
 * Infers the entity value type for a single schema token.
 */
type InferType<T, D extends number> = [D] extends [0]
  ? never
  : T extends StringConstructor
    ? string
    : T extends NumberConstructor
      ? number
      : T extends BooleanConstructor
        ? boolean
        : T extends DateConstructor
          ? Date
          : T extends null | undefined
            ? T
            : T extends ReadonlyArray<infer U>
              ? InferType<U, Depth[D]>[]
              : T extends AbstractShape
                ? InferEntityWithDepth<T, Depth[D]>
                : never;

/**
 * Infers the value type of a field definition, treating a list as a union of its options.
 */
type FieldType<T, D extends number> = T extends ReadonlyArray<infer U> ? InferType<U, D> : InferType<T, D>;

/**
 * Selects the keys whose definition admits `undefined`.
 */
type OptionalFieldKeys<T extends AbstractShape, D extends number> = {
  [K in keyof T]: undefined extends FieldType<T[K], D> ? K : never;
}[keyof T];

/**
 * Derives an entity type from a shape with a bounded recursion depth.
 * Fields whose definition admits `undefined` become optional: extraction omits keys absent from the candidate.
 */
export type InferEntityWithDepth<T extends AbstractShape, D extends number = 10> = "*" extends keyof T
  ? Record<string, FieldType<T["*"], D>>
  : Simplify<
      { [K in Exclude<keyof T, OptionalFieldKeys<T, D>>]: FieldType<T[K], D> } & {
        [K in OptionalFieldKeys<T, D>]?: FieldType<T[K], D>;
      }
    >;

/**
 * Derives an entity type from a runtime shape (shape -> type).
 * @example
 * const shape = { id: [String], note: [undefined, String] } as const;
 * type User = InferEntity<typeof shape>;
 * // { id: string; note?: string | undefined }
 */
export type InferEntity<T extends AbstractShape> = InferEntityWithDepth<T, 10>;

/**
 * Represents a primitive validation predicate.
 */
export type Predicate = (value: unknown) => boolean;

/**
 * Represents validation error paths. Dot notation addresses nested fields and array indices,
 * the root is addressed by the empty string, and a failed union contributes one nested group per option.
 * @example
 * ["users.1.name", ["f.s"], ["f.n"]]
 */
export type KeyErrors = Array<string | KeyErrors>;

/**
 * Represents the result of a safe parse: the typed data, the error paths,
 * or an exception thrown by the candidate itself.
 */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; keys: KeyErrors }
  | { success: false; error: unknown };

/**
 * Represents the result of a single validation pass.
 * `value` holds the extracted entity and is meaningful only when `errors` is empty.
 */
export type ValidationResult = {
  errors: KeyErrors;
  value: unknown;
};

/**
 * Interface for compiled validators produced by the factory.
 */
export interface IValidator {
  /**
   * Validates a value and extracts its whitelisted copy in a single pass.
   * @param { unknown } value - The value to validate.
   * @param { string } path - The error path prefix, empty at the root.
   * @returns { ValidationResult } The collected errors and the extracted value.
   */
  validate(value: unknown, path: string): ValidationResult;
}

/**
 * Interface for shape-driven parsing.
 */
export interface IShapeValidator {
  parse<T extends AbstractShape>(shape: T, candidate: unknown): InferEntity<T>;
  safeParse<T extends AbstractShape>(shape: T, candidate: unknown): SafeParseResult<InferEntity<T>>;
  validate<T extends AbstractShape>(shape: T, candidate: unknown): candidate is InferEntity<T>;
  parseArray<T extends AbstractShape>(shape: T, candidate: unknown): InferEntity<T>[];
  safeParseArray<T extends AbstractShape>(shape: T, candidate: unknown): SafeParseResult<InferEntity<T>[]>;
  validateArray<T extends AbstractShape>(shape: T, candidate: unknown): candidate is InferEntity<T>[];
}

/**
 * Thrown at schema-compile time when a shape contains an unsupported definition:
 * an unknown token, an empty union, or a wildcard combined with other keys.
 * Escapes the safe methods too - a broken shape is a programmer error, not a data error.
 */
export declare class UnsupportedValidatorError extends Error {
  readonly definition: unknown;
  constructor(definition: unknown);
}

/**
 * Thrown by `parse` and `parseArray` when the candidate does not match the shape.
 */
export declare class ValidationFailedError extends Error {
  readonly keys: KeyErrors;
  constructor(keys: KeyErrors);
}

/**
 * Thrown by `parseArray` and captured by `safeParseArray` when the candidate is not an array.
 */
export declare class CandidateNotArrayError extends Error {
  constructor();
}

/**
 * The predicates behind the primitive tokens. `Number` rejects `NaN`.
 */
export declare const PRIMITIVE_PREDICATES: ReadonlyMap<TokenDefinition, Predicate>;

/**
 * Compiles shapes into validators, caching them by shape identity:
 * reusing one shape object costs one compilation.
 */
export declare class ValidatorFactory {
  /**
   * Compiles a shape into a validator or returns the cached one.
   * @param { AbstractShape } shape - The shape to compile.
   * @returns { IValidator } The compiled validator.
   * @example
   * const validator = factory.compile(userShape);
   */
  compile(shape: AbstractShape): IValidator;
}

/**
 * The stateless entry point; one instance can be shared for the whole application.
 * Validation and extraction happen in a single pass over own enumerable properties:
 * each property is read exactly once and the result is a fresh copy
 * containing only the keys declared in the shape.
 * @example
 * const validator = new Validator();
 * const user = validator.parse(userShape, request.body);
 */
export declare class Validator implements IShapeValidator {
  constructor(validatorFactory?: ValidatorFactory);

  /**
   * Validates the candidate and returns the typed entity.
   * @template T
   * @param { T } shape - The shape to validate against.
   * @param { unknown } candidate - The value to validate.
   * @returns { InferEntity<T> } The extracted entity.
   * @throws { ValidationFailedError } When the candidate does not match; carries the error paths in `keys`.
   * @example
   * const user = validator.parse({ name: [String] }, { name: "Alice" });
   */
  parse<T extends AbstractShape>(shape: T, candidate: unknown): InferEntity<T>;

  /**
   * Validates the candidate without throwing on data errors.
   * @template T
   * @param { T } shape - The shape to validate against.
   * @param { unknown } candidate - The value to validate.
   * @returns { SafeParseResult<InferEntity<T>> } The data, the error paths, or a captured exception.
   * @example
   * const result = validator.safeParse(userShape, request.body);
   * if (result.success) console.log(result.data);
   */
  safeParse<T extends AbstractShape>(shape: T, candidate: unknown): SafeParseResult<InferEntity<T>>;

  /**
   * Checks the candidate against the shape and narrows it to the inferred entity type.
   * Nothing is extracted: the candidate keeps its own identity and its extra keys.
   * @template T
   * @param { T } shape - The shape to validate against.
   * @param { unknown } candidate - The value to check.
   * @returns { boolean } `true` if the candidate matches, narrowing it to `InferEntity<T>`.
   * @example
   * if (validator.validate(userShape, payload)) payload.name.toUpperCase();
   */
  validate<T extends AbstractShape>(shape: T, candidate: unknown): candidate is InferEntity<T>;

  /**
   * Checks that the candidate is an array whose every element matches the shape,
   * and narrows it to the inferred entity array. A non-array candidate is `false`, never a throw.
   * @template T
   * @param { T } shape - The shape each element must match.
   * @param { unknown } candidate - The value to check.
   * @returns { boolean } `true` if every element matches, narrowing the candidate to `InferEntity<T>[]`.
   * @example
   * if (validator.validateArray(userShape, rows)) rows.forEach((row) => row.name);
   */
  validateArray<T extends AbstractShape>(shape: T, candidate: unknown): candidate is InferEntity<T>[];

  /**
   * Validates an array of entities against one shape.
   * @template T
   * @param { T } shape - The shape each element must match.
   * @param { unknown } candidate - The array to validate.
   * @returns { InferEntity<T>[] } The extracted entities.
   * @throws { CandidateNotArrayError } When the candidate is not an array.
   * @throws { ValidationFailedError } When elements do not match; `keys` holds one group per element.
   * @example
   * const users = validator.parseArray(userShape, rows);
   */
  parseArray<T extends AbstractShape>(shape: T, candidate: unknown): InferEntity<T>[];

  /**
   * Validates an array of entities without throwing on data errors.
   * @template T
   * @param { T } shape - The shape each element must match.
   * @param { unknown } candidate - The array to validate.
   * @returns { SafeParseResult<InferEntity<T>[]> } The entities, the per-element error paths, or a captured exception.
   * @example
   * const result = validator.safeParseArray(userShape, rows);
   * if (!result.success && "keys" in result) console.log(result.keys); // [[], ["value"], ["id"]]
   */
  safeParseArray<T extends AbstractShape>(shape: T, candidate: unknown): SafeParseResult<InferEntity<T>[]>;
}
