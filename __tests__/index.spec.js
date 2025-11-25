const { SchemaFactory } = require("..");

describe("SchemaFactory and Schema behavior", () => {
  const schemaFactory = new SchemaFactory();

  test("should instantiate SchemaFactory correctly", () => {
    expect(schemaFactory).toBeInstanceOf(SchemaFactory);
  });

  test("should create a schema object with parse method", () => {
    const schema = schemaFactory.createSchema({});
    expect(schema).toHaveProperty("parse");
    expect(typeof schema.parse).toBe("function");
  });

  test("should validate inputs correctly with simple shape", () => {
    const shape = {
      id: [String],
      field: [Number],
    };

    const validInput = { id: "", field: 42 };
    const invalidInput = {};

    const schema = schemaFactory.createSchema(shape);

    expect(schema.validate(validInput)).toBe(true);
    expect(schema.validate(invalidInput)).toBe(false);
  });

  test("should validate and extract complex nested input successfully", () => {
    const validShape = {
      name: [String],
      age: [Number],
      tags: [[String]],
      active: [Boolean],
      meta: [
        {
          verified: [Boolean],
          score: [Number],
          note: [null, String],
        },
      ],
      misc: [null, String, Number],
      config: [
        {
          level: [Number],
          options: [[String, Number]],
        },
      ],
      friends: [
        [
          {
            id: [String],
            data: [
              String,
              {
                email: [String],
                phone: [String],
              },
            ],
          },
        ],
      ],
      matrix: [[[Number]]],
      mixedMatrix: [[[String, Number]]],
      settings: [
        {
          theme: [String],
          nested: [
            {
              experimental: [Boolean],
            },
          ],
        },
      ],
      optionalNote: [undefined, String],
      complex: [[String, [Number]]],
    };

    const input1 = {
      name: "John",
      age: 42,
      tags: ["one", "two"],
      active: true,
      meta: {
        verified: false,
        score: 88,
        note: null,
      },
      misc: "text",
      config: {
        level: 3,
        options: ["fast", 100, "slow", 200],
      },
      friends: [
        {
          id: "f1",
          data: "simple",
        },
        {
          id: "f2",
          data: {
            email: "a@b.c",
            phone: "1234567890",
          },
        },
      ],
      matrix: [[1, 2], [3], [4]],
      mixedMatrix: [
        ["x", 1],
        ["y", 2],
        [3, "z"],
      ],
      settings: {
        theme: "dark",
        nested: {
          experimental: true,
        },
      },
      optionalNote: undefined,
      complex: ["val", [1, 2, 3], "another", [42]],
    };

    const input2 = {
      name: "Jane",
      age: 35,
      tags: ["alpha", "beta"],
      active: false,
      meta: {
        verified: true,
        score: 99,
        note: "passed",
      },
      misc: 77,
      config: {
        level: 1,
        options: [300, "eco", "turbo", 400],
      },
      friends: [
        {
          id: "f3",
          data: "hello",
        },
        {
          id: "f4",
          data: {
            email: "x@y.z",
            phone: "9876543210",
          },
        },
      ],
      matrix: [[10], [20, 30], [40]],
      mixedMatrix: [
        [1, "a"],
        ["b", 2],
        [3, "c"],
      ],
      settings: {
        theme: "light",
        nested: {
          experimental: false,
        },
      },
      optionalNote: "optional string",
      complex: [[99], "extra", [100], "deep"],
    };

    const schema = schemaFactory.createSchema(validShape);

    const result1 = schema.parse(input1);
    expect(result1.success).toBe(true);
    expect(result1.entity).toEqual(input1);

    const result2 = schema.parse(input2);
    expect(result2.success).toBe(true);
    expect(result2.entity).toEqual(input2);
  });

  test("should correctly validate union type fields in shape", () => {
    const firstShape = { str: [String] };
    const secondShape = { num: [Number] };

    const shape = {
      field: [firstShape, secondShape],
    };

    const validFirst = {
      field: { str: "" },
    };

    const invalidSecond = {
      field: { bool: 42 },
    };

    const schema = schemaFactory.createSchema(shape);

    const result1 = schema.parse(validFirst);
    expect(result1.success).toBe(true);
    expect(result1.entity).toEqual(validFirst);

    const result2 = schema.parse(invalidSecond);
    expect(result2.success).toBe(false);
    expect(result2.keys).toEqual([["field.str"], ["field.num"]]);
  });

  test("should validate union shapes properly", () => {
    const firstShape = { id: [String] };
    const secondShape = { field: [Number] };

    const firstValid = { id: "" };
    const secondValid = { field: 42 };
    const invalid = {};

    const schema = schemaFactory.createSchema([firstShape, secondShape]);

    const result1 = schema.parse(firstValid);
    expect(result1.success).toBe(true);
    expect(result1.entity).toEqual(firstValid);

    const result2 = schema.parse(secondValid);
    expect(result2.success).toBe(true);
    expect(result2.entity).toEqual(secondValid);

    const result3 = schema.parse(invalid);
    expect(result3.success).toBe(false);
    expect(result3.keys).toEqual([["id"], ["field"]]);
  });

  test("should fail validation and return error keys for invalid input", () => {
    const validShape = {
      name: [String],
      age: [Number],
      tags: [[String]],
    };

    const invalidInput = {
      name: 123,
      age: "not a num",
      tags: [1],
    };

    const schema = schemaFactory.createSchema(validShape);
    const result = schema.parse(invalidInput);

    expect(result.success).toBe(false);
    expect(result.keys).toContain("name");
    expect(result.keys).toContain("age");
    expect(result.keys).toContain("tags.0");
    expect(result.entity).toBeUndefined();
  });

  test("parseArray should return success when all elements are valid", () => {
    const shape = {
      id: [String],
      value: [Number],
    };

    const input = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
      { id: "c", value: 3 },
    ];

    const schema = schemaFactory.createSchema(shape);
    const result = schema.parseArray(input);

    console.log(result);

    expect(result.success).toBe(true);
    expect(result.entity).toEqual(input);
  });

  test("parseArray should return keys if some elements are invalid", () => {
    const shape = {
      id: [String],
      value: [Number],
    };

    const input = [
      { id: "a", value: 1 },
      { id: "b", value: "wrong" },
      { id: 42, value: 3 },
    ];

    const schema = schemaFactory.createSchema(shape);
    const result = schema.parseArray(input);

    console.log(result);

    expect(result.success).toBe(false);
    expect(result.keys).toEqual([[], ["value"], ["id"]]);
  });

  test("validateArray should work correctly", () => {
    const shape = {
      id: [String],
      active: [Boolean],
    };

    const schema = schemaFactory.createSchema(shape);

    const validArray = [
      { id: "1", active: true },
      { id: "2", active: false },
    ];

    const invalidArray = [
      { id: "1", active: true },
      { id: 123, active: false },
    ];

    expect(schema.validateArray(validArray)).toBe(true);
    expect(schema.validateArray(invalidArray)).toBe(false);

    expect(() => schema.validateArray("not an array")).toThrow("Candidate is not array");
  });

  test("createCollection should create multiple schemas", () => {
    const collection = schemaFactory.createCollection({
      user: { name: [String], age: [Number] },
      post: { title: [String], views: [Number] },
      comment: { text: [String], userId: [String] },
    });

    expect(collection.user).toHaveProperty("parse");
    expect(collection.post).toHaveProperty("parse");
    expect(collection.comment).toHaveProperty("parse");

    const userResult = collection.user.parse({ name: "Alice", age: 30 });
    expect(userResult.success).toBe(true);

    const postResult = collection.post.parse({ title: "Hello", views: 100 });
    expect(postResult.success).toBe(true);

    const invalidUser = collection.user.parse({ name: 123, age: "wrong" });
    expect(invalidUser.success).toBe(false);
  });

  test("should handle edge cases with null and undefined inputs", () => {
    const schema = schemaFactory.createSchema({ name: [String] });

    const nullResult = schema.parse(null);
    expect(nullResult.success).toBe(false);

    const undefinedResult = schema.parse(undefined);
    expect(undefinedResult.success).toBe(false);

    const arrayResult = schema.parse([]);
    expect(arrayResult.success).toBe(false);

    const numberResult = schema.parse(42);
    expect(numberResult.success).toBe(false);

    const stringResult = schema.parse("test");
    expect(stringResult.success).toBe(false);
  });

  test("should handle empty schema and empty arrays", () => {
    const emptySchema = schemaFactory.createSchema({});

    const result1 = emptySchema.parse({});
    expect(result1.success).toBe(true);
    expect(result1.entity).toEqual({});

    const result2 = emptySchema.parse({ extra: "field" });
    expect(result2.success).toBe(true);
    expect(result2.entity).toEqual({});

    const arraySchema = schemaFactory.createSchema({ items: [[String]] });
    const emptyArrayResult = arraySchema.parse({ items: [] });
    expect(emptyArrayResult.success).toBe(true);
    expect(emptyArrayResult.entity.items).toEqual([]);
  });

  test("should ignore extra fields in objects", () => {
    const schema = schemaFactory.createSchema({
      name: [String],
      age: [Number],
    });

    const input = {
      name: "Bob",
      age: 25,
      extra: "ignored",
      another: 123,
    };

    const result = schema.parse(input);
    expect(result.success).toBe(true);
    expect(result.entity).toEqual({ name: "Bob", age: 25 });
    expect(result.entity.extra).toBeUndefined();
  });

  test("should handle deeply nested structures", () => {
    const deepSchema = schemaFactory.createSchema({
      level1: [
        {
          level2: [
            {
              level3: [
                {
                  level4: [
                    {
                      value: [String],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const deepInput = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: "deep",
            },
          },
        },
      },
    };

    const result = deepSchema.parse(deepInput);
    expect(result.success).toBe(true);
    expect(result.entity).toEqual(deepInput);
  });

  test("should handle arrays with union types correctly", () => {
    const schema = schemaFactory.createSchema({
      mixed: [[String, Number, null]],
    });

    const input = {
      mixed: ["text", 42, null, "more", 100, null],
    };

    const result = schema.parse(input);
    expect(result.success).toBe(true);
    expect(result.entity).toEqual(input);
  });

  test("should provide correct error paths for nested validation failures", () => {
    const schema = schemaFactory.createSchema({
      users: [
        [
          {
            name: [String],
            contacts: [
              {
                email: [String],
              },
            ],
          },
        ],
      ],
    });

    const input = {
      users: [
        { name: "Alice", contacts: { email: "alice@test.com" } },
        { name: 123, contacts: { email: 456 } },
      ],
    };

    const result = schema.parse(input);
    expect(result.success).toBe(false);
    expect(result.keys).toContain("users.1.name");
    expect(result.keys).toContain("users.1.contacts.email");
  });
});
