/**
 * Demo Cloud Music Provider
 * Provides offline instant playback of built-in high-quality demo tracks.
 */

import { AudioTrack, DriveFolder, CloudMusicProvider, CloudUserSession } from '../../types';
import { DEMO_TRACKS } from '../../data/demoTracks';

export class DemoProvider implements CloudMusicProvider {
  public providerId = 'demo' as const;
  public name = 'Modo Demo';
  public iconName = 'sparkles';

  public isConfigured(): boolean {
    return true;
  }

  public getSession(): CloudUserSession | null {
    return {
      provider: 'demo',
      email: 'demo@audiocar.app',
      name: 'Biblioteca de Prueba',
      accessToken: 'demo_token',
      expiresAt: Date.now() + 1000 * 3600 * 24 * 365
    };
  }

  public async login(): Promise<CloudUserSession> {
    return this.getSession()!;
  }

  public async logout(): Promise<void> {}

  public async listTracks(): Promise<AudioTrack[]> {
    return DEMO_TRACKS;
  }

  public async listFolders(): Promise<DriveFolder[]> {
    return [
      { id: 'demo_electronic', name: 'Electronic', parentId: 'root', path: '/mimusica/Electronic' },
      { id: 'demo_synthwave', name: 'Synthwave', parentId: 'root', path: '/mimusica/Synthwave' },
      { id: 'demo_rock', name: 'Rock & Indie', parentId: 'root', path: '/mimusica/Rock' }
    ];
  }

  public async getStreamUrl(track: AudioTrack): Promise<string> {
    const fresh = DEMO_TRACKS.find((d) => d.id === track.id);
    return fresh?.streamUrl || track.streamUrl || '';
  }

  public async prefetchStream(): Promise<boolean> {
    return true;
  }
}

export const demoProvider = new DemoProvider();
