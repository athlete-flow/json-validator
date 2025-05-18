class PrimitiveValidator {
  constructor(validator) {
    this.#validator = validator;
  }

  #validator;

  validate(value, path) {
    return this.#validator(value) ? [] : [path];
  }

  extract(value) {
    return value;
  }
}

class ArrayValidator {
  constructor(element) {
    this.#element = element;
  }

  #element;

  validate(value, path) {
    if (!Array.isArray(value)) return [path];
    const result = [];
    for (let i = 0; i < value.length; i++) {
      const fullPath = path + "." + i;
      const errors = this.#element.validate(value[i], fullPath);
      result.push(...errors);
    }
    return result;
  }

  extract(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => this.#element.extract(item));
  }
}

class UnionValidator {
  constructor(options) {
    this.#options = options;
  }

  #options;
  #matched = new Map();

  validate(value, path) {
    for (const option of this.#options) {
      const errors = option.validate(value, path);
      if (errors.length === 0) {
        this.#matched.set(value, option);
        return [];
      }
    }
    return [path];
  }

  extract(value) {
    const matched = this.#matched.get(value);
    if (!matched) throw new Error("extract called before successful validation");
    return matched.extract(value);
  }
}

class ObjectValidator {
  constructor(fields) {
    this.#fields = fields;
  }

  #fields;

  validate(value, path) {
    if (typeof value !== "object" || value === null) return [path];
    const result = [];
    for (const key in this.#fields) {
      const fullPath = path ? path + "." + key : key;
      const errors = this.#fields[key].validate(value[key], fullPath);
      result.push(...errors);
    }
    return result;
  }

  extract(value) {
    if (typeof value !== "object" || value === null) return {};
    const result = {};
    for (const key in this.#fields) if (key in value) result[key] = this.#fields[key].extract(value[key]);
    return result;
  }
}

class ValidatorFactory {
  #validators = new Map([
    [String, (v) => typeof v === "string"],
    [Number, (v) => typeof v === "number"],
    [Boolean, (v) => typeof v === "boolean"],
    [null, (v) => v === null],
    [undefined, (v) => v === undefined],
  ]);

  #toSchemaValidator(definition) {
    const validator = this.#validators.get(definition);
    if (validator) return new PrimitiveValidator(validator);
    if (Array.isArray(definition)) {
      const validators = definition.map(this.#toSchemaValidator.bind(this));
      const union = validators.length === 1 ? validators[0] : new UnionValidator(validators);
      return new ArrayValidator(union);
    }
    if (definition && typeof definition === "object") return this.createValidator(definition);
    throw new Error(`Unsupported validator: ${definition}`);
  }

  createValidator(schema) {
    const fields = {};
    for (const key in schema) {
      const validators = schema[key].map(this.#toSchemaValidator.bind(this));
      fields[key] = validators.length === 1 ? validators[0] : new UnionValidator(validators);
    }
    return new ObjectValidator(fields);
  }
}

class Schema {
  constructor(validator) {
    this.#validator = validator;
  }

  #validator;

  parse(candidate) {
    const keys = [];
    try {
      keys.push(...this.#validator.validate(candidate, ""));
      if (keys.length) return { success: false, keys };
      const clone = this.#validator.extract(candidate);
      return { success: true, clone };
    } catch (e) {
      return { success: false, keys, error: e };
    }
  }
}

class SchemaFactory {
  #validatorFactory = new ValidatorFactory();

  createSchema(shape) {
    const validator = this.#validatorFactory.createValidator(shape);
    return new Schema(validator);
  }
}

module.exports = { SchemaFactory };
