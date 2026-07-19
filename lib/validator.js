const { WILDCARD_KEY, PRIMITIVE_PREDICATES } = require("./constants");
const { UnsupportedValidatorError, ValidationFailedError, CandidateNotArrayError } = require("./errors");

const isRecordLike = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

const joinPath = (path, key) => (path ? path + "." + key : key);

const assignKey = (target, key, value) => {
  if (key === "__proto__")
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
  else target[key] = value;
};

class PrimitiveValidator {
  #predicate;

  constructor(predicate) {
    this.#predicate = predicate;
  }

  validate(value, path) {
    if (this.#predicate(value)) return { errors: [], value };
    return { errors: [path], value: undefined };
  }
}

class ArrayValidator {
  #element;

  constructor(element) {
    this.#element = element;
  }

  validate(value, path) {
    if (!Array.isArray(value)) return { errors: [path], value: undefined };
    const errors = [];
    const extracted = [];
    for (let i = 0; i < value.length; i++) {
      const result = this.#element.validate(value[i], joinPath(path, String(i)));
      errors.push(...result.errors);
      extracted.push(result.value);
    }
    return { errors, value: extracted };
  }
}

class UnionValidator {
  #options;

  constructor(options) {
    this.#options = options;
  }

  validate(value, path) {
    const collectedErrors = [];
    for (const option of this.#options) {
      const result = option.validate(value, path);
      if (result.errors.length === 0) return result;
      collectedErrors.push(result.errors);
    }
    return { errors: collectedErrors, value: undefined };
  }
}

class ObjectValidator {
  #fields;

  constructor(fields) {
    this.#fields = fields;
  }

  validate(value, path) {
    if (!isRecordLike(value)) return { errors: [path], value: undefined };
    const errors = [];
    const extracted = {};
    for (const [key, field] of this.#fields) {
      const exists = Object.hasOwn(value, key);
      const fieldValue = exists ? value[key] : undefined;
      const result = field.validate(fieldValue, joinPath(path, key));
      errors.push(...result.errors);
      if (exists && result.errors.length === 0) assignKey(extracted, key, result.value);
    }
    return { errors, value: extracted };
  }
}

class RecordValidator {
  #element;

  constructor(element) {
    this.#element = element;
  }

  validate(value, path) {
    if (!isRecordLike(value)) return { errors: [path], value: undefined };
    const errors = [];
    const extracted = {};
    for (const key of Object.keys(value)) {
      const result = this.#element.validate(value[key], joinPath(path, key));
      errors.push(...result.errors);
      if (result.errors.length === 0) assignKey(extracted, key, result.value);
    }
    return { errors, value: extracted };
  }
}

class ValidatorFactory {
  #cache = new WeakMap();

  compile(shape) {
    const cached = this.#cache.get(shape);
    if (cached) return cached;
    const validator = this.#shapeValidator(shape);
    this.#cache.set(shape, validator);
    return validator;
  }

  #shapeValidator(shape) {
    if (Object.hasOwn(shape, WILDCARD_KEY)) {
      if (Object.keys(shape).length > 1)
        throw new UnsupportedValidatorError(`"${WILDCARD_KEY}" cannot be combined with other keys`);
      return new RecordValidator(this.#fieldValidator(shape[WILDCARD_KEY]));
    }
    const fields = Object.keys(shape).map((key) => [key, this.#fieldValidator(shape[key])]);
    return new ObjectValidator(fields);
  }

  #fieldValidator(definition) {
    if (Array.isArray(definition)) return this.#unionValidator(definition);
    return this.#tokenValidator(definition);
  }

  #unionValidator(definitions) {
    if (definitions.length === 0) throw new UnsupportedValidatorError("empty union []");
    const options = definitions.map((definition) => this.#tokenValidator(definition));
    return options.length === 1 ? options[0] : new UnionValidator(options);
  }

  #tokenValidator(definition) {
    const predicate = PRIMITIVE_PREDICATES.get(definition);
    if (predicate) return new PrimitiveValidator(predicate);
    if (Array.isArray(definition)) return new ArrayValidator(this.#unionValidator(definition));
    if (definition && typeof definition === "object") return this.#shapeValidator(definition);
    throw new UnsupportedValidatorError(definition);
  }
}

const validatorFactoryInstance = new ValidatorFactory();

class Validator {
  #validatorFactory;

  constructor(validatorFactory = validatorFactoryInstance) {
    this.#validatorFactory = validatorFactory;
  }

  parse(shape, candidate) {
    const result = this.#validatorFactory.compile(shape).validate(candidate, "");
    if (result.errors.length === 0) return result.value;
    throw new ValidationFailedError(result.errors);
  }

  safeParse(shape, candidate) {
    const validator = this.#validatorFactory.compile(shape);
    try {
      const result = validator.validate(candidate, "");
      if (result.errors.length === 0) return { success: true, data: result.value };
      return { success: false, keys: result.errors };
    } catch (error) {
      return { success: false, error };
    }
  }

  validate(shape, candidate) {
    return this.#validatorFactory.compile(shape).validate(candidate, "").errors.length === 0;
  }

  validateArray(shape, candidate) {
    if (!Array.isArray(candidate)) return false;
    const validator = this.#validatorFactory.compile(shape);
    return candidate.every((item) => validator.validate(item, "").errors.length === 0);
  }

  parseArray(shape, candidate) {
    return Validator.#parseArrayWith(this.#validatorFactory.compile(shape), candidate);
  }

  safeParseArray(shape, candidate) {
    const validator = this.#validatorFactory.compile(shape);
    try {
      return { success: true, data: Validator.#parseArrayWith(validator, candidate) };
    } catch (error) {
      if (error instanceof ValidationFailedError) return { success: false, keys: error.keys };
      return { success: false, error };
    }
  }

  static #parseArrayWith(validator, candidate) {
    if (!Array.isArray(candidate)) throw new CandidateNotArrayError();
    const entities = [];
    const allKeys = [];
    let failed = false;
    for (const item of candidate) {
      const result = validator.validate(item, "");
      if (result.errors.length > 0) failed = true;
      else entities.push(result.value);
      allKeys.push(result.errors);
    }
    if (failed) throw new ValidationFailedError(allKeys);
    return entities;
  }
}

module.exports = { Validator, ValidatorFactory };
