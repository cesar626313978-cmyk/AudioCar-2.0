/**
 * Google Picker API Service for AudioCar
 * Allows users to select their music folder or individual audio tracks using
 * the official Google Drive Picker dialog.
 *
 * CRITICAL ARCHITECTURAL BENEFIT:
 * Using Google Picker with drive.file (Sensitive scope) completely eliminates
 * the need for the costly and lengthy ADA-CASA AL1 / Tier 2 security audit
 * (required only for drive.readonly / Restricted scopes), while allowing AudioCar
 * to legally and safely read the user's music library in production.
 */

import { authService } from './authService';
import { DriveFolder, AudioTrack } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

class GooglePickerService {
  private isPickerLoaded = false;
  private pickerLoadingPromise: Promise<void> | null = null;

  /**
   * Retrieves the public Google API Key for Google Picker API
   */
  private getApiKey(): string {
    return (
      ((import.meta as any).env?.VITE_GOOGLE_API_KEY as string) ||
      firebaseConfig.apiKey ||
      ''
    );
  }

  /**
   * Extracts the Google Cloud Project Number (App ID) from the Client ID
   */
  private getAppId(): string {
    const clientId = authService.getClientId();
    if (clientId && clientId.includes('-')) {
      return clientId.split('-')[0];
    }
    return '';
  }

  /**
   * Ensures the Google Picker API script and library are loaded in the browser
   */
  public async loadPickerApi(): Promise<void> {
    if (this.isPickerLoaded && window.google?.picker) {
      return;
    }

    if (this.pickerLoadingPromise) {
      return this.pickerLoadingPromise;
    }

    this.pickerLoadingPromise = new Promise<void>((resolve, reject) => {
      const checkGapi = () => {
        if (typeof window === 'undefined') return;

        if (window.google?.picker) {
          this.isPickerLoaded = true;
          resolve();
          return;
        }

        if (window.gapi) {
          window.gapi.load('picker', {
            callback: () => {
              this.isPickerLoaded = true;
              resolve();
            },
            onerror: () => {
              reject(new Error('No se pudo cargar la librería Google Picker API.'));
            }
          });
        } else {
          // Retry polling for script tag up to 10 seconds
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            if (window.gapi) {
              clearInterval(interval);
              window.gapi.load('picker', {
                callback: () => {
                  this.isPickerLoaded = true;
                  resolve();
                },
                onerror: () => {
                  reject(new Error('No se pudo cargar la librería Google Picker API.'));
                }
              });
            } else if (attempts > 50) {
              clearInterval(interval);
              reject(new Error('Tiempo de espera agotado al cargar la API de Google.'));
            }
          }, 200);
        }
      };

      checkGapi();
    });

    return this.pickerLoadingPromise;
  }

  /**
   * Opens the Google Picker dialog configured to select a music folder (e.g. /mimusica or any folder).
   * Grants drive.file permission to AudioCar for the chosen folder and its subfiles.
   */
  public async pickMusicFolder(title: string = 'Selecciona tu Carpeta de Música (AudioCar)'): Promise<DriveFolder | null> {
    await this.loadPickerApi();

    let token = authService.getAccessToken();
    if (!token) {
      const user = await authService.requestSignIn();
      token = user.accessToken;
    }

    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación para Google Drive.');
    }

    const apiKey = this.getApiKey();
    const appId = this.getAppId();

    return new Promise<DriveFolder | null>((resolve, reject) => {
      try {
        const google = window.google;
        if (!google?.picker) {
          throw new Error('Google Picker API no está disponible en este momento.');
        }

        // Configure Folder selection view
        const docsView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setMimeTypes('application/vnd.google-apps.folder')
          .setMode(google.picker.DocsViewMode.LIST);

        const builder = new google.picker.PickerBuilder()
          .setTitle(title)
          .addView(docsView)
          .setOAuthToken(token)
          .setCallback((data: any) => {
            if (data.action === google.picker.Action.PICKED) {
              const doc = data.docs?.[0];
              if (doc) {
                const folder: DriveFolder = {
                  id: doc.id,
                  name: doc.name || 'Música',
                  parentId: doc.parentId || 'root',
                  path: `/${doc.name || 'Música'}`
                };
                resolve(folder);
              } else {
                resolve(null);
              }
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve(null);
            }
          });

        if (apiKey) {
          builder.setDeveloperKey(apiKey);
        }
        if (appId) {
          builder.setAppId(appId);
        }

        const picker = builder.build();
        picker.setVisible(true);
      } catch (err) {
        console.warn('Error al abrir Google Picker:', err);
        reject(err);
      }
    });
  }

  /**
   * Opens the Google Picker dialog configured to select individual audio files
   * with multi-selection enabled.
   */
  public async pickAudioFiles(title: string = 'Seleccionar Archivos de Audio'): Promise<AudioTrack[] | null> {
    await this.loadPickerApi();

    let token = authService.getAccessToken();
    if (!token) {
      const user = await authService.requestSignIn();
      token = user.accessToken;
    }

    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación para Google Drive.');
    }

    const apiKey = this.getApiKey();
    const appId = this.getAppId();

    return new Promise<AudioTrack[] | null>((resolve, reject) => {
      try {
        const google = window.google;
        if (!google?.picker) {
          throw new Error('Google Picker API no está disponible en este momento.');
        }

        // View for audio files
        const audioView = new google.picker.View(google.picker.ViewId.DOCS)
          .setMimeTypes('audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/aac,audio/m4a,audio/mp4,audio/x-m4a');

        const builder = new google.picker.PickerBuilder()
          .setTitle(title)
          .addView(audioView)
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
          .setOAuthToken(token)
          .setCallback((data: any) => {
            if (data.action === google.picker.Action.PICKED) {
              const docs: any[] = data.docs || [];
              const tracks: AudioTrack[] = docs.map((doc, idx) => ({
                id: doc.id,
                name: doc.name || 'Pista de audio',
                driveFileId: doc.id,
                cloudFileId: doc.id,
                cloudProvider: 'drive',
                title: (doc.name || 'Pista de audio').replace(/\.[^/.]+$/, ''),
                artist: 'Google Drive',
                album: 'Pistas seleccionadas',
                duration: 0,
                format: (doc.name?.split('.').pop() || 'mp3').toUpperCase(),
                mimeType: doc.mimeType || 'audio/mpeg',
                source: 'drive',
                syncStatus: 'synced',
                trackNumber: idx + 1,
                folderPath: '/Google Drive'
              }));
              resolve(tracks);
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve(null);
            }
          });

        if (apiKey) {
          builder.setDeveloperKey(apiKey);
        }
        if (appId) {
          builder.setAppId(appId);
        }

        const picker = builder.build();
        picker.setVisible(true);
      } catch (err) {
        console.warn('Error al abrir Google Picker para audio:', err);
        reject(err);
      }
    });
  }
}

export const googlePickerService = new GooglePickerService();
