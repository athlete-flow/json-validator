# athlete-json-validator

TypeScript-compatible JSON schema validation library with strong type inference.

## Features

- 🔒 **Type-safe** - Full TypeScript support with automatic type inference
- 🚀 **Fast** - Optimized validation with WeakMap for efficient memory management
- 📦 **Zero dependencies** - Lightweight and easy to integrate
- 🎯 **Simple API** - Intuitive schema definition syntax
- 🔄 **Union types** - Support for multiple valid types
- 📐 **Deep validation** - Nested objects and arrays with unlimited depth
- 🧩 **Composable** - Create collections of related schemas

## Installation

```bash
npm install athlete-json-validator
```

## Quick Start

```javascript
const { SchemaFactory } = require('athlete-json-validator');

const schemaFactory = new SchemaFactory();

// Define a schema
const userSchema = schemaFactory.createSchema({
  name: [String],
  age: [Number],
  email: [String],
  active: [Boolean],
});

// Validate and parse data
const result = userSchema.parse({
  name: "Alice",
  age: 30,
  email: "alice@example.com",
  active: true,
});

if (result.success) {
  console.log("Valid:", result.entity);
} else {
  console.log("Invalid fields:", result.keys);
}
```

## API Reference

### SchemaFactory

#### `createSchema(shape)`

Creates a validation schema from a shape definition.

```javascript
const schema = schemaFactory.createSchema({
  field: [Type],
});
```

**Supported types:**
- `String` - string values
- `Number` - number values
- `Boolean` - boolean values
- `null` - null value
- `undefined` - undefined value
- `[Type]` - array of Type
- `{...}` - nested object
- `[Type1, Type2]` - union (either Type1 or Type2)

#### `createCollection(shapes)`

Creates a collection of related schemas.

```javascript
const collection = schemaFactory.createCollection({
  user: { name: [String], age: [Number] },
  post: { title: [String], content: [String] },
});

const userResult = collection.user.parse(data);
```

### Schema Methods

#### `parse(candidate)`

Validates and extracts data. Returns `ParseResult<T>`.

```javascript
const result = schema.parse(data);

if (result.success) {
  // result.entity contains validated data
} else if (result.keys) {
  // result.keys contains error paths
} else if (result.error) {
  // result.error contains exception
}
```

#### `validate(candidate)`

Returns `true` if valid, `false` otherwise. Type guard in TypeScript.

```javascript
if (schema.validate(data)) {
  // data is now typed as T
}
```

#### `parseArray(candidate)`

Validates an array of items.

```javascript
const result = schema.parseArray([item1, item2, item3]);
```

#### `validateArray(candidate)`

Boolean validation for arrays. Throws if input is not an array.

```javascript
if (schema.validateArray(data)) {
  // all items are valid
}
```

## Examples

### Basic Types

```javascript
const schema = schemaFactory.createSchema({
  name: [String],
  age: [Number],
  active: [Boolean],
  meta: [null, String],  // null or string
  optional: [undefined, Number],  // undefined or number
});
```

### Arrays

```javascript
const schema = schemaFactory.createSchema({
  tags: [[String]],  // array of strings
  matrix: [[[Number]]],  // 2D array of numbers
});
```

### Nested Objects

```javascript
const schema = schemaFactory.createSchema({
  user: [{
    name: [String],
    contacts: [{
      email: [String],
      phone: [String],
    }],
  }],
});
```

### Union Types

```javascript
// Field-level union
const schema = schemaFactory.createSchema({
  value: [String, Number, null],  // string OR number OR null
});

// Schema-level union
const schema = schemaFactory.createSchema([
  { id: [String] },
  { num: [Number] },
]);
// Accepts either shape
```

### Arrays of Objects

```javascript
const schema = schemaFactory.createSchema({
  users: [[{
    name: [String],
    age: [Number],
  }]],
});

const result = schema.parse({
  users: [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ],
});
```

### Complex Example

```javascript
const schema = schemaFactory.createSchema({
  id: [String],
  profile: [{
    name: [String],
    age: [Number],
    tags: [[String]],
    settings: [{
      theme: [String],
      notifications: [Boolean],
    }],
  }],
  friends: [[{
    id: [String],
    data: [
      String,  // simple string OR
      {        // complex object
        email: [String],
        phone: [String],
      },
    ],
  }]],
  metadata: [null, {
    created: [String],
    updated: [String],
  }],
});
```

## Error Handling

### Error Paths

Error paths use dot notation for nested fields and array indices:

```javascript
const result = schema.parse({
  users: [
    { name: "Alice", age: 30 },
    { name: 123, age: "invalid" },  // errors here
  ],
});

if (!result.success) {
  console.log(result.keys);
  // ["users.1.name", "users.1.age"]
}
```

### Union Errors

For union types, errors are grouped by option:

```javascript
const schema = schemaFactory.createSchema({
  field: [
    { a: [String] },
    { b: [Number] },
  ],
});

const result = schema.parse({ field: { c: 123 } });

if (!result.success) {
  console.log(result.keys);
  // [["field.a"], ["field.b"]]
  // First option failed on "field.a"
  // Second option failed on "field.b"
}
```

## TypeScript Support

Full type inference with TypeScript:

```typescript
import { SchemaFactory } from 'athlete-json-validator';

const schemaFactory = new SchemaFactory();

const schema = schemaFactory.createSchema({
  name: [String],
  age: [Number],
  tags: [[String]],
} as const);

const result = schema.parse(data);

if (result.success) {
  // result.entity is typed as:
  // { name: string; age: number; tags: string[] }
}
```

## Performance

- **WeakMap-based caching** - Automatic memory management for object references
- **Early exit** - Validation stops on first success in unions
- **Minimal overhead** - Direct validation without intermediate structures

## License

ISC

## Author

Denis Redcade
