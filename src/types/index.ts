/**
 * TeslaDrive Audio - Core Types & Interfaces
 */

export type ImageFormat = 'JPG' | 'PNG' | 'GIF' | 'WEBP' | 'SVG' | 'OTHER';
export type CloudProviderType = 'drive' | 'demo';

export interface AudioTrack {
  id: string;
  name: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  size?: number; // in bytes
  mimeType: string;
  thumbnailUrl?: string;
  artworkFormat?: ImageFormat;
  streamUrl?: string;
  driveFileId?: string;
  cloudFileId?: string;
  cloudPath?: string;
  folderId?: string;
  folderPath?: string;
  source: 'drive' | 'demo' | 'local';
  bitrate?: string;
  year?: string;
  cachedBlobUrl?: string;
  isFavorite?: boolean;
  addedAt?: number;
  lastPlayedAt?: number;
}

export interface CloudUserSession {
  provider: CloudProviderType;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  isManual?: boolean;
}

export interface CloudMusicProvider {
  providerId: CloudProviderType;
  name: string;
  iconName: string;
  login(): Promise<CloudUserSession>;
  logout(): Promise<void>;
  getSession(): CloudUserSession | null;
  listTracks(folderPath?: string): Promise<AudioTrack[]>;
  listFolders(parentId?: string): Promise<DriveFolder[]>;
  getStreamUrl(track: AudioTrack): Promise<string>;
  prefetchStream?(track: AudioTrack): Promise<boolean>;
  isConfigured(): boolean;
}

export interface DriveFolder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  itemCount?: number;
  coverUrl?: string;
}

export interface DriveImageFile {
  id: string;
  name: string;
  mimeType: string;
  parentId?: string;
  thumbnailLink?: string;
  webContentLink?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[];
  createdTime: number;
  updatedTime: number;
  isSyncedToDrive?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackMode = 'linear' | 'shuffle' | 'continuous' | 'repeat_one';
export type PlaybackScope = 'selected_folder' | 'all_folders';

export interface PlayerState {
  isPlaying: boolean;
  currentTrackIndex: number;
  queue: AudioTrack[];
  currentTime: number;
  duration: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playbackMode: PlaybackMode; // Lineal, Suflé, Continuo, Repetir 1
  playbackScope: PlaybackScope; // 'selected_folder' | 'all_folders'
  isCrossfadeEnabled: boolean;
  crossfadeDuration: number; // 1 to 12 seconds
  isFadeInOutEnabled: boolean;
  fadeInOutDuration: number; // in seconds (0.5 to 10s)
  playbackRate: number; // 0.75, 1.0, 1.25, 1.5, 2.0
  isLoading: boolean;
  bufferedEnd: number;
  error: string | null;
  eqPreset: string;
  isNormalizationEnabled: boolean;
  normalizationPreset: 'balanced' | 'dynamic' | 'night';
  bufferAheadCount: number; // Number of upcoming tracks to preload in memory/IndexedDB (1 to 5)
  preloadedTrackIds: string[]; // List of track IDs currently cached and ready for 0ms offline playback
  isPreloading: boolean;
}

export interface DriveAuthUser {
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  expiresAt: number;
  isManual?: boolean;
}

export type ActiveView = 'player' | 'library' | 'playlists' | 'recent' | 'favorites' | 'folders' | 'search';

export interface UserPreferences {
  email: string;
  playbackMode: PlaybackMode;
  playbackScope: PlaybackScope;
  volume: number;
  playbackRate: number;
  eqPreset: string;
  isCrossfadeEnabled: boolean;
  crossfadeDuration: number;
  isFadeInOutEnabled: boolean;
  fadeInOutDuration: number;
  isNormalizationEnabled: boolean;
  normalizationPreset: 'balanced' | 'dynamic' | 'night';
  bufferAheadCount: number;
  theme: 'dark' | 'light';
  hideDemoTracks: boolean;
  ledColor?: string;
  isLedPulseActive?: boolean;
  lastUpdated: number;
}
