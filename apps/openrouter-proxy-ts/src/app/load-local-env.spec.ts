import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadLocalEnv } from './load-local-env';

describe('loadLocalEnv', () => {
  it('loads values from .env.local without overriding existing process env', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'openrouter-env-'));
    const appDir = join(workspace, 'apps', 'openrouter-proxy-ts');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, '.env.local'),
      [
        '# local secrets',
        'OPENROUTER_API_KEY=local-key',
        'OPENROUTER_MODEL="openai/gpt-5.2"',
        'OPENROUTER_APP_TITLE=Story Companion Local',
        '',
      ].join('\n'),
      'utf8',
    );

    const previousKey = process.env['OPENROUTER_API_KEY'];
    const previousModel = process.env['OPENROUTER_MODEL'];
    const previousTitle = process.env['OPENROUTER_APP_TITLE'];

    process.env['OPENROUTER_API_KEY'] = 'shell-key';
    delete process.env['OPENROUTER_MODEL'];
    delete process.env['OPENROUTER_APP_TITLE'];

    try {
      const loaded = loadLocalEnv(appDir);

      expect(loaded).toEqual(['OPENROUTER_MODEL', 'OPENROUTER_APP_TITLE']);
      expect(process.env['OPENROUTER_API_KEY']).toBe('shell-key');
      expect(process.env['OPENROUTER_MODEL']).toBe('openai/gpt-5.2');
      expect(process.env['OPENROUTER_APP_TITLE']).toBe('Story Companion Local');
    } finally {
      restoreEnv('OPENROUTER_API_KEY', previousKey);
      restoreEnv('OPENROUTER_MODEL', previousModel);
      restoreEnv('OPENROUTER_APP_TITLE', previousTitle);
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('returns an empty list when no .env.local file exists', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'openrouter-env-'));
    const appDir = join(workspace, 'apps', 'openrouter-proxy-ts');
    mkdirSync(appDir, { recursive: true });

    try {
      expect(loadLocalEnv(appDir)).toEqual([]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
