import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_ENV_FILENAME = '.env.local';

export function loadLocalEnv(cwd = process.cwd()): string[] {
  const envPath = join(cwd, LOCAL_ENV_FILENAME);
  if (!existsSync(envPath)) {
    return [];
  }

  const loaded: string[] = [];
  const file = readFileSync(envPath, 'utf8');

  for (const rawLine of file.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue);
    loaded.push(key);
  }

  return loaded;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
