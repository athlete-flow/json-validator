export interface DeepArray<T> extends Array<T | DeepArray<T>> {}

export type NeverSymbol = Record<symbol, never>;

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type LastOf<T> = UnionToIntersection<T extends any ? (x: T) => void : never> extends (x: infer L) => void
  ? L
  : never;

export type UnionToTuple<T, R extends any[] = []> = [T] extends [never]
  ? R
  : UnionToTuple<Exclude<T, LastOf<T>>, [LastOf<T>, ...R]>;

export type ValidatorToken = StringConstructor | NumberConstructor | BooleanConstructor | null | undefined;
export type ValidatorDefinition = ValidatorToken | AbstractShape | DeepArray<ValidatorToken | AbstractShape>;
export type AbstractShape = Record<string, ValidatorDefinition[]>;
export type Types = string | number | boolean | null | undefined;
export type TypeDefinition = Types | Entity | DeepArray<Types | Entity>;

export type InferValidator<T> = T extends string
  ? StringConstructor
  : T extends number
  ? NumberConstructor
  : T extends boolean
  ? BooleanConstructor
  : T extends null | undefined
  ? T
  : T extends (infer U)[]
  ? UnionToTuple<InferValidator<U>>
  : T extends Record<string, any>
  ? Shape<T>
  : never;

type Shape<T> = {
  [K in keyof T]-?: UnionToTuple<InferValidator<T[K]>>;
};

export type InferType<T> = T extends StringConstructor
  ? string
  : T extends NumberConstructor
  ? number
  : T extends BooleanConstructor
  ? boolean
  : T extends null | undefined
  ? T
  : T extends AbstractShape
  ? InferEntity<T>
  : T extends Array<infer U>
  ? InferType<U>[]
  : never;

export type InferEntity<T extends AbstractShape> = {
  [K in keyof T]: T[K] extends (infer U)[] ? InferType<U> : never;
};

export type Entity = NeverSymbol & {
  [key: string]: TypeDefinition;
};

export type ParseResult<T extends AbstractShape | Entity> =
  | { success: true; clone: T extends AbstractShape ? InferEntity<T> : T }
  | { success: false; keys: string[]; errors: unknown };

export interface IShape<T extends AbstractShape | Entity> {
  parse(candidate: unknown): ParseResult<T>;
}

export interface ISchemaFactory {
  createSchema<T extends AbstractShape | Entity>(shape: T extends AbstractShape ? T : Shape<T>): ISchema<T>;
}

export interface SchemaFactoryConstructor {
  new (): ISchemaFactory;
  (): ISchemaFactory;
}

export declare const SchemaFactory: SchemaFactoryConstructor;
