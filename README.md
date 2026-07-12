# athlete-json-validator

Schema validation for plain data with strong TypeScript type inference. Zero dependencies.

Define a shape with constructor tokens, get back a typed, whitelisted copy of the input:

```typescript
import { Validator } from "athlete-json-validator";

const validator = new Validator();

const userShape = {
  name: [String],
  age: [Number],
  tags: [[String]],
} as const;

const user = validator.parse(userShape, input);
// user: { name: string; age: number; tags: string[] }
// throws ValidationFailedError if input does not match
```

## Installation

```bash
npm install athlete-json-validator
```

## Shape syntax

A shape is a plain object. Each field holds a definition:

| Definition            | Matches                                       |
| --------------------- | --------------------------------------------- |
| `String`              | `string`                                      |
| `Number`              | `number` (`NaN` is rejected)                  |
| `Boolean`             | `boolean`                                     |
| `Date`                | `Date` instance (for DB rows, non-JSON data)  |
| `null`                | `null`                                        |
| `undefined`           | `undefined` / missing key                     |
| `{ ... }`             | nested object shape                           |
| `[A, B, C]`           | union: `A` or `B` or `C`                      |
| `[[A]]`               | array of `A`                                  |
| `[[A, B]]`            | array of `A \| B`                             |
| `{ "*": A }`          | record: every value must match `A`            |

A field definition is a union list: `field: [String]` means "string", `field: [null, String]` means "null or string". A bare token without the list (`field: String`) is also accepted.

Inside a union list, a nested array switches meaning to "array of": `tags: [[String]]` reads as "union of one option: array of string".

```typescript
const shape = {
  id: [String],
  score: [Number],
  note: [null, String],            // string | null
  nickname: [undefined, String],   // optional: may be absent
  labels: [[String]],              // string[]
  matrix: [[[Number]]],            // number[][]
  profile: [{                      // nested object
    theme: [String],
    flags: [[Boolean]],
  }],
  contact: [String, {              // string OR object
    email: [String],
  }],
  translations: [{ "*": [String] }], // Record<string, string>
} as const;
```

### Records (wildcard)

A shape whose only key is `"*"` validates every own enumerable value of the candidate:

```typescript
const dict = validator.parse({ "*": [String, Number] }, { a: "x", b: 1 });
// dict: Record<string, string | number>
```

Combining `"*"` with other keys throws `UnsupportedValidatorError` — a record shape describes homogeneous values and cannot mix with fixed fields.

## API

### `new Validator(factory?)`

Stateless entry point; one instance can be shared for the whole application. Compiled shapes are cached by object identity in a `WeakMap`, so define shapes as module-level constants and reuse them — the first call compiles, subsequent calls hit the cache.

### `parse(shape, candidate)`

Returns the typed entity or throws:

- `ValidationFailedError` (with `.keys`) when the candidate does not match;
- `UnsupportedValidatorError` when the shape itself is invalid;
- whatever a candidate getter throws, unchanged.

```typescript
const user = validator.parse(userShape, req.body);
```

### `safeParse(shape, candidate)`

Never throws for data problems; returns a discriminated result:

```typescript
const result = validator.safeParse(userShape, req.body);
if (result.success) result.data;        // typed entity
else if ("keys" in result) result.keys; // error paths
else result.error;                      // exception thrown by the candidate itself
```

Invalid *shapes* still throw `UnsupportedValidatorError` — a broken schema is a programmer error, not a data error.

### `parseArray(shape, candidate)` / `safeParseArray(shape, candidate)`

Validate an array of entities against one shape. A non-array candidate produces `CandidateNotArrayError`. On failure, `keys` holds one group per element, empty for valid elements:

```typescript
validator.safeParseArray(shape, [ok, badValue, badId]);
// { success: false, keys: [[], ["value"], ["id"]] }
```

## Extraction semantics

`parse` returns a **fresh copy** containing only the keys declared in the shape:

- extra fields of the candidate are stripped;
- keys absent from the candidate are omitted from the result (relevant for `[undefined, ...]` unions);
- containers (objects, arrays) are newly built; primitive values and `Date` instances are carried over by reference;
- only **own enumerable** properties are read — values from a prototype chain are treated as absent;
- every property is read **exactly once**: validation and extraction happen in a single pass, so a getter cannot return one value to the validator and another to the result.

For unions the first matching option wins and drives extraction:

```typescript
validator.parse({ f: [{ a: [String] }, { b: [Number] }] }, { f: { a: "x", b: 1 } });
// { f: { a: "x" } } — first option matched, extracted through it
```

Arrays and `Date` instances are rejected where an object shape is expected — they are type mismatches, not objects.

## Error paths

`keys` uses dot notation for nested fields and array indices. The root is addressed by the empty string:

```typescript
validator.safeParse(shape, { users: [{ name: 1 }] });
// keys: ["users.0.name"]

validator.safeParse(shape, null);
// keys: [""]
```

A failed union contributes one nested group per option:

```typescript
validator.safeParse({ f: [{ s: [String] }, { n: [Number] }] }, { f: {} });
// keys: [["f.s"], ["f.n"]]
```

## Type inference

### Shape → type: `InferEntity<T>`

```typescript
import type { InferEntity } from "athlete-json-validator";

const shape = { id: [String], note: [undefined, String] } as const;
type Entity = InferEntity<typeof shape>;
// { id: string; note?: string | undefined }
```

Fields whose union admits `undefined` become optional — matching the runtime behaviour of omitting absent keys.

### Type → shape: `Shape<T>`

```typescript
import type { Shape } from "athlete-json-validator";

type Account = {
  id: string;
  amount: number;
  labels: string[];
};

const accountShape: Shape<Account> = {
  id: [String],
  amount: [Number],
  labels: [[String]],
};
```

`Shape<T>` works with type aliases composed of JSON-compatible values (plus `Date`). Interfaces need an index signature to qualify.

## License

ISC

## Author

Denis Redcade
