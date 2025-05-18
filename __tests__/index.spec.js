const { SchemaFactory } = require("..");

describe("Framework", () => {
  const schemaFactory = new SchemaFactory();

  test("should initialize the schema factory", () => {
    expect(schemaFactory).toBeInstanceOf(SchemaFactory);
  });

  test("should create a schema from valid shape", () => {
    const schema = schemaFactory.createSchema({});
    expect(schema).toHaveProperty("parse");
    expect(typeof schema.parse).toBe("function");
  });

  test("should validate and extract full input with complex shape", () => {
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
    expect(result1.clone).toEqual(input1);

    const result2 = schema.parse(input2);
    expect(result2.success).toBe(true);
    expect(result2.clone).toEqual(input2);
  });

  test("should fail validation and return error keys", () => {
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
    expect(result.clone).toBeUndefined();
  });
});
