class UnsupportedValidatorError extends Error {
  constructor(definition) {
    super(`Unsupported validator definition: ${String(definition)}`);
    this.name = "UnsupportedValidatorError";
    this.definition = definition;
  }
}

class ValidationFailedError extends Error {
  constructor(keys) {
    super(`Validation failed: ${JSON.stringify(keys)}`);
    this.name = "ValidationFailedError";
    this.keys = keys;
  }
}

class CandidateNotArrayError extends Error {
  constructor() {
    super("Candidate is not an array");
    this.name = "CandidateNotArrayError";
  }
}

module.exports = { UnsupportedValidatorError, ValidationFailedError, CandidateNotArrayError };
