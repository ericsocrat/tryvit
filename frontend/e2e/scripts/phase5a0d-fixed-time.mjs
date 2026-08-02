const EXPECTED_FIXED_TIME = "2026-07-15T12:00:00.000Z";
const requestedFixedTime = process.env.PHASE5A0D_FIXED_TIME;

if (requestedFixedTime !== EXPECTED_FIXED_TIME) {
  throw new Error("[P5_FIXED_TIME] exact-authoritative-time-required");
}

const fixedMilliseconds = Date.parse(EXPECTED_FIXED_TIME);
const NativeDate = globalThis.Date;

function Phase5FixedDate(...values) {
  if (new.target === undefined) {
    return new NativeDate(fixedMilliseconds).toString();
  }
  return Reflect.construct(
    NativeDate,
    values.length === 0 ? [fixedMilliseconds] : values,
    new.target,
  );
}

Phase5FixedDate.prototype = Object.create(NativeDate.prototype, {
  constructor: {
    configurable: true,
    value: Phase5FixedDate,
    writable: true,
  },
});
Object.defineProperties(Phase5FixedDate, {
  name: { configurable: true, value: NativeDate.name },
  length: { configurable: true, value: NativeDate.length },
  now: { configurable: true, value: () => fixedMilliseconds, writable: true },
  parse: { configurable: true, value: NativeDate.parse, writable: true },
  UTC: { configurable: true, value: NativeDate.UTC, writable: true },
});

globalThis.Date = Phase5FixedDate;
