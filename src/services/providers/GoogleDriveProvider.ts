/**
 * Google Drive Cloud Music Provider
 * Integrates Google Drive API v3 and Google Identity Services/Firebase Auth
 * under the common CloudMusicProvider interface.
 */

import { AudioTrack, DriveFolder, CloudMusicProvider, CloudUserSession } from '../../types';
import { authService } from '../authService';
import { driveService } from '../driveService';

export class GoogleDriveProvider implements CloudMusicProvider {
  public providerId = 'drive' as const;
  public name = 'Google Drive';
  public iconName = 'drive';

  public isConfigured(): boolean {
    return !!authService.getUser();
  }

  public getSession(): CloudUserSession | null {
    const user = authService.getUser();
    if (!user) return null;

    return {
      provider: 'drive',
      email: user.email,
      name: user.name,
      picture: user.picture,
      accessToken: user.accessToken,
      expiresAt: user.expiresAt
    };
  }

  public async login(): Promise<CloudUserSession> {
    const user = await authService.requestSignIn();
    return {
      provider: 'drive',
      email: user.email,
      name: user.name,
      picture: user.picture,
      accessToken: user.accessToken,
      expiresAt: user.expiresAt
    };
  }

  public async logout(): Promise<void> {
    await authService.signOut();
    driveService.clearRootCache();
  }

  public async listTracks(_folderPath?: string, onProgress?: (progress: { percent: number; step: string }) => void): Promise<AudioTrack[]> {
    return await driveService.listAudioFiles(undefined, undefined, onProgress);
  }

  public async listFolders(parentId?: string): Promise<DriveFolder[]> {
    return await driveService.listFolders(parentId);
  }

  public async getStreamUrl(track: AudioTrack): Promise<string> {
    const fileId = track.cloudFileId || track.driveFileId;
    if (fileId) {
      // If Service Worker is active and controlling requests, use virtual CORS-free stream route
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return `/stream/${fileId}`;
      }
      return await driveService.getStreamBlobUrl(fileId, track.mimeType);
    }
    return track.streamUrl || '';
  }

  public async prefetchStream(track: AudioTrack): Promise<boolean> {
    const fileId = track.cloudFileId || track.driveFileId;
    if (fileId) {
      return await driveService.prefetchStream(fileId);
    }
    return false;
  }
}

export const googleDriveProvider = new GoogleDriveProvider();
