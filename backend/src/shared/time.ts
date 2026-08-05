const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function isValidIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_RE.test(value) && !Number.isNaN(Date.parse(value));
}
