const WILDCARD_KEY = "*";

const PRIMITIVE_PREDICATES = new Map([
  [String, (v) => typeof v === "string"],
  [Number, (v) => typeof v === "number" && !Number.isNaN(v)],
  [Boolean, (v) => typeof v === "boolean"],
  [Date, (v) => v instanceof Date],
  [null, (v) => v === null],
  [undefined, (v) => v === undefined],
]);

module.exports = { WILDCARD_KEY, PRIMITIVE_PREDICATES };
