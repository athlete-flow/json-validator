class PrimitiveValidator {
  constructor(validator) {
    this.#validator = validator;
  }

  #validator;

  validate(value, path) {
    return { errors: this.#validator(value) ? [] : [path], matched: this };
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
  #matchedElementsMap = new WeakMap();

  validate(value, path) {
    if (!Array.isArray(value)) return { errors: [path], matched: this };
    const result = [];
    const matchedElements = [];
    for (let i = 0; i < value.length; i++) {
      const fullPath = path ? path + "." + i : String(i);
      const validationResult = this.#element.validate(value[i], fullPath);
      result.push(...validationResult.errors);
      matchedElements.push(validationResult.matched);
    }
    this.#matchedElementsMap.set(value, matchedElements);
    return { errors: result, matched: this };
  }

  extract(value) {
    if (!Array.isArray(value)) return [];
    const matchedElements = this.#matchedElementsMap.get(value) || [];
    return value.map((item, index) => {
      const matched = matchedElements[index];
      if (this.#element instanceof UnionValidator) {
        return this.#element.extract(item, matched);
      } else if (this.#element instanceof ArrayValidator || this.#element instanceof ObjectValidator) {
        return this.#element.extract(item);
      }
      return this.#element.extract(item);
    });
  }
}

class UnionValidator {
  constructor(options) {
    this.#options = options;
  }

  #options;

  validate(value, path) {
    if (this.#options.length === 1) return this.#options[0].validate(value, path);

    let collectedErrors = [];
    for (const option of this.#options) {
      const validationResult = option.validate(value, path);
      if (validationResult.errors.length === 0) {
        return { errors: [], matched: validationResult.matched };
      }
      collectedErrors.push(validationResult.errors);
    }
    return { errors: collectedErrors.length > 0 ? collectedErrors : [path], matched: null };
  }

  extract(value, matched) {
    if (!matched) throw new Error("extract called before successful validation");
    return matched.extract(value);
  }
}

class ObjectValidator {
  constructor(fields) {
    this.#fields = fields;
  }

  #fields;
  #matchedFieldsMap = new WeakMap();

  validate(value, path) {
    if (typeof value !== "object" || value === null) return { errors: [path], matched: this };
    const result = [];
    const matchedFields = {};
    for (const key in this.#fields) {
      const fullPath = path ? path + "." + key : key;
      const validationResult = this.#fields[key].validate(value[key], fullPath);
      result.push(...validationResult.errors);
      matchedFields[key] = validationResult.matched;
    }
    this.#matchedFieldsMap.set(value, matchedFields);
    return { errors: result, matched: this };
  }

  extract(value) {
    if (typeof value !== "object" || value === null) return {};
    const matchedFields = this.#matchedFieldsMap.get(value) || {};
    const result = {};
    for (const key in this.#fields) {
      if (key in value) {
        const field = this.#fields[key];
        const matched = matchedFields[key];
        if (field instanceof UnionValidator) result[key] = field.extract(value[key], matched);
        else if (field instanceof ArrayValidator || field instanceof ObjectValidator)
          result[key] = field.extract(value[key]);
        else result[key] = field.extract(value[key]);
      }
    }
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
    if (definition && typeof definition === "object") return this.#createValidator(definition);
    throw new Error(`Unsupported validator: ${definition}`);
  }

  #createValidator(schema) {
    const fields = {};
    for (const key in schema) {
      const validators = schema[key].map(this.#toSchemaValidator.bind(this));
      fields[key] = validators.length === 1 ? validators[0] : new UnionValidator(validators);
    }
    return new ObjectValidator(fields);
  }

  createValidators(schema) {
    if (Array.isArray(schema)) return schema.map(this.#createValidator.bind(this));
    else return [this.#createValidator(schema)];
  }
}

class Schema {
  constructor(validators) {
    this.#validators = validators;
  }

  #validators;

  parse(candidate) {
    let collectedErrors = [];

    for (const validator of this.#validators) {
      try {
        const validationResult = validator.validate(candidate, "");
        if (validationResult.errors.length === 0) {
          const entity = validator.extract(candidate);
          return { success: true, entity };
        }
        const isNestedArray = validationResult.errors.length > 0 && Array.isArray(validationResult.errors[0]);
        if (this.#validators.length === 1) {
          if (isNestedArray) collectedErrors = validationResult.errors;
          else collectedErrors.push(...validationResult.errors);
        } else collectedErrors.push(validationResult.errors);
      } catch (e) {
        return { success: false, error: e };
      }
    }
    return { success: false, keys: collectedErrors };
  }

  parseArray(candidate) {
    if (!Array.isArray(candidate)) return { success: false, error: new Error("Candidate is not array") };

    const entities = [];
    const allKeys = [];

    for (const item of candidate) {
      const result = this.parse(item);
      if (result.success) {
        entities.push(result.entity);
        allKeys.push([]);
      } else if ("error" in result) return { success: false, error: result.error };
      else if ("keys" in result) allKeys.push(result.keys);
    }
    const isSuccess = allKeys.every((keys) => keys.length === 0);
    if (isSuccess) return { success: true, entity: entities };
    return { success: false, keys: allKeys };
  }

  validate(candidate) {
    const parsed = this.parse(candidate);
    if (!parsed.success && parsed.error) throw parsed.error;
    return parsed.success;
  }

  validateArray(candidate) {
    const parsed = this.parseArray(candidate);
    if (!parsed.success && parsed.error) throw parsed.error;
    return parsed.success;
  }
}

class SchemaFactory {
  #validatorFactory = new ValidatorFactory();

  createSchema(shape) {
    const validators = this.#validatorFactory.createValidators(shape);
    return new Schema(validators);
  }

  createCollection(shapes) {
    const collection = {};
    for (const [key, shape] of Object.entries(shapes)) collection[key] = this.createSchema(shape);
    return collection;
  }
}

module.exports = { SchemaFactory };
