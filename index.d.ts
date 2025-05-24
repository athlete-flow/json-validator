type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type NeverSymbol = Record<symbol, never>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type LastOf<T> = UnionToIntersection<T extends any ? (x: T) => void : never> extends (x: infer L) => void ? L : never;

type UnionToTuple<T, R extends any[] = []> = [T] extends [never]
  ? R
  : UnionToTuple<Exclude<T, LastOf<T>>, [LastOf<T>, ...R]>;

type Tokens = StringConstructor | NumberConstructor | BooleanConstructor | null | undefined;

type TokenDefinition = Tokens | AbstractShape | ReadonlyArray<TokenDefinition | AbstractShape>;

export type AbstractShape = {
  [key: string]: TokenDefinition;
};

type InferToken<T, D extends number> = [D] extends [0]
  ? never
  : T extends string
  ? StringConstructor
  : T extends number
  ? NumberConstructor
  : T extends boolean
  ? BooleanConstructor
  : T extends null | undefined
  ? T
  : T extends (infer U)[]
  ? Readonly<UnionToTuple<InferToken<U, Depth[D]>>>
  : T extends Record<string, any>
  ? ShapeWithDepth<T, Depth[D]>
  : never;

type ShapeWithDepth<T extends Entity, D extends number = 10> = {
  [K in keyof T]-?: Readonly<UnionToTuple<InferToken<T[K], D>>>;
};

export type Shape<T extends Entity> = {
  [K in keyof T]-?: Readonly<UnionToTuple<InferToken<T[K], 10>>>;
};

type Types = string | number | boolean | null | undefined;

type JSONValue = Types | JSONArray | Entity;

type JSONArray = JSONValue[];

export type Entity = NeverSymbol & {
  [key: string]: JSONValue;
};

type InferType<T, D extends number> = [D] extends [0]
  ? never
  : T extends StringConstructor
  ? string
  : T extends NumberConstructor
  ? number
  : T extends BooleanConstructor
  ? boolean
  : T extends null | undefined
  ? T
  : T extends Array<infer U>
  ? InferType<U, Depth[D]>[]
  : T extends AbstractShape
  ? InferEntityWithDepth<T, Depth[D]>
  : never;

export type InferEntityWithDepth<T extends AbstractShape, D extends number = 10> = {
  [K in keyof T]: T[K] extends (infer U)[] ? InferType<U, D> : never;
};

export type InferEntity<T extends AbstractShape> = {
  [K in keyof T]: T[K] extends (infer U)[] ? InferType<U, 10> : never;
};

type Keys<D extends number> = D extends 0 ? string[] : Array<string | Keys<Depth[D]>>;

type Collection<T extends object> = {
  [K in keyof T]: T[K] extends Shape<infer U> ? (U extends Entity ? ISchema<U> : naver) : ISchema<InferEntity<T[K]>>;
};

export type ParseResult<T extends Entity> =
  | { success: true; entity: T }
  | { success: false; keys: Keys<10> }
  | { success: false; errors: unknown };

export interface ISchema<T extends Entity> {
  parse(candidate: unknown): ParseResult<T>;
  validate(candidate: unknown): candidate is T;

  parseArray(candidate: unknown): ParseResult<T[]>;
  validateArray(candidate: unknown): candidate is T[];
}

export declare class SchemaFactory {
  createSchema<T extends Entity>(shape: Shape<T>): ISchema<T>;
  createSchema<T extends AbstractShape>(shape: T): ISchema<InferEntity<T>>;
  createSchema<T extends Entity[]>(shape: { [K in keyof T]: Shape<T[K]> }): ISchema<T[number]>;
  createSchema<T extends AbstractShape[]>(shape: { [K in keyof T]: T[K] }): ISchema<InferEntity<T[number]>>;

  createCollection<T extends Record<string, AbstractShape>>(shapes: T): Collection<T>;
  createCollection<T extends Record<string, Shape>>(shapes: T): Collection<T>;
}
