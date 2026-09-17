/**
 * User Preferences Management Service - AudioCar
 * Saves, loads, and applies audio, DSP, and app configuration per Gmail/Google Account.
 * Features 3-Tier Multi-Storage Architecture:
 * 1. Fast In-Memory State (Synchronous zero-lag access)
 * 2. Local Persistence (IndexedDB + localStorage with navigator.storage.persist for automotive sleep tolerance)
 * 3. Google Drive AppData Cloud Sync (audiocar_user_preferences.json for roaming across all devices & browsers)
 */

import { UserPreferences, PlaybackMode, PlaybackScope } from '../types';
import { dbService } from './dbService';
import { authService } from './authService';
import { driveService } from './driveService';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'email'> = {
  playbackMode: 'linear',
  playbackScope: 'all_folders',
  volume: 0.85,
  playbackRate: 1.0,
  eqPreset: 'Balanced',
  isCrossfadeEnabled: false,
  crossfadeDuration: 4,
  isFadeInOutEnabled: true,
  fadeInOutDuration: 3,
  isNormalizationEnabled: true,
  normalizationPreset: 'balanced',
  bufferAheadCount: 3,
  theme: 'dark',
  hideDemoTracks: false,
  ledColor: 'sport-red',
  isLedPulseActive: true,
  lastUpdated: 0
};

const STORAGE_PREFIX = 'audiocar_user_prefs_';
type PreferencesListener = (prefs: UserPreferences) => void;
type SyncStatusListener = (status: CloudSyncStatus) => void;

class PreferencesService {
  private currentPreferences: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    email: 'default'
  };
  private listeners: Set<PreferencesListener> = new Set();
  private syncStatusListeners: Set<SyncStatusListener> = new Set();
  private isApplying: boolean = false;
  private cloudSyncStatus: CloudSyncStatus = 'offline';
  private cloudDebounceTimer: any = null;
  private isSyncingWithCloud: boolean = false;

  constructor() {
    // Request Chromium persistent storage to prevent vehicle sleep/deep power cycle eviction
    if (typeof navigator !== 'undefined' && 'storage' in navigator && typeof (navigator.storage as any).persist === 'function') {
      (navigator.storage as any).persist().catch(() => {});
    }

    // Initial local load
    const user = authService.getUser();
    const initialEmail = user?.email || 'default';
    this.currentPreferences.email = initialEmail;
    this.loadPreferencesForUser(initialEmail).catch(() => {});

    // Listen to Google Auth changes to trigger Cloud Sync
    authService.subscribe((authUser) => {
      if (authUser?.email) {
        this.currentPreferences.email = authUser.email.toLowerCase().trim();
        this.syncWithCloud(authUser.email).catch((err) => {
          console.warn('[PreferencesService] Cloud sync error after auth event:', err);
        });
      } else {
        this.setCloudSyncStatus('offline');
      }
    });
  }

  public getActiveEmail(): string {
    const user = authService.getUser();
    return user?.email ? user.email.toLowerCase().trim() : 'default';
  }

  public getCloudSyncStatus(): CloudSyncStatus {
    return this.cloudSyncStatus;
  }

  private setCloudSyncStatus(status: CloudSyncStatus) {
    if (this.cloudSyncStatus === status) return;
    this.cloudSyncStatus = status;
    this.syncStatusListeners.forEach((l) => l(status));
  }

  private getStorageKey(email: string): string {
    const sanitized = email.toLowerCase().trim() || 'default';
    return `${STORAGE_PREFIX}${sanitized}`;
  }

  /**
   * Loads the saved preferences for a given user email from IndexedDB and localStorage,
   * then kicks off background cloud synchronization with Google Drive AppData.
   */
  public async loadPreferencesForUser(userEmail?: string): Promise<UserPreferences> {
    const email = (userEmail || this.getActiveEmail()).toLowerCase().trim();
    const storageKey = this.getStorageKey(email);

    let savedPrefs: Partial<UserPreferences> | null = null;

    // 1. Try IndexedDB
    try {
      savedPrefs = await dbService.getSetting<UserPreferences | null>(storageKey, null);
    } catch (e) {
      console.warn('Could not read user preferences from IndexedDB:', e);
    }

    // 2. Fallback to localStorage
    if (!savedPrefs) {
      try {
        const local = localStorage.getItem(storageKey);
        if (local) {
          savedPrefs = JSON.parse(local);
        }
      } catch (e) {
        console.warn('Could not read user preferences from localStorage:', e);
      }
    }

    // 3. Fallback to global legacy settings if default or first-time user
    if (!savedPrefs) {
      savedPrefs = await this.readLegacyGlobalSettings();
    }

    const merged: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(savedPrefs || {}),
      email,
      lastUpdated: savedPrefs?.lastUpdated || 0
    };

    this.currentPreferences = merged;
    this.notifyListeners();

    // 4. Trigger cloud sync if authenticated
    if (authService.getAccessToken()) {
      this.syncWithCloud(email).catch(() => {});
    }

    return merged;
  }

  /**
   * Synchronizes preferences with Google Drive AppData (audiocar_user_preferences.json)
   */
  public async syncWithCloud(targetEmail?: string): Promise<UserPreferences> {
    const token = authService.getAccessToken();
    const email = (targetEmail || this.getActiveEmail()).toLowerCase().trim();

    if (!token || email === 'default') {
      this.setCloudSyncStatus('offline');
      return this.currentPreferences;
    }

    if (this.isSyncingWithCloud) {
      return this.currentPreferences;
    }

    this.isSyncingWithCloud = true;
    this.setCloudSyncStatus('syncing');

    try {
      const cloudPrefs = await driveService.loadPreferencesFromDriveAppData();

      if (cloudPrefs) {
        const cloudTimestamp = cloudPrefs.lastUpdated || 0;
        const localTimestamp = this.currentPreferences.lastUpdated || 0;

        // If cloud preferences are newer or local is uninitialized
        if (cloudTimestamp >= localTimestamp) {
          const merged: UserPreferences = {
            ...DEFAULT_PREFERENCES,
            ...this.currentPreferences,
            ...cloudPrefs,
            email,
            lastUpdated: cloudTimestamp
          };

          this.currentPreferences = merged;

          // Save to local caches
          const storageKey = this.getStorageKey(email);
          try {
            await dbService.setSetting(storageKey, merged);
            localStorage.setItem(storageKey, JSON.stringify(merged));
            if (merged.ledColor) localStorage.setItem('audiocar_led_color', merged.ledColor);
            if (merged.isLedPulseActive !== undefined) localStorage.setItem('audiocar_led_pulse', String(merged.isLedPulseActive));
            if (merged.theme) localStorage.setItem('audiocar_theme', merged.theme);
          } catch (storageErr) {
            console.warn('[PreferencesService] Error updating local cache with cloud prefs:', storageErr);
          }

          this.setCloudSyncStatus('synced');
          this.notifyListeners();
        } else {
          // Local is newer, upload to cloud
          const savedOk = await driveService.savePreferencesToDriveAppData(this.currentPreferences);
          this.setCloudSyncStatus(savedOk ? 'synced' : 'error');
        }
      } else {
        // No cloud file yet on Google Drive: create it from current local preferences
        const savedOk = await driveService.savePreferencesToDriveAppData(this.currentPreferences);
        this.setCloudSyncStatus(savedOk ? 'synced' : 'error');
      }
    } catch (e) {
      console.warn('[PreferencesService] Cloud sync failed:', e);
      this.setCloudSyncStatus('error');
    } finally {
      this.isSyncingWithCloud = false;
    }

    return this.currentPreferences;
  }

  private async readLegacyGlobalSettings(): Promise<Partial<UserPreferences>> {
    try {
      const [
        volume,
        mode,
        scope,
        speed,
        eq,
        crossfade,
        crossfadeDur,
        fadeInOut,
        fadeDur,
        normEnabled,
        normPreset,
        bufferCount,
        hideDemo
      ] = await Promise.all([
        dbService.getSetting<number>('player_volume', 0.85),
        dbService.getSetting<PlaybackMode>('player_mode', 'linear'),
        dbService.getSetting<PlaybackScope>('player_scope', 'all_folders'),
        dbService.getSetting<number>('player_speed', 1.0),
        dbService.getSetting<string>('player_eq', 'Balanced'),
        dbService.getSetting<boolean>('player_crossfade', false),
        dbService.getSetting<number>('player_crossfade_dur', 4),
        dbService.getSetting<boolean>('player_fade_in_out', true),
        dbService.getSetting<number>('player_fade_dur', 3),
        dbService.getSetting<boolean>('player_norm_enabled', true),
        dbService.getSetting<'balanced' | 'dynamic' | 'night'>('player_norm_preset', 'balanced'),
        dbService.getSetting<number>('player_buffer_ahead', 3),
        dbService.isDemoTracksHidden()
      ]);

      const theme = (localStorage.getItem('audiocar_theme') as 'dark' | 'light') || 'dark';
      const ledColor = localStorage.getItem('audiocar_led_color') || 'sport-red';
      const isLedPulseActive = localStorage.getItem('audiocar_led_pulse') !== 'false';

      return {
        volume,
        playbackMode: mode,
        playbackScope: scope,
        playbackRate: speed,
        eqPreset: eq,
        isCrossfadeEnabled: crossfade,
        crossfadeDuration: crossfadeDur,
        isFadeInOutEnabled: fadeInOut,
        fadeInOutDuration: fadeDur,
        isNormalizationEnabled: normEnabled,
        normalizationPreset: normPreset,
        bufferAheadCount: bufferCount,
        theme,
        hideDemoTracks: hideDemo,
        ledColor,
        isLedPulseActive
      };
    } catch {
      return {};
    }
  }

  /**
   * Saves updated preferences for a given user (or active user), persisting to
   * IndexedDB, localStorage, and debouncing sync to Google Drive AppData.
   */
  public async savePreferences(
    partial: Partial<UserPreferences>,
    targetEmail?: string
  ): Promise<UserPreferences> {
    const email = (targetEmail || this.getActiveEmail()).toLowerCase().trim();
    const storageKey = this.getStorageKey(email);

    const updated: UserPreferences = {
      ...this.currentPreferences,
      ...partial,
      email,
      lastUpdated: Date.now()
    };

    this.currentPreferences = updated;

    // 1. Save to IndexedDB
    try {
      await dbService.setSetting(storageKey, updated);
    } catch (e) {
      console.warn('Could not save user preferences to IndexedDB:', e);
    }

    // 2. Save to localStorage for instant bootstrap
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      if (updated.ledColor) localStorage.setItem('audiocar_led_color', updated.ledColor);
      if (updated.isLedPulseActive !== undefined) localStorage.setItem('audiocar_led_pulse', String(updated.isLedPulseActive));
      if (updated.theme) localStorage.setItem('audiocar_theme', updated.theme);
    } catch (e) {
      console.warn('Could not save user preferences to localStorage:', e);
    }

    this.notifyListeners();

    // 3. Debounced cloud synchronization
    const token = authService.getAccessToken();
    if (token && email !== 'default') {
      this.setCloudSyncStatus('syncing');
      if (this.cloudDebounceTimer) {
        clearTimeout(this.cloudDebounceTimer);
      }

      this.cloudDebounceTimer = setTimeout(async () => {
        try {
          const ok = await driveService.savePreferencesToDriveAppData(this.currentPreferences);
          this.setCloudSyncStatus(ok ? 'synced' : 'error');
        } catch {
          this.setCloudSyncStatus('error');
        }
      }, 1200);
    }

    return updated;
  }

  /**
   * Immediately flushes any pending cloud synchronization without debounce.
   * Useful when closing settings modal or exiting.
   */
  public async flushCloudSync(): Promise<boolean> {
    if (this.cloudDebounceTimer) {
      clearTimeout(this.cloudDebounceTimer);
      this.cloudDebounceTimer = null;
    }

    const token = authService.getAccessToken();
    const email = this.getActiveEmail();
    if (!token || email === 'default') {
      return true;
    }

    this.setCloudSyncStatus('syncing');
    try {
      const ok = await driveService.savePreferencesToDriveAppData(this.currentPreferences);
      this.setCloudSyncStatus(ok ? 'synced' : 'error');
      return ok;
    } catch {
      this.setCloudSyncStatus('error');
      return false;
    }
  }

  /**
   * Updates a single preference key for the currently active user.
   */
  public async updateCurrentPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    if (this.isApplying) return;
    await this.savePreferences({ [key]: value });
  }

  /**
   * Resets preferences for the active user back to recommended car audio defaults.
   */
  public async resetToDefaults(targetEmail?: string): Promise<UserPreferences> {
    const email = (targetEmail || this.getActiveEmail()).toLowerCase().trim();
    return await this.savePreferences(
      {
        ...DEFAULT_PREFERENCES,
        email,
        lastUpdated: Date.now()
      },
      email
    );
  }

  public getCurrentPreferences(): UserPreferences {
    return { ...this.currentPreferences };
  }

  public subscribe(listener: PreferencesListener): () => void {
    this.listeners.add(listener);
    listener(this.getCurrentPreferences());
    return () => this.listeners.delete(listener);
  }

  public subscribeSyncStatus(listener: SyncStatusListener): () => void {
    this.syncStatusListeners.add(listener);
    listener(this.cloudSyncStatus);
    return () => this.syncStatusListeners.delete(listener);
  }

  private notifyListeners() {
    const prefs = this.getCurrentPreferences();
    this.listeners.forEach((l) => l(prefs));
  }

  public setApplying(applying: boolean) {
    this.isApplying = applying;
  }
}

export const preferencesService = new PreferencesService();
