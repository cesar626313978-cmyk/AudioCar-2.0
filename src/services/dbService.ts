/**
 * IndexedDB Local Storage Manager for TeslaDrive Audio
 * Persists tracks metadata, folders hierarchy, playlists, and playback state offline
 */

import { AudioTrack, DriveFolder, Playlist } from '../types';

const DB_NAME = 'TeslaDriveAudioDB';
const DB_VERSION = 2;

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private isReady: Promise<IDBDatabase>;

  constructor() {
    this.isReady = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Tracks store
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
          trackStore.createIndex('driveFileId', 'driveFileId', { unique: false });
          trackStore.createIndex('folderId', 'folderId', { unique: false });
          trackStore.createIndex('isFavorite', 'isFavorite', { unique: false });
          trackStore.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
        }

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('parentId', 'parentId', { unique: false });
        }

        // Playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }

        // Key-Value App Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Mega-Buffer Audio Blobs store (offline & anti-drop cache)
        if (!db.objectStoreNames.contains('audioBlobs')) {
          const blobStore = db.createObjectStore('audioBlobs', { keyPath: 'id' });
          blobStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.isReady;
  }

  // --- Tracks operations ---
  async saveTracks(tracks: AudioTrack[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      tracks.forEach((track) => store.put(track));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllTracks(): Promise<AudioTrack[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTrack(track: AudioTrack): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      store.put(track);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async toggleFavorite(trackId: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const request = store.get(trackId);
      request.onsuccess = () => {
        const track = request.result as AudioTrack | undefined;
        if (track) {
          track.isFavorite = !track.isFavorite;
          store.put(track);
          resolve(track.isFavorite);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async logTrackPlayed(trackId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const request = store.get(trackId);
      request.onsuccess = () => {
        const track = request.result as AudioTrack | undefined;
        if (track) {
          track.lastPlayedAt = Date.now();
          store.put(track);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTrack(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteDemoTracks(): Promise<void> {
    const db = await this.getDB();
    await this.setSetting('hideDemoTracks', true);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const request = store.getAll();
      request.onsuccess = () => {
        const allTracks: AudioTrack[] = request.result || [];
        allTracks.forEach((t) => {
          if (t.source === 'demo' || t.id.startsWith('demo_')) {
            store.delete(t.id);
          }
        });
        tx.oncomplete = () => resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async isDemoTracksHidden(): Promise<boolean> {
    return this.getSetting<boolean>('hideDemoTracks', false);
  }

  async setDemoTracksHidden(hidden: boolean): Promise<void> {
    return this.setSetting('hideDemoTracks', hidden);
  }

  // --- Folders operations ---
  async saveFolders(folders: DriveFolder[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      folders.forEach((folder) => store.put(folder));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllFolders(): Promise<DriveFolder[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readonly');
      const store = tx.objectStore('folders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Playlists operations ---
  async savePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      store.put(playlist);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Settings / State cache ---
  async setSetting(key: string, value: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result && request.result.value !== undefined) {
          resolve(request.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      request.onerror = () => resolve(defaultValue);
    });
  }

  // --- Mega-Buffer Audio Blobs Persistence (Anti-Radio Switching / 4G Outages & Quota Defense) ---
  async saveAudioBlob(id: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise(async (resolve) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve();
          return;
        }

        const tryWrite = (): Promise<boolean> => {
          return new Promise((resWrite) => {
            try {
              const tx = db.transaction('audioBlobs', 'readwrite');
              const store = tx.objectStore('audioBlobs');
              store.put({
                id,
                blob,
                size: blob.size,
                type: blob.type,
                timestamp: Date.now()
              });
              tx.oncomplete = () => resWrite(true);
              tx.onerror = async (ev) => {
                const err = tx.error || (ev.target as any)?.error;
                console.warn('Could not save audio blob to IndexedDB (possible QuotaExceededError):', err?.name || err);
                resWrite(false);
              };
            } catch (err) {
              resWrite(false);
            }
          });
        };

        const success = await tryWrite();
        if (!success) {
          // If write failed (e.g. Safari iOS QuotaExceededError), evict the oldest 3 cached audio blobs and retry once
          console.log('[IndexedDB Quota Defense] Attempting LRU eviction of oldest audio blobs...');
          await this.evictOldestBlobs(3);
          const retryOk = await tryWrite();
          if (!retryOk) {
            console.warn('[IndexedDB Quota Defense] Storage limit reached on device; operating in transient RAM mode.');
          }
        }
        resolve();
      } catch (err) {
        console.warn('saveAudioBlob defensive fallback:', err);
        resolve(); // Graceful non-blocking degradation
      }
    });
  }

  /**
   * LRU Eviction: Removes the oldest N audio blobs from IndexedDB cache to prevent QuotaExceededError
   */
  async evictOldestBlobs(countToEvict: number = 3): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve();
          return;
        }
        const tx = db.transaction('audioBlobs', 'readwrite');
        const store = tx.objectStore('audioBlobs');
        const request = store.getAll();

        request.onsuccess = () => {
          const items: any[] = request.result || [];
          if (items.length <= 1) {
            resolve();
            return;
          }

          // Sort by timestamp ascending (oldest first)
          items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          const toDelete = items.slice(0, countToEvict);

          toDelete.forEach((item) => {
            try {
              store.delete(item.id);
            } catch {}
          });

          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };

        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async getAudioBlob(id: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result && request.result.blob) {
            resolve(request.result.blob);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async hasAudioBlob(id: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve(false);
          return;
        }
        const tx = db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const request = store.count(IDBKeyRange.only(id));
        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async getAllCachedBlobIds(): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve([]);
          return;
        }
        const tx = db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const request = store.getAllKeys();
        request.onsuccess = () => resolve((request.result as string[]) || []);
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async clearAudioBlobCache(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve();
          return;
        }
        const tx = db.transaction('audioBlobs', 'readwrite');
        const store = tx.objectStore('audioBlobs');
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        resolve();
      }
    });
  }

  async getCachedAudioStats(): Promise<{ count: number; totalSizeBytes: number }> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          resolve({ count: 0, totalSizeBytes: 0 });
          return;
        }
        const tx = db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const request = store.getAll();
        request.onsuccess = () => {
          const items = request.result || [];
          const totalSizeBytes = items.reduce((acc: number, item: any) => acc + (item.size || 0), 0);
          resolve({ count: items.length, totalSizeBytes });
        };
        request.onerror = () => resolve({ count: 0, totalSizeBytes: 0 });
      } catch {
        resolve({ count: 0, totalSizeBytes: 0 });
      }
    });
  }
}

export const dbService = new IndexedDBService();
