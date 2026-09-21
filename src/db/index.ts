import { openDB, type IDBPDatabase } from 'idb';
import type { User, Chat, Message, Story, Account, Contact } from '../types';

interface TelegramDB {
  users: { key: string; value: User };
  chats: { key: string; value: Chat };
  messages: { key: string; value: Message };
  stories: { key: string; value: Story };
  accounts: { key: string; value: Account };
  contacts: { key: string; value: Contact };
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<TelegramDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TelegramDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TelegramDB>('telegram-web', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('chats')) db.createObjectStore('chats', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'userId' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

export async function saveData<T>(store: keyof TelegramDB, data: T, key?: string) {
  const db = await getDB();
  const put = db.put as unknown as (store: string, value: unknown, key?: string) => Promise<unknown>;
  if (key !== undefined) await put(store, data, key);
  else await put(store, data);
}

export async function getData<T>(store: keyof TelegramDB, key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(store, key);
}

export async function getAllData<T>(store: keyof TelegramDB): Promise<T[]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function deleteData(store: keyof TelegramDB, key: string) {
  const db = await getDB();
  await db.delete(store, key);
}

export async function saveAll<T>(store: keyof TelegramDB, items: T[]) {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  const objStore = tx.store as unknown as { put: (value: unknown) => Promise<unknown> };
  await Promise.all([...items.map(item => objStore.put(item)), tx.done]);
}

export async function clearStore(store: keyof TelegramDB) {
  const db = await getDB();
  await db.clear(store);
}
