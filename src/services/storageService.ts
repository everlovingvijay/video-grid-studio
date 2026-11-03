import { openDB, IDBPDatabase } from 'idb';
import { ProjectManifest, GridConfig } from '../types/video';

const DB_NAME = 'VideoGridStudioDB';
const DB_VERSION = 1;

interface StoredProject {
  id: string;
  name: string;
  savedAt: number;
  gridConfig: GridConfig;
  manifest?: ProjectManifest;
  sourceInfo?: {
    name: string;
    width: number;
    height: number;
    duration: number;
  };
}

class StorageService {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('projects')) {
            db.createObjectStore('projects', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
        },
      });
    }
    return this.dbPromise;
  }

  public async saveRecentProject(project: StoredProject): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('projects', project);
    } catch (e) {
      console.warn('Failed to save project to IndexedDB:', e);
    }
  }

  public async getRecentProjects(): Promise<StoredProject[]> {
    try {
      const db = await this.getDB();
      return await db.getAll('projects');
    } catch (e) {
      console.warn('Failed to load projects from IndexedDB:', e);
      return [];
    }
  }

  public async deleteProject(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('projects', id);
    } catch (e) {
      console.warn('Failed to delete project from IndexedDB:', e);
    }
  }

  public async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear('projects');
      await db.clear('settings');
    } catch (e) {
      console.warn('Failed to clear IndexedDB:', e);
    }
  }
}

export const storageService = new StorageService();
