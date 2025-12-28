import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Workspace, Source, Outline, Session, VectorChunk, SRSItem } from '../types';

interface LCCDB extends DBSchema {
  workspaces: {
    key: string;
    value: Workspace;
  };
  sources: {
    key: string;
    value: Source;
    indexes: { 'by-workspace': string };
  };
  outlines: {
    key: string;
    value: Outline;
    indexes: { 'by-workspace': string };
  };
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-workspace': string };
  };
  vectors: {
    key: string;
    value: VectorChunk;
    indexes: { 'by-workspace': string, 'by-source': string };
  };
  srs_items: {
    key: string;
    value: SRSItem;
    indexes: { 'by-workspace': string, 'due-date': number };
  };
}

const DB_NAME = 'lcc-db-v2';

export async function getDB(): Promise<IDBPDatabase<LCCDB>> {
  return openDB<LCCDB>(DB_NAME, 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sources')) {
        const store = db.createObjectStore('sources', { keyPath: 'id' });
        store.createIndex('by-workspace', 'workspaceId');
      }
      if (!db.objectStoreNames.contains('outlines')) {
        const store = db.createObjectStore('outlines', { keyPath: 'id' });
        store.createIndex('by-workspace', 'workspaceId');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('by-workspace', 'workspaceId');
      }
      // V2 Upgrades
      if (!db.objectStoreNames.contains('vectors')) {
        const store = db.createObjectStore('vectors', { keyPath: 'chunkId' });
        store.createIndex('by-workspace', 'workspaceId');
        store.createIndex('by-source', 'sourceId');
      }
      if (!db.objectStoreNames.contains('srs_items')) {
        const store = db.createObjectStore('srs_items', { keyPath: 'id' });
        store.createIndex('by-workspace', 'workspaceId');
        store.createIndex('due-date', 'nextReviewAt');
      }
    },
  });
}

export const dbOps = {
  async getWorkspaces() {
    const db = await getDB();
    return db.getAll('workspaces');
  },
  async createWorkspace(ws: Workspace) {
    const db = await getDB();
    return db.put('workspaces', ws);
  },
  async updateWorkspace(ws: Workspace) {
    const db = await getDB();
    return db.put('workspaces', ws);
  },
  async getSources(wsId: string) {
    const db = await getDB();
    return db.getAllFromIndex('sources', 'by-workspace', wsId);
  },
  async addSource(source: Source) {
    const db = await getDB();
    return db.put('sources', source);
  },
  async getOutline(wsId: string) {
    const db = await getDB();
    const outlines = await db.getAllFromIndex('outlines', 'by-workspace', wsId);
    return outlines[0] || null;
  },
  async saveOutline(outline: Outline) {
    const db = await getDB();
    return db.put('outlines', outline);
  },
  async saveSession(session: Session) {
    const db = await getDB();
    return db.put('sessions', session);
  },
  // V2 Ops
  async saveVectors(chunks: VectorChunk[]) {
    const db = await getDB();
    const tx = db.transaction('vectors', 'readwrite');
    await Promise.all(chunks.map(c => tx.store.put(c)));
    await tx.done;
  },
  async getVectors(wsId: string) {
    const db = await getDB();
    return db.getAllFromIndex('vectors', 'by-workspace', wsId);
  },
  async getDueReviews(wsId: string) {
    const db = await getDB();
    const now = Date.now();
    const all = await db.getAllFromIndex('srs_items', 'by-workspace', wsId);
    return all.filter(item => item.nextReviewAt <= now);
  },
  async saveSRSItem(item: SRSItem) {
    const db = await getDB();
    return db.put('srs_items', item);
  }
};
