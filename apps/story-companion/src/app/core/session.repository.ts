import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProviderSettings, StorySession } from './story-types';

export const sessionRepositoryStoreNames = ['sessions', 'settings'];

interface StoryCompanionDb extends DBSchema {
  sessions: {
    key: string;
    value: StorySession;
    indexes: {
      'by-updated': string;
    };
  };
  settings: {
    key: string;
    value: ProviderSettings;
  };
}

const DEFAULT_DB_NAME = 'story-companion';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class StorySessionRepository {
  private dbPromise = openStoryDb(DEFAULT_DB_NAME);

  static forDatabase(dbName: string): StorySessionRepository {
    const repository = new StorySessionRepository();
    repository.dbPromise = openStoryDb(dbName);
    return repository;
  }

  async saveSession(session: StorySession): Promise<void> {
    const db = await this.dbPromise;
    await db.put('sessions', session);
  }

  async getSession(id: string): Promise<StorySession | undefined> {
    const db = await this.dbPromise;
    return db.get('sessions', id);
  }

  async listSessions(): Promise<StorySession[]> {
    const db = await this.dbPromise;
    const sessions = await db.getAll('sessions');
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('sessions', id);
  }

  async saveSettings(settings: ProviderSettings): Promise<void> {
    const db = await this.dbPromise;
    await db.put('settings', settings, 'provider');
  }

  async getSettings(): Promise<ProviderSettings | undefined> {
    const db = await this.dbPromise;
    return db.get('settings', 'provider');
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db.close();
  }
}

function openStoryDb(dbName: string): Promise<IDBPDatabase<StoryCompanionDb>> {
  return openDB<StoryCompanionDb>(dbName, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sessions')) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-updated', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
}
