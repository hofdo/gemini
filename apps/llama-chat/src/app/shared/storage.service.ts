import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AppDB extends DBSchema {
  'kv-store': { key: string; value: unknown };
}

const DB_NAME = 'llama-story-engine';
const DB_VERSION = 1;
const STORE_NAME = 'kv-store' as const;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private dbPromise: Promise<IDBPDatabase<AppDB>> = openDB<AppDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });

  async save(key: string, value: unknown): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, value, key);
  }

  async load<T>(key: string): Promise<T | null> {
    const db = await this.dbPromise;
    const val = await db.get(STORE_NAME, key);
    return (val as T) ?? null;
  }

  async listByPrefix(prefix: string): Promise<string[]> {
    const db = await this.dbPromise;
    const allKeys = await db.getAllKeys(STORE_NAME);
    return allKeys.filter(k => String(k).startsWith(prefix));
  }

  async delete(key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, key);
  }
}
