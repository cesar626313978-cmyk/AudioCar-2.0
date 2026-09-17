/**
 * Google Drive API v3 Service - AudioCar
 * Strictly operates on the root music folder "mimusica" and all its subdirectories.
 * Handles audio querying with full pagination (nextPageToken), recursive folder exploration,
 * audio stream retrieval with Bearer token, companion album artwork detection (JPG, PNG, GIF, WEBP),
 * and AppData playlist synchronization.
 */

import { AudioTrack, DriveFolder, Playlist, ImageFormat, UserPreferences } from '../types';
import { authService } from './authService';
import { dbService } from './dbService';
import { fetchWithDriveBackoff } from './driveBackoff';
import { googlePickerService } from './googlePickerService';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
export const MUSIC_ROOT_FOLDER_NAME = 'mimusica';
const SELECTED_FOLDER_STORAGE_KEY = 'tesladrive_selected_music_folder';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'flac', 'm4a', 'wav', 'ogg', 'aac', 'opus', 'wma',
  'alac', 'aiff', 'aif', 'm4b', 'm4p', 'webm', 'oga', 'mid', 'midi', '3gp', 'amr'
]);

const NON_AUDIO_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico',
  'txt', 'pdf', 'doc', 'docx', 'nfo', 'ini', 'ds_store', 'db', 'json', 'xml', 'zip', 'rar'
]);

export function sanitizeAudioMimeType(incomingMime?: string, filename?: string): string {
  const cleanMime = (incomingMime || '').toLowerCase();
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';

  if (ext === 'mp3' || cleanMime.includes('mpeg') || cleanMime.includes('mp3')) return 'audio/mpeg';
  if (ext === 'flac' || cleanMime.includes('flac')) return 'audio/flac';
  if (ext === 'wav' || cleanMime.includes('wav') || cleanMime.includes('wave')) return 'audio/wav';
  if (ext === 'ogg' || ext === 'oga' || cleanMime.includes('ogg') || cleanMime.includes('opus')) return 'audio/ogg';
  if (ext === 'aac' || cleanMime.includes('aac')) return 'audio/aac';
  if (ext === 'm4a' || ext === 'mp4' || cleanMime.includes('mp4') || cleanMime.includes('m4a')) return 'audio/mp4';
  if (ext === 'webm' || cleanMime.includes('webm')) return 'audio/webm';
  if (cleanMime.startsWith('audio/')) return cleanMime;

  // Never return video/* or application/octet-stream; default strictly to audio/mpeg
  return 'audio/mpeg';
}

export interface MimusicaStructure {
  exists: boolean;
  rootFolder: DriveFolder | null;
  subfolders: Array<{ folder: DriveFolder; trackCount: number }>;
  allTracks: AudioTrack[];
  rootOnlyTracks: AudioTrack[];
  tracksByFolderId: Record<string, AudioTrack[]>;
}

export class DriveService {
  private blobCache: Map<string, string> = new Map();
  private folderArtworkCache: Map<string, { url: string; format: ImageFormat }> = new Map();
  private cachedMusicRootFolder: DriveFolder | null = null;
  private cachedMimusicaStructure: MimusicaStructure | null = null;
  private folderDetailsCache: Map<string, { id: string; name: string; parentId?: string; path: string }> = new Map();

  public clearRootCache() {
    this.cachedMusicRootFolder = null;
    this.cachedMimusicaStructure = null;
    this.folderArtworkCache.clear();
    this.folderDetailsCache.clear();
  }

  /**
   * Retrieves the user-selected music root folder from persistent storage.
   */
  public getSelectedMusicFolder(): DriveFolder | null {
    try {
      const raw = localStorage.getItem(SELECTED_FOLDER_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Updates the selected music root folder (e.g. from Google Picker API).
   */
  public setSelectedMusicFolder(folder: DriveFolder | null) {
    this.cachedMusicRootFolder = folder;
    if (folder) {
      try {
        localStorage.setItem(SELECTED_FOLDER_STORAGE_KEY, JSON.stringify(folder));
      } catch (e) {
        console.warn('Could not save selected folder:', e);
      }
      this.folderDetailsCache.set(folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: 'root',
        path: `/${folder.name}`
      });
    } else {
      localStorage.removeItem(SELECTED_FOLDER_STORAGE_KEY);
    }
  }

  /**
   * Launches the official Google Picker dialog to allow the user to select
   * any music folder in their Google Drive with drive.file authorization.
   */
  public async promptPickMusicFolder(): Promise<DriveFolder | null> {
    const folder = await googlePickerService.pickMusicFolder();
    if (folder) {
      this.setSelectedMusicFolder(folder);
      await dbService.saveFolders([folder]).catch(() => {});
    }
    return folder;
  }

  /**
   * Checks whether a music root folder is linked in AudioCar.
   */
  public async checkMusicRootFolderStatus(): Promise<{ exists: boolean; folder?: DriveFolder; userEmail?: string }> {
    const user = authService.getUser();
    if (!user) {
      return { exists: false };
    }
    const root = await this.getMusicRootFolder(false);
    return {
      exists: !!root,
      folder: root || undefined,
      userEmail: user.email
    };
  }

  /**
   * Clears the cached root folder so fresh Drive changes can be scanned.
   */
  public clearMusicRootCache(): void {
    this.cachedMusicRootFolder = null;
    this.cachedMimusicaStructure = null;
  }

  private getHeaders(tokenOverride?: string): HeadersInit {
    const token = tokenOverride || authService.getAccessToken();
    if (!token) {
      throw new Error('No active Google Drive session. Please sign in.');
    }
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    };
  }

  /**
   * Finds the user's dedicated root folder ("mimusica").
   * STRICT DIRECTIVE: AudioCar NEVER creates the folder.
   * The user creates "/mimusica" in their Google Drive and places their music inside.
   */
  async getMusicRootFolder(forceRefresh: boolean = false): Promise<DriveFolder | null> {
    if (!forceRefresh && this.cachedMusicRootFolder) {
      return this.cachedMusicRootFolder;
    }

    if (forceRefresh) {
      this.cachedMusicRootFolder = null;
      this.cachedMimusicaStructure = null;
    }

    const token = authService.getAccessToken();
    if (!token) return null;

    // Check if the user previously linked a folder using Google Picker
    const selected = this.getSelectedMusicFolder();
    if (selected) {
      try {
        const verifyRes = await fetchWithDriveBackoff(
          `${DRIVE_API_URL}/files/${selected.id}?fields=id,name,parents,trashed`,
          { headers: this.getHeaders(token) }
        );
        if (verifyRes.ok) {
          const fileData = await verifyRes.json();
          if (!fileData.trashed) {
            const validFolder: DriveFolder = {
              id: fileData.id,
              name: fileData.name || selected.name,
              parentId: fileData.parents?.[0] || 'root',
              path: `/${fileData.name || selected.name}`
            };
            this.cachedMusicRootFolder = validFolder;
            this.folderDetailsCache.set(validFolder.id, {
              id: validFolder.id,
              name: validFolder.name,
              parentId: 'root',
              path: `/${validFolder.name}`
            });
            return validFolder;
          }
        }
      } catch (e) {
        console.warn('Could not verify stored selected folder, falling back to query:', e);
      }
    }

    try {
      // 1. Direct query for folder named "mimusica" or common casing variations
      const queryNameFilters = [
        "name = 'mimusica'",
        "name = 'MiMusica'",
        "name = 'Mi musica'",
        "name = 'Mi música'",
        "name = 'música'",
        "name = 'Música'",
        "name = 'Musica'",
        "name = 'Music'",
        "name contains 'mimusica'"
      ].join(' or ');

      const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${queryNameFilters})`);
      const url = `${DRIVE_API_URL}/files?q=${q}&fields=files(id, name, parents, modifiedTime)&pageSize=100&orderBy=name`;

      const res = await fetchWithDriveBackoff(url, { headers: this.getHeaders(token) });
      if (!res.ok) {
        if (res.status === 401) {
          authService.signOut();
        }
        return null;
      }

      const data = await res.json();
      const matchedFolders = data.files || [];

      if (matchedFolders.length > 0) {
        // Prioritize exact match "mimusica"
        const exactMatch = matchedFolders.find((f: any) => f.name.toLowerCase() === 'mimusica');
        const bestFolder = exactMatch || matchedFolders[0];

        const rootFolder: DriveFolder = {
          id: bestFolder.id,
          name: bestFolder.name,
          parentId: bestFolder.parents?.[0] || 'root',
          path: `/${bestFolder.name}`
        };
        this.cachedMusicRootFolder = rootFolder;
        this.folderDetailsCache.set(rootFolder.id, {
          id: rootFolder.id,
          name: rootFolder.name,
          parentId: 'root',
          path: `/${rootFolder.name}`
        });
        return rootFolder;
      }

      // 2. Fallback: Search all folders to find case-insensitive 'mimusica'
      let pageToken: string | undefined = undefined;
      const allFolders: any[] = [];
      const allQ = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");

      do {
        const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const allUrl = `${DRIVE_API_URL}/files?q=${allQ}&fields=nextPageToken,files(id, name, parents)&pageSize=500${pageParam}`;
        const allRes = await fetchWithDriveBackoff(allUrl, { headers: this.getHeaders(token) });
        if (!allRes.ok) break;

        const allData = await allRes.json();
        pageToken = allData.nextPageToken;
        if (allData.files) {
          allFolders.push(...allData.files);
        }
      } while (pageToken);

      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '');

      const found = allFolders.find((f: any) => normalize(f.name) === 'mimusica' || normalize(f.name).includes('musica'));
      if (found) {
        const rootFolder: DriveFolder = {
          id: found.id,
          name: found.name,
          parentId: found.parents?.[0] || 'root',
          path: `/${found.name}`
        };
        this.cachedMusicRootFolder = rootFolder;
        this.folderDetailsCache.set(rootFolder.id, {
          id: rootFolder.id,
          name: rootFolder.name,
          parentId: 'root',
          path: `/${rootFolder.name}`
        });
        return rootFolder;
      }

      // 3. User directive: Never auto-create "/mimusica".
      // If not found, return null so UI invites the user to create "mimusica" in their Google Drive.
    } catch (e) {
      console.warn('Error locating "mimusica" folder in Drive:', e);
    }

    return null;
  }

  /**
   * Scans and builds the complete structure of "/mimusica".
   * Returns:
   * - exists: whether "/mimusica" was found
   * - rootFolder: the DriveFolder object for "/mimusica"
   * - subfolders: list of direct subfolders with their track counts
   * - allTracks: all audio tracks in "/mimusica" and its subdirectories
   * - rootOnlyTracks: audio tracks directly in the root of "/mimusica"
   * - tracksByFolderId: map of folder ID to its audio tracks
   */
  async getMimusicaStructure(
    forceRefresh: boolean = false,
    onProgress?: (progress: { percent: number; step: string }) => void
  ): Promise<MimusicaStructure> {
    if (!forceRefresh && this.cachedMimusicaStructure) {
      return this.cachedMimusicaStructure;
    }

    const token = authService.getAccessToken();
    if (!token) {
      return {
        exists: false,
        rootFolder: null,
        subfolders: [],
        allTracks: [],
        rootOnlyTracks: [],
        tracksByFolderId: {}
      };
    }

    onProgress?.({ percent: 15, step: 'Buscando carpeta /mimusica en Google Drive...' });
    const rootFolder = await this.getMusicRootFolder(forceRefresh);
    if (!rootFolder) {
      this.cachedMimusicaStructure = {
        exists: false,
        rootFolder: null,
        subfolders: [],
        allTracks: [],
        rootOnlyTracks: [],
        tracksByFolderId: {}
      };
      return this.cachedMimusicaStructure;
    }

    onProgress?.({ percent: 30, step: 'Explorando subcarpetas de /mimusica...' });
    // 1. Get direct subfolders
    const directSubfolders = await this.listFolders(rootFolder.id);

    onProgress?.({ percent: 45, step: 'Leyendo canciones en /mimusica...' });
    // 2. Get all audio files in /mimusica and all its descendants
    const allTracks = await this.listAudioFiles(undefined, undefined, onProgress);

    // 3. Organize tracks by folder
    const tracksByFolderId: Record<string, AudioTrack[]> = {};
    tracksByFolderId[rootFolder.id] = [];

    for (const sub of directSubfolders) {
      tracksByFolderId[sub.id] = [];
    }

    const rootOnlyTracks: AudioTrack[] = [];

    for (const track of allTracks) {
      const parentId = track.folderId;
      if (parentId && tracksByFolderId[parentId]) {
        tracksByFolderId[parentId].push(track);
      } else {
        // Match by folder path or album name if parentId doesn't match directly
        let matchedSub = false;
        for (const sub of directSubfolders) {
          const subLower = sub.name.toLowerCase();
          if (
            track.folderPath?.toLowerCase().includes(`/${subLower}`) ||
            track.album?.toLowerCase() === subLower
          ) {
            tracksByFolderId[sub.id].push(track);
            matchedSub = true;
            break;
          }
        }
        if (!matchedSub) {
          tracksByFolderId[rootFolder.id].push(track);
        }
      }

      if (track.folderId === rootFolder.id || track.folderPath === `/${rootFolder.name}`) {
        rootOnlyTracks.push(track);
      }
    }

    const subfoldersWithCounts = directSubfolders.map((folder) => ({
      folder,
      trackCount: tracksByFolderId[folder.id]?.length || 0
    }));

    const result: MimusicaStructure = {
      exists: true,
      rootFolder,
      subfolders: subfoldersWithCounts,
      allTracks,
      rootOnlyTracks,
      tracksByFolderId
    };

    this.cachedMimusicaStructure = result;
    return result;
  }

  /**
   * Recursively discovers all subfolders under root and constructs their paths.
   * Uses complete pagination (nextPageToken) to discover 100% of nested directories.
   */
  async getAllSubfoldersHierarchy(rootFolder: DriveFolder): Promise<Map<string, { id: string; name: string; parentId?: string; path: string }>> {
    const token = authService.getAccessToken();
    const folderMap = new Map<string, { id: string; name: string; parentId?: string; path: string }>();

    folderMap.set(rootFolder.id, {
      id: rootFolder.id,
      name: rootFolder.name,
      parentId: 'root',
      path: `/${rootFolder.name}`
    });

    if (!token) return folderMap;

    const queue: { id: string; path: string }[] = [{ id: rootFolder.id, path: `/${rootFolder.name}` }];

    try {
      while (queue.length > 0) {
        const currentBatch = queue.splice(0, 15);
        const parentConditions = currentBatch.map((item) => `'${item.id}' in parents`).join(' or ');
        const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${parentConditions})`);
        
        let pageToken: string | undefined = undefined;
        do {
          const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
          const url = `${DRIVE_API_URL}/files?q=${q}&fields=nextPageToken,files(id, name, parents)&pageSize=1000${pageParam}`;

          const res = await fetchWithDriveBackoff(url, { headers: this.getHeaders(token) });
          if (!res.ok) break;

          const data = await res.json();
          pageToken = data.nextPageToken;
          const childFolders = data.files || [];

          for (const f of childFolders) {
            const parentId = f.parents?.[0] || rootFolder.id;
            const parentPath = folderMap.get(parentId)?.path || `/${rootFolder.name}`;
            const childPath = `${parentPath}/${f.name}`;

            if (!folderMap.has(f.id)) {
              const info = {
                id: f.id,
                name: f.name,
                parentId,
                path: childPath
              };
              folderMap.set(f.id, info);
              this.folderDetailsCache.set(f.id, info);
              queue.push({ id: f.id, path: childPath });
            }
          }
        } while (pageToken);
      }
    } catch (e) {
      console.warn('Error during recursive subfolder discovery:', e);
    }

    return folderMap;
  }

  /**
   * Search and list all audio files ONLY inside "mimusica" and its subdirectories.
   * Iterates through all pages using `nextPageToken` to guarantee 100% of songs are returned.
   */
  async listAudioFiles(
    folderId?: string,
    searchFilter?: string,
    onProgress?: (progress: { percent: number; step: string }) => void
  ): Promise<AudioTrack[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Usuario no autenticado en Google Drive');

    onProgress?.({ percent: 20, step: 'Localizando carpeta /mimusica...' });
    const musicRoot = await this.getMusicRootFolder(false);
    if (!musicRoot) {
      return [];
    }

    onProgress?.({ percent: 35, step: 'Explorando subcarpetas de música...' });
    // Discover full folder hierarchy
    const hierarchy = await this.getAllSubfoldersHierarchy(musicRoot);

    let targetFolderIds: string[] = [];

    if (folderId && folderId !== 'root' && folderId !== 'root_all') {
      targetFolderIds = [folderId];
      await this.discoverFolderArtwork(folderId).catch(() => {});
    } else {
      targetFolderIds = Array.from(hierarchy.keys());
    }

    if (targetFolderIds.length === 0) return [];

    onProgress?.({ percent: 50, step: `Buscando pistas de audio en ${targetFolderIds.length} carpeta(s)...` });

    const chunkSize = 10;
    const allFiles: any[] = [];

    for (let i = 0; i < targetFolderIds.length; i += chunkSize) {
      const batchIds = targetFolderIds.slice(i, i + chunkSize);
      const parentFilter = batchIds.map((id) => `'${id}' in parents`).join(' or ');

      const batchProgressPercent = Math.min(80, Math.round(50 + ((i + 1) / targetFolderIds.length) * 30));
      onProgress?.({
        percent: batchProgressPercent,
        step: `Leyendo archivos de audio (${allFiles.length} canciones encontradas)...`
      });

      // Query all non-folder files within these parent folders
      let queryParts = [
        `trashed = false`,
        `mimeType != 'application/vnd.google-apps.folder'`,
        `(${parentFilter})`
      ];

      if (searchFilter && searchFilter.trim()) {
        const cleanFilter = searchFilter.replace(/'/g, "\\'");
        queryParts.push(`name contains '${cleanFilter}'`);
      }

      const q = encodeURIComponent(queryParts.join(' and '));
      const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webContentLink, parents, videoMediaMetadata)');
      
      let pageToken: string | undefined = undefined;

      try {
        do {
          const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
          const url = `${DRIVE_API_URL}/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=name${pageParam}`;

          const res = await fetchWithDriveBackoff(url, { headers: this.getHeaders(token) });
          if (!res.ok) {
            if (res.status === 401) {
              authService.signOut();
              throw new Error('Sesión expirada. Inicia sesión nuevamente.');
            }
            const errorData = await res.json().catch(() => ({}));
            console.warn('Drive query error:', errorData);
            break;
          }

          const data = await res.json();
          pageToken = data.nextPageToken;

          if (data.files && Array.isArray(data.files)) {
            allFiles.push(...data.files);
          }
        } while (pageToken);
      } catch (err: any) {
        console.error('Batch audio list error:', err);
      }
    }

    // Filter down to valid audio files (excluding covers/images, documents, and non-audio formats)
    const validAudioFiles = allFiles.filter((file: any) => {
      const name = (file.name || '').toLowerCase();
      const ext = name.split('.').pop() || '';
      const mime = (file.mimeType || '').toLowerCase();

      // Explicitly reject non-audio documents or images
      if (NON_AUDIO_EXTENSIONS.has(ext)) return false;
      if (mime.startsWith('image/') || mime.startsWith('text/') || mime.includes('pdf')) return false;

      // Accept if audio extension or audio mimeType
      if (AUDIO_EXTENSIONS.has(ext)) return true;
      if (mime.startsWith('audio/') || mime === 'application/ogg' || mime.includes('flac') || mime.includes('wav')) return true;

      // Generic binary fallback: if it doesn't look like image or document, include
      return true;
    });

    // Resolve artwork for parents of the found tracks
    const uniqueParentIds = Array.from(new Set(validAudioFiles.map((f: any) => f.parents?.[0]).filter(Boolean))) as string[];
    if (uniqueParentIds.length > 0) {
      onProgress?.({ percent: 85, step: 'Recuperando carátulas e información de álbumes...' });
    }
    for (const parentId of uniqueParentIds) {
      if (!this.folderArtworkCache.has(parentId)) {
        await this.discoverFolderArtwork(parentId).catch(() => {});
      }
    }

    const tracks: AudioTrack[] = validAudioFiles.map((file: any) => {
      const parentFolderId = file.parents?.[0] || musicRoot.id;
      const folderInfo = hierarchy.get(parentFolderId) || this.folderDetailsCache.get(parentFolderId);
      const folderName = folderInfo ? folderInfo.name : 'mimusica';
      const folderPath = folderInfo ? folderInfo.path : `/${musicRoot.name}`;

      const parsed = this.parseAudioFilename(file.name);
      const folderArt = this.folderArtworkCache.get(parentFolderId);

      let finalArtworkUrl = file.thumbnailLink || '';
      let detectedFormat: ImageFormat = 'JPG';

      if (folderArt) {
        finalArtworkUrl = folderArt.url;
        detectedFormat = folderArt.format;
      } else if (file.thumbnailLink) {
        detectedFormat = 'JPG';
      }

      // If in a subfolder like "HAPPY_MUSIC", album is "HAPPY_MUSIC"
      const albumName = folderName !== 'mimusica' ? folderName : (parsed.album || 'mimusica');

      const safeMimeType = sanitizeAudioMimeType(file.mimeType, file.name);
      const durationMillis = file.videoMediaMetadata?.durationMillis ? parseInt(file.videoMediaMetadata.durationMillis, 10) : 0;
      const parsedDurationSec = durationMillis > 0 ? Math.round(durationMillis / 1000) : 0;

      return {
        id: `drive_${file.id}`,
        driveFileId: file.id,
        name: file.name,
        title: parsed.title,
        artist: parsed.artist,
        album: albumName,
        duration: parsedDurationSec,
        size: parseInt(file.size || '0', 10),
        mimeType: safeMimeType,
        thumbnailUrl: finalArtworkUrl,
        artworkFormat: detectedFormat,
        folderId: parentFolderId,
        folderPath: folderPath,
        source: 'drive',
        addedAt: new Date(file.modifiedTime).getTime() || Date.now()
      };
    });

    onProgress?.({ percent: 95, step: 'Indexando biblioteca en almacenamiento local...' });
    // Save to IndexedDB cache
    if (tracks.length > 0) {
      await dbService.saveTracks(tracks).catch(() => {});
    }

    onProgress?.({ percent: 100, step: `¡Sincronización completada! ${tracks.length} canciones encontradas.` });
    return tracks;
  }

  /**
   * Scans the entire Google Drive for any audio files (MP3, FLAC, M4A, WAV, OGG, AAC)
   * if no specific music folder was configured or if the music folder is empty.
   */
  async scanAllDriveAudioFiles(
    searchFilter?: string,
    onProgress?: (progress: { percent: number; step: string }) => void
  ): Promise<AudioTrack[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Usuario no autenticado en Google Drive');

    onProgress?.({ percent: 20, step: 'Escaneando archivos de audio en Google Drive...' });

    const audioConditions = [
      "mimeType contains 'audio/'",
      "name contains '.mp3'",
      "name contains '.flac'",
      "name contains '.m4a'",
      "name contains '.wav'",
      "name contains '.ogg'",
      "name contains '.aac'",
      "name contains '.opus'",
      "name contains '.wma'"
    ].join(' or ');

    let queryParts = [
      'trashed = false',
      "mimeType != 'application/vnd.google-apps.folder'",
      `(${audioConditions})`
    ];

    if (searchFilter && searchFilter.trim()) {
      const cleanFilter = searchFilter.replace(/'/g, "\\'");
      queryParts.push(`name contains '${cleanFilter}'`);
    }

    const q = encodeURIComponent(queryParts.join(' and '));
    const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, parents)');

    let pageToken: string | undefined = undefined;
    const allFiles: any[] = [];

    try {
      do {
        const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const url = `${DRIVE_API_URL}/files?q=${q}&fields=${fields}&pageSize=100&orderBy=name${pageParam}`;
        const res = await fetchWithDriveBackoff(url, { headers: this.getHeaders(token) });
        if (!res.ok) break;

        const data = await res.json();
        pageToken = data.nextPageToken;
        if (data.files && Array.isArray(data.files)) {
          allFiles.push(...data.files);
          onProgress?.({
            percent: Math.min(80, 20 + allFiles.length * 2),
            step: `Detectadas ${allFiles.length} pistas en Google Drive...`
          });
        }
      } while (pageToken && allFiles.length < 500);
    } catch (e) {
      console.warn('Error in scanAllDriveAudioFiles:', e);
    }

    const validAudio = allFiles.filter((file: any) => {
      const name = (file.name || '').toLowerCase();
      const ext = name.split('.').pop() || '';
      if (NON_AUDIO_EXTENSIONS.has(ext)) return false;
      return AUDIO_EXTENSIONS.has(ext) || (file.mimeType || '').includes('audio');
    });

    const tracks: AudioTrack[] = validAudio.map((file: any) => {
      const parsed = this.parseAudioFilename(file.name);
      return {
        id: file.id,
        name: file.name,
        title: parsed.title,
        artist: parsed.artist,
        album: parsed.album || 'Google Drive Audio',
        duration: 0,
        size: parseInt(file.size || '0', 10),
        mimeType: sanitizeAudioMimeType(file.mimeType, file.name),
        thumbnailUrl: file.thumbnailLink || '',
        artworkFormat: 'JPG',
        driveFileId: file.id,
        source: 'drive',
        bitrate: (file.name.toLowerCase().includes('.flac') ? 'FLAC Lossless' : '320 kbps'),
        addedAt: new Date(file.modifiedTime).getTime() || Date.now()
      };
    });

    if (tracks.length > 0) {
      await dbService.saveTracks(tracks).catch(() => {});
    }

    onProgress?.({ percent: 100, step: `¡Completado! ${tracks.length} canciones encontradas.` });
    return tracks;
  }

  /**
   * Search for companion image artwork files (JPG, PNG, GIF, WEBP) in a Google Drive folder
   * Fetches image data reliably using access token authorization.
   */
  async discoverFolderArtwork(folderId: string): Promise<{ url: string; format: ImageFormat } | null> {
    if (this.folderArtworkCache.has(folderId)) {
      return this.folderArtworkCache.get(folderId)!;
    }

    const token = authService.getAccessToken();
    if (!token || folderId === 'root' || folderId === 'root_all') return null;

    const imgQuery = `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.gif' or name contains '.webp')`;
    const q = encodeURIComponent(imgQuery);
    const fields = encodeURIComponent('files(id, name, mimeType, thumbnailLink, webContentLink)');
    const url = `${DRIVE_API_URL}/files?q=${q}&fields=${fields}&pageSize=20&orderBy=name`;

    try {
      const res = await fetchWithDriveBackoff(url, { headers: this.getHeaders(token) });
      if (!res.ok) return null;

      const data = await res.json();
      const images = data.files || [];

      if (images.length > 0) {
        // Prioritize common album art file names
        const selectedImage = images.find((img: any) =>
          /cover|album|folder|front|artwork|caratula|portada|disco/i.test(img.name)
        ) || images[0];

        let format: ImageFormat = 'JPG';
        const name = (selectedImage.name || '').toLowerCase();
        if (name.endsWith('.gif') || selectedImage.mimeType === 'image/gif') format = 'GIF';
        else if (name.endsWith('.png') || selectedImage.mimeType === 'image/png') format = 'PNG';
        else if (name.endsWith('.webp') || selectedImage.mimeType === 'image/webp') format = 'WEBP';

        // Try downloading image as authenticated Blob for 100% reliable rendering without 403 errors
        try {
          const blobRes = await fetchWithDriveBackoff(`${DRIVE_API_URL}/files/${selectedImage.id}?alt=media`, {
            headers: this.getHeaders(token)
          });
          if (blobRes.ok) {
            const blob = await blobRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const artworkData = { url: blobUrl, format };
            this.folderArtworkCache.set(folderId, artworkData);
            return artworkData;
          }
        } catch {
          // If blob fetch fails, fallback to direct links
        }

        const imgUrl = selectedImage.thumbnailLink || selectedImage.webContentLink || '';
        if (imgUrl) {
          const artworkData = { url: imgUrl, format };
          this.folderArtworkCache.set(folderId, artworkData);
          return artworkData;
        }
      }
    } catch (e) {
      console.warn('Could not discover folder artwork:', e);
    }

    return null;
  }

  /**
   * List direct subfolders inside a specific parent folder with full pagination
   */
  async listFolders(parentId?: string): Promise<DriveFolder[]> {
    const token = authService.getAccessToken();
    if (!token) return [];

    let targetParentId = parentId;

    if (!targetParentId || targetParentId === 'root' || targetParentId === 'root_all') {
      const musicRoot = await this.getMusicRootFolder(false);
      if (!musicRoot) return [];
      targetParentId = musicRoot.id;
    }

    const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${targetParentId}' in parents`);
    let pageToken: string | undefined = undefined;
    const allFolderFiles: any[] = [];

    try {
      do {
        const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const url = `${DRIVE_API_URL}/files?q=${q}&fields=nextPageToken,files(id, name, parents)&pageSize=1000&orderBy=name${pageParam}`;
        const res = await fetchWithDriveBackoff(url, { headers: this.getHeaders(token) });
        if (!res.ok) break;

        const data = await res.json();
        pageToken = data.nextPageToken;
        if (data.files && Array.isArray(data.files)) {
          allFolderFiles.push(...data.files);
        }
      } while (pageToken);

      const parentMeta = this.folderDetailsCache.get(targetParentId);
      const parentPath = parentMeta?.path || '';

      const folders: DriveFolder[] = allFolderFiles.map((f: any) => {
        const fullPath = parentPath ? `${parentPath}/${f.name}` : `/${f.name}`;
        const folderObj: DriveFolder = {
          id: f.id,
          name: f.name,
          parentId: targetParentId!,
          path: fullPath
        };
        this.folderDetailsCache.set(f.id, folderObj);
        return folderObj;
      });

      await dbService.saveFolders(folders).catch(() => {});
      return folders;
    } catch (e) {
      console.warn('Could not fetch folders:', e);
      return await dbService.getAllFolders();
    }
  }

  /**
   * Stream audio directly from Google Drive using Bearer Token or local IndexedDB cache
   * Returns a playable Object URL (Blob) with zero latency if pre-cached
   */
  async getStreamBlobUrl(driveFileId: string, _mimeType: string = 'audio/mpeg'): Promise<string> {
    const safeMime = sanitizeAudioMimeType(_mimeType);

    // 1. Check in-memory RAM blob cache
    if (this.blobCache.has(driveFileId)) {
      return this.blobCache.get(driveFileId)!;
    }

    // 2. Check persistent IndexedDB cache (stored from previous sessions or background prefetching)
    try {
      const persistedBlob = await dbService.getAudioBlob(driveFileId);
      if (persistedBlob) {
        // Ensure pure audio MIME typing so in-car Chromium browser never recognizes video stream
        const pureAudioBlob = new Blob([persistedBlob], { type: safeMime });
        const blobUrl = URL.createObjectURL(pureAudioBlob);
        this.cacheInMemory(driveFileId, blobUrl);
        return blobUrl;
      }
    } catch (e) {
      console.warn('Error reading from IndexedDB audio cache:', e);
    }

    // 3. Fetch from Google Drive API
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Autenticación requerida para reproducir pista');
    }

    const mediaUrl = `${DRIVE_API_URL}/files/${driveFileId}?alt=media`;

    try {
      const response = await fetchWithDriveBackoff(mediaUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error en streaming de Drive: HTTP ${response.status}`);
      }

      const rawBlob = await response.blob();
      // Crucial: strictly instantiate as audio MIME type to eliminate in-motion video safety warnings
      const audioBlob = new Blob([rawBlob], { type: safeMime });
      const blobUrl = URL.createObjectURL(audioBlob);
      
      // Cache in RAM
      this.cacheInMemory(driveFileId, blobUrl);

      // Persist asynchronously in IndexedDB for 4G/5G offline resilience
      dbService.saveAudioBlob(driveFileId, audioBlob).catch(() => {});

      return blobUrl;
    } catch (err) {
      console.error('Error fetching audio stream blob from Google Drive:', err);
      throw err;
    }
  }

  /**
   * Pre-fetches an upcoming track into IndexedDB cache in the background
   * Runs non-blockingly so driving through dead zones / tunnels never pauses the music.
   * Does NOT hold open Blob URLs in RAM for dormant queued tracks, preventing Safari/In-Car OOM crashes.
   */
  async prefetchStream(driveFileId: string): Promise<boolean> {
    if (!driveFileId) return false;

    // Already in IndexedDB?
    try {
      const hasInDb = await dbService.hasAudioBlob(driveFileId);
      if (hasInDb) {
        return true;
      }
    } catch {
      // Continue to network fetch
    }

    const token = authService.getAccessToken();
    if (!token) return false;

    try {
      const mediaUrl = `${DRIVE_API_URL}/files/${driveFileId}?alt=media`;
      const response = await fetchWithDriveBackoff(mediaUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return false;

      const rawBlob = await response.blob();
      const audioBlob = new Blob([rawBlob], { type: 'audio/mpeg' });

      // Persist binary directly in IndexedDB without holding open Blob URLs in RAM
      await dbService.saveAudioBlob(driveFileId, audioBlob);
      return true;
    } catch (e) {
      console.warn('Background audio prefetch error:', e);
      return false;
    }
  }

  /**
   * Caches active Blob URLs in RAM (capped strictly at max 2 items to prevent WebKit/Car RAM overflow)
   */
  private cacheInMemory(id: string, url: string) {
    if (this.blobCache.has(id)) {
      const existing = this.blobCache.get(id);
      if (existing && existing !== url) {
        URL.revokeObjectURL(existing);
      }
    }

    // Strictly limit active RAM Blob URLs to max 2 (playing track + next pre-warmed track)
    while (this.blobCache.size >= 2) {
      const oldestKey = this.blobCache.keys().next().value;
      if (oldestKey) {
        const oldUrl = this.blobCache.get(oldestKey);
        if (oldUrl) {
          try {
            URL.revokeObjectURL(oldUrl);
          } catch {}
        }
        this.blobCache.delete(oldestKey);
      } else {
        break;
      }
    }
    this.blobCache.set(id, url);
  }

  /**
   * Explicitly evicts and revokes all Blob URLs except for specified active IDs (e.g. current track & next track)
   */
  public evictOldBlobsExcept(keepIds: string[]) {
    const keepSet = new Set(keepIds.filter(Boolean));
    for (const [id, url] of this.blobCache.entries()) {
      if (!keepSet.has(id)) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        this.blobCache.delete(id);
      }
    }
  }

  public revokeBlob(id: string) {
    const url = this.blobCache.get(id);
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      this.blobCache.delete(id);
    }
  }

  public isStreamCached(driveFileId: string): boolean {
    return this.blobCache.has(driveFileId);
  }

  /**
   * Cleanly parses audio filenames into Title and Artist
   */
  public parseAudioFilename(filename: string): { title: string; artist: string; album?: string } {
    const cleanName = filename.replace(/\.(mp3|flac|m4a|wav|ogg|aac|opus|wma|alac|aiff|m4b|m4p|webm|oga)$/i, '');

    // Pattern: "Artist - Title" or "Artist - Track - Title"
    if (cleanName.includes(' - ')) {
      const parts = cleanName.split(' - ');
      if (parts.length >= 2) {
        const artist = parts[0].trim().replace(/^[0-9\s._-]+/, '');
        const title = parts.slice(1).join(' - ').trim().replace(/^[0-9\s._-]+/, '');
        return {
          title: title || cleanName,
          artist: artist || 'Artista Desconocido'
        };
      }
    }

    // Pattern: "01. Title" or "01 - Title" or "01 Title"
    const cleanedTitle = cleanName.replace(/^[0-9]{1,3}[\s._-]+/, '').trim();

    return {
      title: cleanedTitle || cleanName,
      artist: 'Artista Desconocido'
    };
  }

  /**
   * Playlists AppData Storage (Hidden AppData Folder)
   */
  async syncPlaylistsToDriveAppData(playlists: Playlist[]): Promise<boolean> {
    return this.savePlaylistsToDriveAppData(playlists);
  }

  async savePlaylistsToDriveAppData(playlists: Playlist[]): Promise<boolean> {
    const token = authService.getAccessToken();
    if (!token) return false;

    try {
      const listQ = encodeURIComponent("name = 'audiocar_playlists.json' and 'appDataFolder' in parents and trashed = false");
      const listUrl = `${DRIVE_API_URL}/files?q=${listQ}&spaces=appDataFolder&fields=files(id)`;
      const listRes = await fetchWithDriveBackoff(listUrl, { headers: this.getHeaders(token) });
      const listData = await listRes.json();
      const existingFile = listData.files?.[0];

      const blob = new Blob([JSON.stringify(playlists, null, 2)], { type: 'application/json' });

      if (existingFile) {
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
        await fetchWithDriveBackoff(updateUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: blob
        });
      } else {
        const metadata = {
          name: 'audiocar_playlists.json',
          parents: ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        await fetchWithDriveBackoff('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: form
        });
      }
      return true;
    } catch (e) {
      console.warn('Error saving playlists to AppData:', e);
      return false;
    }
  }

  async loadPlaylistsFromDriveAppData(): Promise<Playlist[]> {
    const token = authService.getAccessToken();
    if (!token) return [];

    try {
      const listQ = encodeURIComponent("name = 'audiocar_playlists.json' and 'appDataFolder' in parents and trashed = false");
      const listUrl = `${DRIVE_API_URL}/files?q=${listQ}&spaces=appDataFolder&fields=files(id)`;
      const listRes = await fetchWithDriveBackoff(listUrl, { headers: this.getHeaders(token) });
      const listData = await listRes.json();
      const existingFile = listData.files?.[0];

      if (!existingFile) return [];

      const downloadUrl = `${DRIVE_API_URL}/files/${existingFile.id}?alt=media`;
      const dlRes = await fetchWithDriveBackoff(downloadUrl, { headers: this.getHeaders(token) });
      if (dlRes.ok) {
        return await dlRes.json();
      }
    } catch (e) {
      console.warn('Error loading playlists from AppData:', e);
    }
    return [];
  }

  /**
   * Persists user audio, DSP and player preferences to Google Drive AppData folder
   * (audiocar_user_preferences.json).
   * Hidden, private, and roams across all browsers, PCs, and car dashboards.
   */
  async savePreferencesToDriveAppData(preferences: UserPreferences): Promise<boolean> {
    const token = authService.getAccessToken();
    if (!token) return false;

    try {
      const fileName = 'audiocar_user_preferences.json';
      const listQ = encodeURIComponent(`name = '${fileName}' and 'appDataFolder' in parents and trashed = false`);
      const listUrl = `${DRIVE_API_URL}/files?q=${listQ}&spaces=appDataFolder&fields=files(id)`;
      const listRes = await fetchWithDriveBackoff(listUrl, { headers: this.getHeaders(token) });
      const listData = await listRes.json();
      const existingFile = listData.files?.[0];

      const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });

      if (existingFile) {
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
        await fetchWithDriveBackoff(updateUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: blob
        });
      } else {
        const metadata = {
          name: fileName,
          parents: ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        await fetchWithDriveBackoff('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: form
        });
      }
      return true;
    } catch (e) {
      console.warn('[DriveService] Error saving preferences to AppData:', e);
      return false;
    }
  }

  /**
   * Retrieves saved user preferences from Google Drive AppData folder.
   */
  async loadPreferencesFromDriveAppData(): Promise<UserPreferences | null> {
    const token = authService.getAccessToken();
    if (!token) return null;

    try {
      const fileName = 'audiocar_user_preferences.json';
      const listQ = encodeURIComponent(`name = '${fileName}' and 'appDataFolder' in parents and trashed = false`);
      const listUrl = `${DRIVE_API_URL}/files?q=${listQ}&spaces=appDataFolder&fields=files(id)`;
      const listRes = await fetchWithDriveBackoff(listUrl, { headers: this.getHeaders(token) });
      const listData = await listRes.json();
      const existingFile = listData.files?.[0];

      if (!existingFile) return null;

      const downloadUrl = `${DRIVE_API_URL}/files/${existingFile.id}?alt=media`;
      const dlRes = await fetchWithDriveBackoff(downloadUrl, { headers: this.getHeaders(token) });
      if (dlRes.ok) {
        const data = await dlRes.json();
        return data as UserPreferences;
      }
    } catch (e) {
      console.warn('[DriveService] Error loading preferences from AppData:', e);
    }
    return null;
  }
}

export const driveService = new DriveService();
