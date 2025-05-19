type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export type NeverSymbol = Record<symbol, never>;

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type LastOf<T> = UnionToIntersection<T extends any ? (x: T) => void : never> extends (x: infer L) => void
  ? L
  : never;

export type UnionToTuple<T, R extends any[] = []> = [T] extends [never]
  ? R
  : UnionToTuple<Exclude<T, LastOf<T>>, [LastOf<T>, ...R]>;

type Tokens = StringConstructor | NumberConstructor | BooleanConstructor | null | undefined;
export type TokenDefinition = Tokens | AbstractShape | (TokenDefinition | AbstractShape)[];

export type AbstractShape = {
  [key: string]: TokenDefinition;
};

export type InferToken<T, D extends number> = [D] extends [0]
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
  ? UnionToTuple<InferToken<U, Depth[D]>>
  : T extends Record<string, any>
  ? Shape<T, Depth[D]>
  : never;

export type Shape<T extends Entity, D extends number = 10> = {
  [K in keyof T]-?: UnionToTuple<InferToken<T[K], D>>;
};

type Types = string | number | boolean | null | undefined;

export type JSONValue = Types | JSONArray | Entity;

export type JSONArray = JSONValue[];

export type Entity = NeverSymbol & {
  [key: string]: JSONValue;
};

export type InferType<T, D extends number> = [D] extends [0]
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
  ? InferEntity<T, Depth[D]>
  : never;

export type InferEntity<T extends AbstractShape, D extends number = 10> = {
  [K in keyof T]: T[K] extends (infer U)[] ? InferType<U, D> : never;
};

export type ParseResult<T extends Entity> =
  | { success: true; entity: T }
  | { success: false; keys: string[]; errors: unknown };

export interface ISchema<T extends Entity> {
  parse(candidate: unknown): ParseResult<T>;
  validate(candidate: unknown): candidate is T;
}

export declare class SchemaFactory {
  createSchema<T extends AbstractShape>(shape: T): ISchema<InferEntity<T>>;
  createSchema<T extends Entity>(shape: Shape<T>): ISchema<T>;
}
