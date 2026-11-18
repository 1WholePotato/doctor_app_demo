export function utcInstant(timestamp: string): number {
  const iso = timestamp.replace(" ", "T");
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);
}
