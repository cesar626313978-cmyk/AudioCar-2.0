/**
 * Unified Cloud Service Manager - AudioCar
 * Dedicated to Google Drive (and local / demo mode).
 * Direct audio routing, folder traversal, session persistence and synchronization.
 */

import { AudioTrack, DriveFolder, CloudMusicProvider, CloudProviderType, CloudUserSession } from '../types';
import { googleDriveProvider } from './providers/GoogleDriveProvider';
import { demoProvider } from './providers/DemoProvider';
import { dbService } from './dbService';
import { driveService } from './driveService';
import { authService } from './authService';

const ACTIVE_PROVIDER_KEY = 'audiocar_active_cloud_provider';

export interface CloudSyncResult {
  status: 'not_authenticated' | 'root_folder_not_found' | 'synced' | 'error';
  success: boolean;
  rootFolderFound: boolean;
  rootFolderName?: string;
  userEmail?: string;
  tracksCount: number;
  foldersCount: number;
  tracks: AudioTrack[];
  folders: DriveFolder[];
  errorMessage?: string;
}

type CloudListener = (activeProvider: CloudMusicProvider) => void;

class CloudService {
  private providers: Map<CloudProviderType, CloudMusicProvider> = new Map();
  private activeProviderId: CloudProviderType = 'drive';
  private listeners: Set<CloudListener> = new Set();

  constructor() {
    this.providers.set('drive', googleDriveProvider);
    this.providers.set('demo', demoProvider);

    this.loadActiveProvider();
  }

  private loadActiveProvider() {
    try {
      const saved = localStorage.getItem(ACTIVE_PROVIDER_KEY) as CloudProviderType | null;
      if (saved && this.providers.has(saved)) {
        this.activeProviderId = saved;
      } else {
        this.activeProviderId = 'drive';
      }
    } catch {
      this.activeProviderId = 'drive';
    }
  }

  public getActiveProviderId(): CloudProviderType {
    return this.activeProviderId;
  }

  public getActiveProvider(): CloudMusicProvider {
    return this.providers.get(this.activeProviderId) || googleDriveProvider;
  }

  public getProvider(id: CloudProviderType): CloudMusicProvider {
    return this.providers.get(id) || googleDriveProvider;
  }

  public setActiveProvider(id: CloudProviderType) {
    if (!this.providers.has(id)) return;
    this.activeProviderId = id;
    localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
    this.notifyListeners();
  }

  public getAllSessions(): Record<CloudProviderType, CloudUserSession | null> {
    return {
      drive: googleDriveProvider.getSession(),
      demo: demoProvider.getSession()
    };
  }

  public async syncLibrary(
    targetProviderId?: CloudProviderType,
    onProgress?: (progress: { percent: number; step: string }) => void
  ): Promise<{ tracks: AudioTrack[]; folders: DriveFolder[] }> {
    const res = await this.syncLibraryDetailed(targetProviderId, onProgress);
    return { tracks: res.tracks, folders: res.folders };
  }

  public async syncLibraryDetailed(
    targetProviderId?: CloudProviderType,
    onProgress?: (progress: { percent: number; step: string }) => void
  ): Promise<CloudSyncResult> {
    const provider = targetProviderId ? this.getProvider(targetProviderId) : this.getActiveProvider();
    
    // Check if Google Drive is active but user is not logged in
    if (provider.providerId === 'drive') {
      onProgress?.({ percent: 10, step: 'Verificando sesión de Google Drive...' });
      const user = authService.getUser();
      if (!user) {
        return {
          status: 'not_authenticated',
          success: false,
          rootFolderFound: false,
          tracksCount: 0,
          foldersCount: 0,
          tracks: [],
          folders: []
        };
      }

      // Check if root folder "/mimusica" exists
      onProgress?.({ percent: 20, step: 'Localizando carpeta /mimusica en Google Drive...' });
      const rootFolder = await driveService.getMusicRootFolder(false);
      if (!rootFolder) {
        return {
          status: 'root_folder_not_found',
          success: false,
          rootFolderFound: false,
          userEmail: user.email,
          tracksCount: 0,
          foldersCount: 0,
          tracks: [],
          folders: []
        };
      }

      try {
        onProgress?.({ percent: 35, step: 'Explorando estructura de carpetas...' });
        const folders = await provider.listFolders();

        onProgress?.({ percent: 45, step: `Descubriendo canciones en ${folders.length} carpetas...` });
        const tracks = await (provider as any).listTracks(undefined, onProgress);

        if (tracks.length > 0) {
          await dbService.saveTracks(tracks).catch(() => {});
        }
        if (folders.length > 0) {
          await dbService.saveFolders(folders).catch(() => {});
        }

        onProgress?.({ percent: 100, step: `¡Sincronización completada! ${tracks.length} canciones listas.` });

        return {
          status: 'synced',
          success: true,
          rootFolderFound: true,
          rootFolderName: rootFolder.name,
          userEmail: user.email,
          tracksCount: tracks.length,
          foldersCount: folders.length,
          tracks,
          folders
        };
      } catch (err: any) {
        return {
          status: 'error',
          success: false,
          rootFolderFound: true,
          userEmail: user.email,
          tracksCount: 0,
          foldersCount: 0,
          tracks: [],
          folders: [],
          errorMessage: err?.message || 'Error de sincronización con Google Drive.'
        };
      }
    }

    // Fallback for demo or other providers
    onProgress?.({ percent: 50, step: 'Cargando biblioteca demo...' });
    const [tracks, folders] = await Promise.all([
      provider.listTracks(),
      provider.listFolders()
    ]);
    onProgress?.({ percent: 100, step: 'Biblioteca demo lista.' });

    if (tracks.length > 0) {
      await dbService.saveTracks(tracks).catch(() => {});
    }
    if (folders.length > 0) {
      await dbService.saveFolders(folders).catch(() => {});
    }

    return {
      status: 'synced',
      success: true,
      rootFolderFound: true,
      tracksCount: tracks.length,
      foldersCount: folders.length,
      tracks,
      folders
    };
  }

  /**
   * Direct streaming resolver
   * Dispatches to the corresponding cloud provider based on track source
   */
  public async getStreamUrl(track: AudioTrack): Promise<string> {
    if (track.cachedBlobUrl) {
      return track.cachedBlobUrl;
    }

    switch (track.source) {
      case 'drive':
        return await googleDriveProvider.getStreamUrl(track);
      case 'demo':
        return await demoProvider.getStreamUrl(track);
      case 'local':
      default:
        return track.streamUrl || '';
    }
  }

  public async prefetchTrack(track: AudioTrack): Promise<boolean> {
    switch (track.source) {
      case 'drive':
        return await googleDriveProvider.prefetchStream(track);
      default:
        return true;
    }
  }

  public async logoutProvider(id: CloudProviderType): Promise<void> {
    const provider = this.getProvider(id);
    await provider.logout();

    // Reset to drive
    this.setActiveProvider('drive');
    this.notifyListeners();
  }

  public subscribe(listener: CloudListener): () => void {
    this.listeners.add(listener);
    listener(this.getActiveProvider());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const active = this.getActiveProvider();
    this.listeners.forEach((fn) => fn(active));
  }
}

export const cloudService = new CloudService();

