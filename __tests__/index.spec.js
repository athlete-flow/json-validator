const {
  Validator,
  ValidatorFactory,
  PRIMITIVE_PREDICATES,
  WILDCARD_KEY,
  UnsupportedValidatorError,
  ValidationFailedError,
  CandidateNotArrayError,
} = require("..");

describe("primitive tokens", () => {
  const validator = new Validator();

  test("validates String, Number, Boolean, null, undefined and Date", () => {
    const shape = {
      s: [String],
      n: [Number],
      b: [Boolean],
      nul: [null],
      undef: [undefined],
      d: [Date],
    };
    const input = { s: "x", n: 1, b: true, nul: null, undef: undefined, d: new Date(0) };
    expect(validator.parse(shape, input)).toEqual(input);
  });

  test("rejects wrong primitive types with field paths", () => {
    const shape = { s: [String], n: [Number], b: [Boolean] };
    const result = validator.safeParse(shape, { s: 1, n: "x", b: 0 });
    expect(result).toEqual({ success: false, keys: ["s", "n", "b"] });
  });

  test("accepts bare tokens without array wrapper", () => {
    const shape = { s: String, n: Number };
    expect(validator.parse(shape, { s: "x", n: 1 })).toEqual({ s: "x", n: 1 });
  });

  test("rejects NaN behind Number but accepts Infinity", () => {
    expect(validator.safeParse({ n: [Number] }, { n: NaN })).toEqual({ success: false, keys: ["n"] });
    expect(validator.parse({ n: [Number] }, { n: Infinity })).toEqual({ n: Infinity });
  });

  test("Date accepts Date instances only", () => {
    expect(validator.safeParse({ d: [Date] }, { d: "2026-01-01" })).toEqual({ success: false, keys: ["d"] });
    const d = new Date(42);
    expect(validator.parse({ d: [Date] }, { d }).d).toBe(d);
  });
});

describe("object shapes", () => {
  const validator = new Validator();

  test("strips extra fields on extraction", () => {
    const shape = { name: [String], age: [Number] };
    const result = validator.parse(shape, { name: "Bob", age: 25, extra: "ignored" });
    expect(result).toEqual({ name: "Bob", age: 25 });
  });

  test("empty shape accepts any plain object and extracts nothing", () => {
    expect(validator.parse({}, { anything: 1 })).toEqual({});
  });

  test("missing key is validated as undefined and omitted from the entity", () => {
    const shape = { note: [undefined, String] };
    expect(validator.parse(shape, {})).toEqual({});
    expect(Object.hasOwn(validator.parse(shape, { note: undefined }), "note")).toBe(true);
    expect(validator.parse(shape, { note: "hi" })).toEqual({ note: "hi" });
    expect(validator.safeParse({ note: [String] }, {})).toEqual({ success: false, keys: ["note"] });
  });

  test("rejects non-object candidates at the root path", () => {
    const shape = { a: [String] };
    for (const candidate of [null, undefined, 42, "str", true]) {
      expect(validator.safeParse(shape, candidate)).toEqual({ success: false, keys: [""] });
    }
  });

  test("rejects arrays and Date instances where an object is expected", () => {
    expect(validator.safeParse({}, [])).toEqual({ success: false, keys: [""] });
    expect(validator.safeParse({ a: [undefined, String] }, [1, 2])).toEqual({ success: false, keys: [""] });
    expect(validator.safeParse({}, new Date())).toEqual({ success: false, keys: [""] });
    expect(validator.safeParse({ o: [{}] }, { o: [] })).toEqual({ success: false, keys: ["o"] });
  });

  test("ignores inherited properties", () => {
    const candidate = Object.create({ a: "inherited" });
    expect(validator.safeParse({ a: [String] }, candidate)).toEqual({ success: false, keys: ["a"] });
    candidate.a = "own";
    expect(validator.parse({ a: [String] }, candidate)).toEqual({ a: "own" });
  });

  test("builds fresh containers on extraction", () => {
    const shape = { tags: [[String]], meta: [{ a: [Number] }] };
    const input = { tags: ["x"], meta: { a: 1 } };
    const result = validator.parse(shape, input);
    expect(result).toEqual(input);
    expect(result.tags).not.toBe(input.tags);
    expect(result.meta).not.toBe(input.meta);
  });

  test("supports empty-string keys", () => {
    const result = validator.safeParse({ "": [[Number]] }, { "": ["x"] });
    expect(result).toEqual({ success: false, keys: ["0"] });
    expect(validator.parse({ "": [[Number]] }, { "": [1] })).toEqual({ "": [1] });
  });
});

describe("arrays", () => {
  const validator = new Validator();

  test("validates arrays of primitives and reports element paths", () => {
    const shape = { tags: [[String]] };
    expect(validator.parse(shape, { tags: [] })).toEqual({ tags: [] });
    expect(validator.parse(shape, { tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
    expect(validator.safeParse(shape, { tags: ["a", 1, "b", 2] })).toEqual({
      success: false,
      keys: ["tags.1", "tags.3"],
    });
    expect(validator.safeParse(shape, { tags: "not array" })).toEqual({ success: false, keys: ["tags"] });
  });

  test("validates nested arrays (matrix) and mixed unions inside arrays", () => {
    const shape = { matrix: [[[Number]]], mixed: [[String, Number, null]] };
    const input = { matrix: [[1, 2], [3], []], mixed: ["x", 1, null] };
    expect(validator.parse(shape, input)).toEqual(input);
    expect(validator.safeParse({ matrix: [[[Number]]] }, { matrix: [[1], ["x"]] })).toEqual({
      success: false,
      keys: ["matrix.1.0"],
    });
  });

  test("validates arrays of objects with deep error paths", () => {
    const shape = { users: [[{ name: [String], contacts: [{ email: [String] }] }]] };
    const input = {
      users: [
        { name: "Alice", contacts: { email: "alice@test.com" } },
        { name: 123, contacts: { email: 456 } },
      ],
    };
    const result = validator.safeParse(shape, input);
    expect(result.success).toBe(false);
    expect(result.keys).toContain("users.1.name");
    expect(result.keys).toContain("users.1.contacts.email");
  });
});

describe("unions", () => {
  const validator = new Validator();

  test("accepts any matching option and extracts through the matched one", () => {
    const shape = { data: [String, { email: [String], phone: [String] }] };
    expect(validator.parse(shape, { data: "simple" })).toEqual({ data: "simple" });
    expect(validator.parse(shape, { data: { email: "a@b.c", phone: "123", extra: 1 } })).toEqual({
      data: { email: "a@b.c", phone: "123" },
    });
  });

  test("first matching option wins", () => {
    const shape = { f: [{ a: [String] }, { b: [Number] }] };
    expect(validator.parse(shape, { f: { a: "x", b: 1 } })).toEqual({ f: { a: "x" } });
  });

  test("collects per-option error groups when no option matches", () => {
    const shape = { field: [{ str: [String] }, { num: [Number] }] };
    expect(validator.safeParse(shape, { field: { bool: 42 } })).toEqual({
      success: false,
      keys: [["field.str"], ["field.num"]],
    });
  });

  test("primitive unions repeat the path per failed option", () => {
    expect(validator.safeParse({ m: [null, String] }, { m: 5 })).toEqual({
      success: false,
      keys: [["m"], ["m"]],
    });
  });

  test("mixes flat and grouped keys for sibling failures", () => {
    const shape = { a: [String], f: [{ s: [String] }, { n: [Number] }] };
    expect(validator.safeParse(shape, { a: 1, f: {} })).toEqual({
      success: false,
      keys: ["a", ["f.s"], ["f.n"]],
    });
    expect(validator.safeParse(shape, { a: 1, f: false })).toEqual({
      success: false,
      keys: ["a", ["f"], ["f"]],
    });
  });

  test("unions inside arrays extract through the matched option", () => {
    const shape = { list: [[String, { v: [Number] }]] };
    const input = { list: ["a", { v: 1 }, "b"] };
    expect(validator.parse(shape, input)).toEqual(input);
  });
});

describe("record shapes (wildcard)", () => {
  const validator = new Validator();

  test("validates every own enumerable value against the wildcard definition", () => {
    const shape = { [WILDCARD_KEY]: [Number] };
    expect(validator.parse(shape, {})).toEqual({});
    expect(validator.parse(shape, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(validator.safeParse(shape, { a: 1, b: "x" })).toEqual({ success: false, keys: ["b"] });
  });

  test("supports unions inside the wildcard", () => {
    const shape = { "*": [String, Number] };
    expect(validator.parse(shape, { a: "x", b: 1 })).toEqual({ a: "x", b: 1 });
    expect(validator.safeParse(shape, { a: true })).toEqual({ success: false, keys: [["a"], ["a"]] });
  });

  test("supports nested shapes and records inside the wildcard", () => {
    const shape = { "*": [{ id: [String] }] };
    expect(validator.parse(shape, { one: { id: "1", extra: true } })).toEqual({ one: { id: "1" } });
    const nested = { "*": [{ "*": [Number] }] };
    expect(validator.parse(nested, { group: { a: 1 } })).toEqual({ group: { a: 1 } });
  });

  test("rejects arrays instead of silently converting them to objects", () => {
    expect(validator.safeParse({ "*": [Number] }, [1, 2, 3])).toEqual({ success: false, keys: [""] });
  });

  test("ignores inherited properties", () => {
    const candidate = Object.create({ hidden: "inherited" });
    candidate.own = "value";
    expect(validator.parse({ "*": [String] }, candidate)).toEqual({ own: "value" });
  });

  test("wildcard of undefined validates records of undefined values", () => {
    expect(validator.parse({ "*": undefined }, { a: undefined })).toEqual({ a: undefined });
    expect(validator.safeParse({ "*": undefined }, { a: 1 })).toEqual({ success: false, keys: ["a"] });
  });

  test("throws when the wildcard is combined with other keys", () => {
    expect(() => validator.parse({ "*": [String], id: [Number] }, {})).toThrow(UnsupportedValidatorError);
  });
});

describe("schema compilation errors", () => {
  const validator = new Validator();

  test("throws UnsupportedValidatorError for unsupported definitions", () => {
    expect(() => validator.parse({ a: 5 }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.parse({ a: [Symbol] }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.parse({ a: [class Foo {}] }, {})).toThrow("Unsupported validator definition");
  });

  test("throws for empty unions and empty array element unions", () => {
    expect(() => validator.parse({ a: [] }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.parse({ a: [[]] }, {})).toThrow(UnsupportedValidatorError);
  });

  test("schema errors escape safeParse and safeParseArray: broken shapes must fail loudly", () => {
    expect(() => validator.safeParse({ a: [] }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.safeParseArray({ a: [] }, [])).toThrow(UnsupportedValidatorError);
  });

  test("exposes the offending definition", () => {
    try {
      validator.parse({ a: 5 }, {});
    } catch (error) {
      expect(error.definition).toBe(5);
      expect(error.name).toBe("UnsupportedValidatorError");
    }
    expect.assertions(2);
  });
});

describe("single-pass guarantees", () => {
  const validator = new Validator();

  test("each property is read exactly once: unstable getters cannot bypass validation", () => {
    let reads = 0;
    const candidate = {
      get a() {
        reads++;
        return reads === 1 ? "ok" : 42;
      },
    };
    expect(validator.parse({ a: [String] }, candidate)).toEqual({ a: "ok" });
    expect(reads).toBe(1);
  });

  test("throwing getters propagate from parse and are captured by safeParse", () => {
    const boom = new Error("boom");
    const candidate = {
      get a() {
        throw boom;
      },
    };
    expect(() => validator.parse({ a: [String] }, candidate)).toThrow(boom);
    expect(validator.safeParse({ a: [String] }, candidate)).toEqual({ success: false, error: boom });
  });
});

describe("parse and safeParse results", () => {
  const validator = new Validator();

  test("parse throws ValidationFailedError carrying the keys", () => {
    try {
      validator.parse({ a: [String] }, { a: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailedError);
      expect(error.keys).toEqual(["a"]);
      expect(error.message).toBe('Validation failed: ["a"]');
    }
    expect.assertions(3);
  });

  test("safeParse returns data on success and keys on failure", () => {
    expect(validator.safeParse({ a: [String] }, { a: "x" })).toEqual({ success: true, data: { a: "x" } });
    expect(validator.safeParse({ a: [String] }, { a: 1 })).toEqual({ success: false, keys: ["a"] });
  });
});

describe("parseArray and safeParseArray", () => {
  const validator = new Validator();
  const shape = { id: [String], value: [Number] };

  test("returns all entities when every element is valid", () => {
    const input = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ];
    expect(validator.parseArray(shape, input)).toEqual(input);
    expect(validator.parseArray(shape, [])).toEqual([]);
    expect(validator.safeParseArray(shape, input)).toEqual({ success: true, data: input });
  });

  test("collects per-element key groups, empty for valid elements", () => {
    const input = [
      { id: "a", value: 1 },
      { id: "b", value: "wrong" },
      { id: 42, value: 3 },
    ];
    expect(validator.safeParseArray(shape, input)).toEqual({
      success: false,
      keys: [[], ["value"], ["id"]],
    });
    expect(() => validator.parseArray(shape, input)).toThrow(ValidationFailedError);
  });

  test("rejects non-array candidates", () => {
    expect(() => validator.parseArray(shape, "not an array")).toThrow(CandidateNotArrayError);
    const result = validator.safeParseArray(shape, { 0: "not array" });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(CandidateNotArrayError);
  });

  test("captures thrown getters as an error result", () => {
    const boom = new Error("boom");
    const item = {
      get id() {
        throw boom;
      },
    };
    expect(validator.safeParseArray(shape, [item])).toEqual({ success: false, error: boom });
  });
});

describe("validate and validateArray", () => {
  const validator = new Validator();
  const shape = { id: [String], note: [undefined, String] };

  test("validate returns a plain boolean", () => {
    expect(validator.validate(shape, { id: "a" })).toBe(true);
    expect(validator.validate(shape, { id: "a", note: "n", extra: 1 })).toBe(true);
    expect(validator.validate(shape, { id: 1 })).toBe(false);
    expect(validator.validate(shape, null)).toBe(false);
  });

  test("validate never extracts: the candidate keeps its identity and extra keys", () => {
    const candidate = { id: "a", extra: 1 };
    expect(validator.validate(shape, candidate)).toBe(true);
    expect(candidate.extra).toBe(1);
  });

  test("validate agrees with safeParse on every candidate", () => {
    for (const candidate of [{ id: "a" }, { id: 1 }, {}, null, [], new Date()]) {
      expect(validator.validate(shape, candidate)).toBe(validator.safeParse(shape, candidate).success);
    }
  });

  test("validateArray returns false for non-arrays instead of throwing", () => {
    for (const candidate of ["str", 1, null, undefined, {}, new Date()]) {
      expect(validator.validateArray(shape, candidate)).toBe(false);
    }
  });

  test("validateArray checks every element and accepts the empty array", () => {
    expect(validator.validateArray(shape, [])).toBe(true);
    expect(validator.validateArray(shape, [{ id: "a" }, { id: "b", note: "n" }])).toBe(true);
    expect(validator.validateArray(shape, [{ id: "a" }, { id: 2 }])).toBe(false);
    expect(validator.validateArray(shape, [{ id: "a" }, null])).toBe(false);
  });

  test("both propagate schema errors and candidate exceptions", () => {
    expect(() => validator.validate({ a: [] }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.validateArray({ a: [] }, [])).toThrow(UnsupportedValidatorError);
    const boom = new Error("boom");
    const evil = {
      get id() {
        throw boom;
      },
    };
    expect(() => validator.validate(shape, evil)).toThrow(boom);
    expect(() => validator.validateArray(shape, [evil])).toThrow(boom);
  });
});

describe("schema compilation cache", () => {
  test("compiles a shape once and reuses it by identity", () => {
    const factory = new ValidatorFactory();
    const shape = { a: [String] };
    const compiled = factory.compile(shape);
    expect(factory.compile(shape)).toBe(compiled);
    expect(factory.compile({ a: [String] })).not.toBe(compiled);
  });

  test("Validator accepts a custom factory", () => {
    const factory = new ValidatorFactory();
    const validator = new Validator(factory);
    const shape = { a: [String] };
    validator.parse(shape, { a: "x" });
    expect(factory.compile(shape)).toBe(factory.compile(shape));
  });
});

describe("exported constants", () => {
  test("WILDCARD_KEY is *", () => {
    expect(WILDCARD_KEY).toBe("*");
  });

  test("PRIMITIVE_PREDICATES covers all supported tokens", () => {
    expect([...PRIMITIVE_PREDICATES.keys()]).toEqual([String, Number, Boolean, Date, null, undefined]);
    expect(PRIMITIVE_PREDICATES.get(Boolean)(false)).toBe(true);
    expect(PRIMITIVE_PREDICATES.get(Boolean)(0)).toBe(false);
  });
});

describe("shape invariants: every token in every position", () => {
  const validator = new Validator();

  const samples = {
    string: "x",
    number: 1,
    boolean: true,
    date: new Date(0),
    null: null,
    undefined: undefined,
    object: {},
    array: [],
  };

  const tokens = [
    ["String", String, ["string"], ["boxed string"]],
    ["Number", Number, ["number"], ["NaN", "boxed number"]],
    ["Boolean", Boolean, ["boolean"], ["boxed boolean"]],
    ["Date", Date, ["date"], ["date string", "timestamp"]],
    ["null", null, ["null"], []],
    ["undefined", undefined, ["undefined"], []],
  ];

  const extras = {
    NaN: NaN,
    "date string": "1970-01-01",
    timestamp: 0,
    "boxed string": new String("x"),
    "boxed number": new Number(1),
    "boxed boolean": new Boolean(true),
  };

  test.each(tokens)("%s accepts its values and rejects all others in every position", (name, token, valid, rejected) => {
    for (const key of valid) {
      const value = samples[key];
      expect(validator.parse({ v: [token] }, { v: value })).toEqual({ v: value });
      expect(validator.parse({ v: token }, { v: value })).toEqual({ v: value });
      expect(validator.parse({ v: [[token]] }, { v: [value] })).toEqual({ v: [value] });
      expect(validator.parse({ "*": [token] }, { k: value })).toEqual({ k: value });
    }
    const invalid = Object.keys(samples).filter((key) => !valid.includes(key));
    for (const key of invalid) {
      const value = samples[key];
      expect(validator.safeParse({ v: [token] }, { v: value })).toEqual({ success: false, keys: ["v"] });
      expect(validator.safeParse({ v: token }, { v: value })).toEqual({ success: false, keys: ["v"] });
      expect(validator.safeParse({ v: [[token]] }, { v: [value] })).toEqual({ success: false, keys: ["v.0"] });
      expect(validator.safeParse({ "*": [token] }, { k: value })).toEqual({ success: false, keys: ["k"] });
    }
    for (const key of rejected) {
      expect(validator.safeParse({ v: [token] }, { v: extras[key] })).toEqual({ success: false, keys: ["v"] });
    }
  });

  test("a single-option union behaves exactly like the bare token", () => {
    for (const shape of [{ v: [String] }, { v: String }]) {
      expect(validator.parse(shape, { v: "x" })).toEqual({ v: "x" });
      expect(validator.safeParse(shape, { v: 1 })).toEqual({ success: false, keys: ["v"] });
    }
  });
});

describe("shape invariants: containers reject foreign types", () => {
  const validator = new Validator();

  const foreign = ["x", 1, true, null, undefined, new Date(0)];

  test("object shapes reject primitives, arrays and dates", () => {
    for (const candidate of [...foreign, []]) {
      expect(validator.safeParse({ a: [undefined, String] }, candidate)).toEqual({ success: false, keys: [""] });
    }
  });

  test("record shapes reject primitives, arrays and dates", () => {
    for (const candidate of [...foreign, []]) {
      expect(validator.safeParse({ "*": [String] }, candidate)).toEqual({ success: false, keys: [""] });
    }
  });

  test("array fields reject primitives, objects and dates", () => {
    for (const candidate of [...foreign, {}]) {
      expect(validator.safeParse({ v: [[String]] }, { v: candidate })).toEqual({ success: false, keys: ["v"] });
    }
    expect(validator.safeParse({ v: [[String]] }, { v: { length: 1, 0: "x" } })).toEqual({
      success: false,
      keys: ["v"],
    });
  });

  test("every container accepts its empty candidate", () => {
    expect(validator.parse({}, {})).toEqual({});
    expect(validator.parse({ "*": [String] }, {})).toEqual({});
    expect(validator.parse({ v: [[String]] }, { v: [] })).toEqual({ v: [] });
  });
});

describe("shape invariants: unions", () => {
  const validator = new Validator();

  test("every option is reachable", () => {
    const shape = { v: [String, Number, null, [Boolean], { id: [String] }] };
    for (const value of ["x", 1, null, [true, false], { id: "a" }]) {
      expect(validator.parse(shape, { v: value })).toEqual({ v: value });
    }
  });

  test("failed options report in declaration order", () => {
    const shape = { v: [{ x: [String] }, { y: [Number] }, { z: [Boolean] }] };
    expect(validator.safeParse(shape, { v: {} })).toEqual({
      success: false,
      keys: [["v.x"], ["v.y"], ["v.z"]],
    });
  });

  test("union of arrays validates each option as a whole array", () => {
    const shape = { v: [[String], [Number]] };
    expect(validator.parse(shape, { v: ["a", "b"] })).toEqual({ v: ["a", "b"] });
    expect(validator.parse(shape, { v: [1, 2] })).toEqual({ v: [1, 2] });
    expect(validator.safeParse(shape, { v: ["a", 1] })).toEqual({
      success: false,
      keys: [["v.1"], ["v.0"]],
    });
  });

  test("unions nest inside records, arrays and objects", () => {
    const shape = { "*": [String, { id: [Number] }] };
    expect(validator.parse(shape, { a: "x", b: { id: 1 } })).toEqual({ a: "x", b: { id: 1 } });
    const deep = { v: [[{ w: [null, [Number]] }]] };
    expect(validator.parse(deep, { v: [{ w: null }, { w: [1, 2] }] })).toEqual({ v: [{ w: null }, { w: [1, 2] }] });
  });

  test("overlapping object options extract through the first match", () => {
    const shape = { v: [{ a: [String] }, { a: [String], b: [Number] }] };
    expect(validator.parse(shape, { v: { a: "x", b: 1 } })).toEqual({ v: { a: "x" } });
  });
});

describe("shape invariants: prototype safety", () => {
  const validator = new Validator();

  test("__proto__ from JSON survives extraction as an own key and never touches the prototype", () => {
    const flat = validator.parse({ "*": [String] }, JSON.parse('{"__proto__": "x", "a": "y"}'));
    expect(Object.hasOwn(flat, "__proto__")).toBe(true);
    expect(flat).toEqual(JSON.parse('{"__proto__": "x", "a": "y"}'));
    expect(Object.getPrototypeOf(flat)).toBe(Object.prototype);

    const nested = validator.parse({ "*": [{ polluted: [Boolean] }] }, JSON.parse('{"__proto__": {"polluted": true}}'));
    expect(Object.hasOwn(nested, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
    expect({}.polluted).toBeUndefined();
  });

  test("__proto__ as an explicit object shape key", () => {
    const shape = { ["__proto__"]: [String] };
    const extracted = validator.parse(shape, JSON.parse('{"__proto__": "x"}'));
    expect(Object.hasOwn(extracted, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(extracted)).toBe(Object.prototype);
    expect(validator.safeParse(shape, {})).toEqual({ success: false, keys: ["__proto__"] });
  });

  test("constructor and toString are plain data keys", () => {
    const shape = { constructor: [String], toString: [String] };
    expect(validator.parse(shape, JSON.parse('{"constructor": "a", "toString": "b"}'))).toEqual({
      constructor: "a",
      toString: "b",
    });
    expect(validator.safeParse(shape, {})).toEqual({ success: false, keys: ["constructor", "toString"] });
  });
});

describe("shape invariants: exotic candidates", () => {
  const validator = new Validator();

  test("sparse arrays: holes read as undefined and extract dense", () => {
    expect(validator.safeParse({ v: [[String]] }, { v: ["a", , "b"] })).toEqual({ success: false, keys: ["v.1"] });
    const result = validator.parse({ v: [[undefined, String]] }, { v: ["a", , "b"] });
    expect(result.v).toEqual(["a", undefined, "b"]);
    expect(Object.hasOwn(result.v, 1)).toBe(true);
  });

  test("null-prototype candidates validate like plain objects", () => {
    const candidate = Object.create(null);
    candidate.a = "x";
    expect(validator.parse({ a: [String] }, candidate)).toEqual({ a: "x" });
    expect(validator.parse({ "*": [String] }, candidate)).toEqual({ a: "x" });
  });

  test("frozen candidates are never mutated and parse fine", () => {
    const candidate = Object.freeze({ a: "x", extra: Object.freeze([1]) });
    expect(validator.parse({ a: [String] }, candidate)).toEqual({ a: "x" });
  });

  test("object shapes see non-enumerable own keys, records skip them", () => {
    const candidate = {};
    Object.defineProperty(candidate, "a", { value: "x", enumerable: false });
    expect(validator.parse({ a: [String] }, candidate)).toEqual({ a: "x" });
    expect(validator.parse({ "*": [Number] }, candidate)).toEqual({});
  });

  test("records skip symbol keys", () => {
    expect(validator.parse({ "*": [String] }, { [Symbol("s")]: 1, a: "x" })).toEqual({ a: "x" });
  });

  test("circular candidates fail at the schema boundary without recursing", () => {
    const candidate = { a: null };
    candidate.a = candidate;
    expect(validator.safeParse({ a: [{ b: [Number] }] }, candidate)).toEqual({ success: false, keys: ["a.b"] });
  });

  test("numeric-like object keys behave as ordinary keys", () => {
    expect(validator.parse({ 0: [String] }, { 0: "x", 1: "ignored" })).toEqual({ 0: "x" });
  });
});

describe("shape invariants: compilation", () => {
  const validator = new Validator();

  test("error keys follow shape declaration order, not candidate order", () => {
    expect(validator.safeParse({ b: [String], a: [Number] }, { a: "x", b: 1 })).toEqual({
      success: false,
      keys: ["b", "a"],
    });
  });

  test("shape mutations after the first parse are ignored: the cache holds by identity", () => {
    const shape = { v: [String] };
    expect(validator.parse(shape, { v: "x" })).toEqual({ v: "x" });
    shape.v = [Number];
    expect(validator.parse(shape, { v: "x" })).toEqual({ v: "x" });
    expect(validator.safeParse({ v: [Number] }, { v: "x" })).toEqual({ success: false, keys: ["v"] });
  });

  test("a sub-shape object shared between two shapes compiles independently in each", () => {
    const sub = { id: [String] };
    expect(validator.parse({ a: [sub] }, { a: { id: "1" } })).toEqual({ a: { id: "1" } });
    expect(validator.parse({ b: [[sub]] }, { b: [{ id: "2" }] })).toEqual({ b: [{ id: "2" }] });
  });

  test("deeply nested empty unions are rejected at any depth", () => {
    expect(() => validator.parse({ a: [[[]]] }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.parse({ a: [{ b: [] }] }, {})).toThrow(UnsupportedValidatorError);
    expect(() => validator.parse({ "*": [] }, {})).toThrow(UnsupportedValidatorError);
  });
});

describe("shape invariants: method parity", () => {
  const validator = new Validator();
  const shape = { id: [String], n: [Number], tags: [[String]], meta: [{ ok: [Boolean] }] };
  const valid = { id: "a", n: 1, tags: ["x"], meta: { ok: true } };
  const invalid = { id: 1, n: "a", tags: [true], meta: {} };

  test("parse and safeParse agree on data and keys", () => {
    expect(validator.parse(shape, valid)).toEqual(validator.safeParse(shape, valid).data);
    const keys = validator.safeParse(shape, invalid).keys;
    try {
      validator.parse(shape, invalid);
    } catch (error) {
      expect(error.keys).toEqual(keys);
    }
    expect.assertions(2);
  });

  test("parseArray and safeParseArray agree on data and keys", () => {
    expect(validator.parseArray(shape, [valid])).toEqual(validator.safeParseArray(shape, [valid]).data);
    const keys = validator.safeParseArray(shape, [valid, invalid]).keys;
    expect(keys).toEqual([[], validator.safeParse(shape, invalid).keys]);
    try {
      validator.parseArray(shape, [valid, invalid]);
    } catch (error) {
      expect(error.keys).toEqual(keys);
    }
    expect.assertions(3);
  });

  test("array methods validate elements independently", () => {
    const result = validator.safeParseArray(shape, [invalid, valid, null]);
    expect(result.keys[1]).toEqual([]);
    expect(result.keys[2]).toEqual([""]);
  });
});

describe("complex end-to-end shapes", () => {
  const validator = new Validator();

  test("validates and extracts a deeply nested mixed structure", () => {
    const shape = {
      name: [String],
      age: [Number],
      tags: [[String]],
      active: [Boolean],
      meta: [{ verified: [Boolean], score: [Number], note: [null, String] }],
      misc: [null, String, Number],
      config: [{ level: [Number], options: [[String, Number]] }],
      friends: [[{ id: [String], data: [String, { email: [String], phone: [String] }] }]],
      matrix: [[[Number]]],
      mixedMatrix: [[[String, Number]]],
      settings: [{ theme: [String], nested: [{ experimental: [Boolean] }] }],
      optionalNote: [undefined, String],
      complex: [[String, [Number]]],
      dictionary: [{ "*": [String] }],
    };

    const input = {
      name: "John",
      age: 42,
      tags: ["one", "two"],
      active: true,
      meta: { verified: false, score: 88, note: null },
      misc: "text",
      config: { level: 3, options: ["fast", 100, "slow", 200] },
      friends: [
        { id: "f1", data: "simple" },
        { id: "f2", data: { email: "a@b.c", phone: "1234567890" } },
      ],
      matrix: [[1, 2], [3], [4]],
      mixedMatrix: [
        ["x", 1],
        [3, "z"],
      ],
      settings: { theme: "dark", nested: { experimental: true } },
      optionalNote: undefined,
      complex: ["val", [1, 2, 3], "another", [42]],
      dictionary: { en: "hello", ru: "privet" },
    };

    expect(validator.parse(shape, input)).toEqual(input);
  });

  test("handles five levels of nesting", () => {
    const shape = { l1: [{ l2: [{ l3: [{ l4: [{ value: [String] }] }] }] }] };
    const input = { l1: { l2: { l3: { l4: { value: "deep" } } } } };
    expect(validator.parse(shape, input)).toEqual(input);
  });
});
