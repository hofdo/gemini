export function extractJsonObject(raw: string): string {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) {
    throw new Error('No JSON object found in LLM response.');
  }
  return raw.slice(first, last + 1);
}

export function parseJsonObject(raw: string): unknown {
  return JSON.parse(extractJsonObject(raw));
}
