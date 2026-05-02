import 'fake-indexeddb/auto';

import { sessionRepositoryStoreNames, StorySessionRepository } from './session.repository';
import { makeEmptyWorldState, makeStorySession } from './story-factories';

describe('StorySessionRepository', () => {
  let repository: StorySessionRepository;
  let dbCounter = 0;

  beforeEach(async () => {
    globalThis.structuredClone ??= (value) => JSON.parse(JSON.stringify(value));
    dbCounter += 1;
    repository = StorySessionRepository.forDatabase(`story-companion-test-${dbCounter}`);
  });

  afterEach(async () => {
    await repository.close();
  });

  it('saves and loads a story session with messages and world state', async () => {
    const session = makeStorySession({
      id: 'session-1',
      title: 'Ash Gate',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: 'Open the door.',
          input_type: 'action',
          createdAt: '2026-05-01T10:00:00.000Z',
        },
      ],
      worldState: {
        ...makeEmptyWorldState('world-1', 'Ash Gate'),
        keyFacts: ['The gate is barred from the other side.'],
      },
    });

    await repository.saveSession(session);

    await expect(repository.getSession('session-1')).resolves.toEqual(session);
  });

  it('lists sessions newest first by updatedAt', async () => {
    await repository.saveSession(makeStorySession({
      id: 'older',
      title: 'Older',
      updatedAt: '2026-05-01T10:00:00.000Z',
    }));
    await repository.saveSession(makeStorySession({
      id: 'newer',
      title: 'Newer',
      updatedAt: '2026-05-01T11:00:00.000Z',
    }));

    const sessions = await repository.listSessions();

    expect(sessions.map((session) => session.id)).toEqual(['newer', 'older']);
  });

  it('uses dedicated IndexedDB stores for sessions and settings', () => {
    expect(sessionRepositoryStoreNames).toEqual(['sessions', 'settings']);
  });
});
