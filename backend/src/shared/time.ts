const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function isValidIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** Emits the API's timestamp format — ISO 8601 UTC without milliseconds, matching
 *  the source CSV's own `Z`-suffixed values so generated timestamps and
 *  passed-through ones are indistinguishable in a response. */
export function msToIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
