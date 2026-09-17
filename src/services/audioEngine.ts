/**
 * Automotive Audio Engine & Media Session API Controller - Sophisticated Dark
 * Features:
 * - HTML5 Audio playback with retry logic for automotive network drops
 * - Real Web Audio API Dual-Engine Crossfade (Fundido Cruzado 1s-12s)
 * - Desvanecimiento (Smooth Fade In & Fade Out on Play / Pause / Seek / Track Switch)
 * - 4 Playback Modes: Lineal, Suflé (Shuffle), Continuo (Loop All), Repetir 1 (Loop Track)
 * - Web Audio API 3-Band Equalizer (DSP) & Realtime Analyser for Visualizer
 * - Next-track buffer preloader for zero-latency gapless transitions
 * - navigator.mediaSession handlers (Steering wheel controls & Car HUD metadata with Album Art)
 */

import { AudioTrack, PlayerState, RepeatMode, PlaybackMode, PlaybackScope, ImageFormat, UserPreferences } from '../types';
import { dbService } from './dbService';
import { driveService } from './driveService';
import { cloudService } from './cloudService';
import { authService } from './authService';
import { preferencesService } from './preferencesService';
import { PlaybackSeekController, AudioSeekEngine } from './playbackSeekController';

type StateListener = (state: PlayerState) => void;
type AuthRequiredListener = (provider: 'drive', track?: AudioTrack) => void;

class AudioEngine implements AudioSeekEngine {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private activePlayerIndex: 0 | 1 = 0; // 0 for audioA, 1 for audioB

  public seekController: PlaybackSeekController;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Nodes for Audio A
  private sourceA: MediaElementAudioSourceNode | null = null;
  private gainNodeA: GainNode | null = null;

  // Nodes for Audio B
  private sourceB: MediaElementAudioSourceNode | null = null;
  private gainNodeB: GainNode | null = null;

  // Master Gain & EQ Filters
  private masterGain: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;

  // Automotive Volume Normalization (Auto-Leveling / Dynamics Compressor DSP)
  private compressor: DynamicsCompressorNode | null = null;
  private normalizationGain: GainNode | null = null;

  private allAvailableTracks: AudioTrack[] = [];

  private state: PlayerState = {
    isPlaying: false,
    currentTrackIndex: -1,
    queue: [],
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    isMuted: false,
    isShuffle: false,
    repeatMode: 'off',
    playbackMode: 'linear',
    playbackScope: 'all_folders',
    isCrossfadeEnabled: false,
    crossfadeDuration: 4,
    isFadeInOutEnabled: true,
    fadeInOutDuration: 3,
    playbackRate: 1.0,
    isLoading: false,
    bufferedEnd: 0,
    error: null,
    eqPreset: 'Balanced',
    isNormalizationEnabled: true,
    normalizationPreset: 'balanced',
    bufferAheadCount: 3,
    preloadedTrackIds: [],
    isPreloading: false
  };

  private listeners: Set<StateListener> = new Set();
  private authRequiredListeners: Set<AuthRequiredListener> = new Set();
  private originalQueueOrder: AudioTrack[] = [];
  private retryCount = 0;
  private readonly MAX_RETRIES = 4;
  private isTransitioning = false;
  private preprimedTrackId: string | null = null;
  private isPrepriming = false;
  private crossfadeTimer: any = null;
  private silentCarrierStarted = false;
  private mediaSessionSyncInterval: any = null;
  private lazyPrefetchTimer: any = null;
  private hasTriggeredLazyPrefetch = false;
  private fadeOutTimer: any = null;
  private lastSessionPersistTime = 0;

  public get isCrossfading(): boolean {
    return this.isTransitioning;
  }

  constructor() {
    this.seekController = new PlaybackSeekController(this);

    this.audioA = new Audio();
    this.audioA.preload = 'auto';
    this.audioA.crossOrigin = 'anonymous';

    this.audioB = new Audio();
    this.audioB.preload = 'auto';
    this.audioB.crossOrigin = 'anonymous';

    this.attachAudioListeners(this.audioA, 0);
    this.attachAudioListeners(this.audioB, 1);
    this.setupMediaSession();
    this.restoreSavedSettings();
    setTimeout(() => {
      this.restorePersistedSession();
    }, 300);
  }

  public getActiveAudioElement(): HTMLAudioElement | null {
    return this.activeAudio;
  }

  public async restorePersistedSession() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('audiocar_session_state');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.queue || saved.queue.length === 0) return;

      this.state.queue = saved.queue;
      this.originalQueueOrder = [...saved.queue];
      this.state.currentTrackIndex = Math.max(0, Math.min(saved.currentTrackIndex || 0, saved.queue.length - 1));
      this.state.playbackMode = saved.playbackMode || this.state.playbackMode;
      this.state.playbackScope = saved.playbackScope || this.state.playbackScope;
      this.state.volume = saved.volume !== undefined ? saved.volume : this.state.volume;
      this.state.isShuffle = this.state.playbackMode === 'shuffle';
      this.state.repeatMode = this.state.playbackMode === 'continuous' ? 'all' : this.state.playbackMode === 'repeat_one' ? 'one' : 'off';
      this.state.eqPreset = saved.eqPreset || this.state.eqPreset;

      this.audioA.volume = this.state.volume;
      this.audioB.volume = this.state.volume;

      const currentTrack = this.getCurrentTrack();
      if (currentTrack) {
        this.updateMediaSessionMetadata(currentTrack);
      }

      this.notifyListeners();
    } catch (err) {
      console.warn('Could not restore persisted session:', err);
    }
  }

  private get activeAudio(): HTMLAudioElement {
    return this.activePlayerIndex === 0 ? this.audioA : this.audioB;
  }

  private get inactiveAudio(): HTMLAudioElement {
    return this.activePlayerIndex === 0 ? this.audioB : this.audioA;
  }

  private get activeGainNode(): GainNode | null {
    return this.activePlayerIndex === 0 ? this.gainNodeA : this.gainNodeB;
  }

  private get inactiveGainNode(): GainNode | null {
    return this.activePlayerIndex === 0 ? this.gainNodeB : this.gainNodeA;
  }

  public async restoreSavedSettings(userEmail?: string) {
    try {
      preferencesService.setApplying(true);
      const prefs = await preferencesService.loadPreferencesForUser(userEmail);
      this.applyPreferencesProfile(prefs);
    } catch (e) {
      console.warn('Could not restore user audio settings:', e);
    } finally {
      preferencesService.setApplying(false);
    }
  }

  /**
   * Directly applies a complete user preferences profile to the engine
   */
  public applyPreferencesProfile(prefs: Partial<UserPreferences>) {
    const vol = typeof prefs.volume === 'number' ? prefs.volume : 0.85;
    const mode = prefs.playbackMode || 'linear';
    const scope = prefs.playbackScope || 'all_folders';
    const speed = typeof prefs.playbackRate === 'number' ? prefs.playbackRate : 1.0;
    const eq = prefs.eqPreset || 'Balanced';
    const crossfade = typeof prefs.isCrossfadeEnabled === 'boolean' ? prefs.isCrossfadeEnabled : false;
    const crossfadeDur = typeof prefs.crossfadeDuration === 'number' ? prefs.crossfadeDuration : 4;
    const fadeInOut = typeof prefs.isFadeInOutEnabled === 'boolean' ? prefs.isFadeInOutEnabled : true;
    const fadeDur = typeof prefs.fadeInOutDuration === 'number' ? prefs.fadeInOutDuration : 3;
    const normEnabled = typeof prefs.isNormalizationEnabled === 'boolean' ? prefs.isNormalizationEnabled : true;
    const normPreset = prefs.normalizationPreset || 'balanced';
    const bufferCount = typeof prefs.bufferAheadCount === 'number' ? prefs.bufferAheadCount : 3;

    this.state.volume = vol;
    this.state.playbackMode = mode;
    this.state.playbackScope = scope;
    this.state.isShuffle = mode === 'shuffle';
    this.state.repeatMode = mode === 'continuous' ? 'all' : mode === 'repeat_one' ? 'one' : 'off';
    this.state.playbackRate = speed;
    this.state.eqPreset = eq;
    this.state.isCrossfadeEnabled = crossfade;
    this.state.crossfadeDuration = crossfadeDur;
    this.state.isFadeInOutEnabled = fadeInOut;
    this.state.fadeInOutDuration = fadeDur;
    this.state.isNormalizationEnabled = normEnabled;
    this.state.normalizationPreset = normPreset;
    this.state.bufferAheadCount = bufferCount;

    this.audioA.volume = vol;
    this.audioB.volume = vol;
    this.audioA.playbackRate = speed;
    this.audioB.playbackRate = speed;

    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(this.state.isMuted ? 0 : vol, this.audioContext.currentTime);
    }

    this.applyEQPreset(eq);
    this.applyNormalizationSettings();
    this.notifyListeners();
  }

  private initWebAudio() {
    if (this.audioContext) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(this.state.isMuted ? 0 : this.state.volume, this.audioContext.currentTime);

      this.gainNodeA = this.audioContext.createGain();
      this.gainNodeA.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      this.gainNodeB = this.audioContext.createGain();
      this.gainNodeB.gain.setValueAtTime(0.0, this.audioContext.currentTime);

      // Filters
      this.bassFilter = this.audioContext.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 250;

      this.midFilter = this.audioContext.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1.0;

      this.trebleFilter = this.audioContext.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 4000;

      // Dynamics Compressor (Master Limiter & Protection to eliminate clicks/clipping)
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.audioContext.currentTime);
      this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

      this.normalizationGain = this.audioContext.createGain();
      this.normalizationGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // Sources
      this.sourceA = this.audioContext.createMediaElementSource(this.audioA);
      this.sourceB = this.audioContext.createMediaElementSource(this.audioB);

      // Connections:
      // sourceA -> gainNodeA \
      //                       -> masterGain -> bass -> mid -> treble -> compressor -> normalizationGain -> analyser -> destination
      // sourceB -> gainNodeB /
      this.sourceA.connect(this.gainNodeA);
      this.sourceB.connect(this.gainNodeB);

      this.gainNodeA.connect(this.masterGain);
      this.gainNodeB.connect(this.masterGain);

      this.masterGain.connect(this.bassFilter);
      this.bassFilter.connect(this.midFilter);
      this.midFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.compressor);
      this.compressor.connect(this.normalizationGain);
      this.normalizationGain.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.applyEQPreset(this.state.eqPreset);
      this.applyNormalizationSettings();

      // Media Session & Audio Focus In-Car Keep-Alive Carrier:
      // Feeds a subliminal continuous stream to the hardware destination
      // Prevents browser audio thread from releasing audio focus to the FM car radio during track changes or network buffer blips
      if (!this.silentCarrierStarted) {
        try {
          const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate, this.audioContext.sampleRate);
          const carrier = this.audioContext.createBufferSource();
          carrier.buffer = buffer;
          carrier.loop = true;
          const carrierGain = this.audioContext.createGain();
          carrierGain.gain.setValueAtTime(0.00001, this.audioContext.currentTime);
          carrier.connect(carrierGain);
          carrierGain.connect(this.audioContext.destination);
          carrier.start();
          this.silentCarrierStarted = true;
        } catch (carrierErr) {
          console.warn('Silent keepalive node skipped:', carrierErr);
        }
      }
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  private syncTrackDuration(rawDuration: number, playerIndex: 0 | 1) {
    if (this.activePlayerIndex !== playerIndex) return;

    let validDuration = 0;
    if (typeof rawDuration === 'number' && !isNaN(rawDuration) && isFinite(rawDuration) && rawDuration > 0) {
      validDuration = rawDuration;
    } else {
      const activeEl = playerIndex === 0 ? this.audioA : this.audioB;
      if (activeEl.seekable && activeEl.seekable.length > 0) {
        const seekEnd = activeEl.seekable.end(activeEl.seekable.length - 1);
        if (isFinite(seekEnd) && seekEnd > 0) {
          validDuration = seekEnd;
        }
      }
    }

    if (validDuration > 0) {
      const roundedDur = Math.round(validDuration * 10) / 10;
      if (this.state.duration !== roundedDur) {
        this.state.duration = roundedDur;
        const curTrack = this.getCurrentTrack();
        if (curTrack && (!curTrack.duration || Math.abs(curTrack.duration - roundedDur) > 1)) {
          curTrack.duration = Math.round(roundedDur);
          dbService.updateTrack(curTrack).catch(() => {});
        }
        this.updateMediaSessionPosition();
        this.notifyListeners();
      }
    } else if (this.state.duration <= 0) {
      const curTrack = this.getCurrentTrack();
      if (curTrack && curTrack.duration && curTrack.duration > 0) {
        this.state.duration = curTrack.duration;
        this.notifyListeners();
      }
    }
  }

  private attachAudioListeners(audioEl: HTMLAudioElement, playerIndex: 0 | 1) {
    audioEl.addEventListener('loadedmetadata', () => {
      this.syncTrackDuration(audioEl.duration, playerIndex);
    });

    audioEl.addEventListener('loadeddata', () => {
      this.syncTrackDuration(audioEl.duration, playerIndex);
    });

    audioEl.addEventListener('canplay', () => {
      this.syncTrackDuration(audioEl.duration, playerIndex);
      if (this.activePlayerIndex === playerIndex) {
        this.state.isLoading = false;
        this.notifyListeners();
      }
    });

    audioEl.addEventListener('canplaythrough', () => {
      this.syncTrackDuration(audioEl.duration, playerIndex);
    });

    audioEl.addEventListener('play', () => {
      if (this.activePlayerIndex === playerIndex) {
        this.syncTrackDuration(audioEl.duration, playerIndex);
        this.state.isPlaying = true;
        this.state.isLoading = false;
        this.state.error = null;
        this.notifyListeners();
        this.startMediaSessionPositionSync();
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          try {
            (navigator as any).wakeLock.request('screen').catch(() => {});
          } catch {}
        }
        this.persistCurrentSessionState();
      }
    });

    audioEl.addEventListener('pause', () => {
      if (this.activePlayerIndex === playerIndex && !this.isTransitioning) {
        this.state.isPlaying = false;
        this.stopMediaSessionPositionSync();
        this.notifyListeners();
        this.updateMediaSessionPosition();
        this.persistCurrentSessionState();
      }
    });

    audioEl.addEventListener('timeupdate', () => {
      if (this.activePlayerIndex === playerIndex) {
        this.state.currentTime = audioEl.currentTime;

        // Keep duration synchronized in case duration was computed progressively by browser
        if (this.state.duration <= 0 || (isFinite(audioEl.duration) && audioEl.duration > 0 && Math.abs(this.state.duration - audioEl.duration) > 1)) {
          this.syncTrackDuration(audioEl.duration, playerIndex);
        }

        if (audioEl.buffered.length > 0) {
          this.state.bufferedEnd = audioEl.buffered.end(audioEl.buffered.length - 1);
        }

        const remaining = (audioEl.duration && isFinite(audioEl.duration)) ? audioEl.duration - audioEl.currentTime : 0;

        // 1. Hardware Gapless Pre-Priming (when remaining <= 8 seconds)
        // Warms up the idle audio channel with the next track's Blob URL and runs .load() with preload="auto"
        if (
          remaining > 0 &&
          remaining <= 8 &&
          !this.isPrepriming &&
          !this.isTransitioning &&
          this.state.isPlaying
        ) {
          const nextIdx = this.getNextTrackIndex();
          if (nextIdx !== null && nextIdx !== this.state.currentTrackIndex) {
            const nextTrack = this.state.queue[nextIdx];
            if (nextTrack && this.preprimedTrackId !== nextTrack.id) {
              this.preprimeNextTrack(nextTrack).catch(() => {});
            }
          }
        }

        // 2. Seamless Gapless / Crossfade Transition without Audio Focus drop
        // Runs at remaining <= transitionDuration (or default 1.5s)
        const transitionDuration = this.state.isCrossfadeEnabled
          ? Math.max(1.0, this.state.crossfadeDuration)
          : 1.5;

        if (
          remaining > 0 &&
          remaining <= transitionDuration &&
          !this.isTransitioning &&
          this.state.isPlaying &&
          audioEl.duration > transitionDuration * 1.5
        ) {
          this.performTransitionToNext(transitionDuration);
        }

        // Lazy Buffering Guard: Start prefetching only after user has listened for >= 10s or 25% of track
        if (
          !this.hasTriggeredLazyPrefetch &&
          (audioEl.currentTime >= 10 || (this.state.duration > 0 && audioEl.currentTime >= this.state.duration * 0.25))
        ) {
          this.hasTriggeredLazyPrefetch = true;
          this.prefetchUpcomingTracks().catch(() => {});
        }

        this.notifyListeners();
        
        // Save session state smoothly at throttled intervals
        this.persistCurrentSessionState();
      }
    });

    audioEl.addEventListener('durationchange', () => {
      this.syncTrackDuration(audioEl.duration, playerIndex);
    });

    audioEl.addEventListener('waiting', () => {
      if (this.activePlayerIndex === playerIndex) {
        this.state.isLoading = true;
        this.notifyListeners();
      }
    });

    audioEl.addEventListener('playing', () => {
      if (this.activePlayerIndex === playerIndex) {
        this.state.isLoading = false;
        this.retryCount = 0;
        this.notifyListeners();
      }
    });

    audioEl.addEventListener('ended', () => {
      if (this.activePlayerIndex === playerIndex && !this.isTransitioning) {
        if (this.state.playbackMode === 'repeat_one') {
          audioEl.currentTime = 0;
          audioEl.play().catch(() => {});
        } else {
          this.performTransitionToNext(1.5);
        }
      }
    });

    audioEl.addEventListener('error', (e) => {
      if (this.activePlayerIndex === playerIndex) {
        console.error('Audio playback error:', audioEl.error, e);
        const curTrack = this.getCurrentTrack();
        if (this.isTrackRequiringAuth(curTrack)) {
          this.state.isLoading = false;
          this.state.isPlaying = false;
          this.state.error = 'drive_auth_required';
          this.notifyListeners();
          this.notifyAuthRequired('drive', curTrack || undefined);
          return;
        }
        if (this.retryCount < this.MAX_RETRIES && curTrack) {
          this.retryCount++;
          setTimeout(() => this.playCurrentTrack(), 1000);
        } else {
          this.state.isLoading = false;
          this.state.isPlaying = false;
          this.state.error = 'Error al reproducir pista. Comprueba la conexión o sesión de Drive.';
          this.notifyListeners();
        }
      }
    });
  }

  private setupMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => this.play());
    ms.setActionHandler('pause', () => this.pause());
    ms.setActionHandler('previoustrack', () => this.previous());
    ms.setActionHandler('nexttrack', () => this.next());

    try {
      ms.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.seek(details.seekTime);
        }
      });
      ms.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        this.seek(Math.min(this.activeAudio.currentTime + skipTime, this.activeAudio.duration || 0));
      });
      ms.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        this.seek(Math.max(this.activeAudio.currentTime - skipTime, 0));
      });
      ms.setActionHandler('stop', () => this.pause());
    } catch (e) {
      console.warn('MediaSession handler warning:', e);
    }
  }

  private updateMediaSessionMetadata(track: AudioTrack) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const baseArt = track.thumbnailUrl || (origin ? `${origin}/audiocar-logo.svg` : '/audiocar-logo.svg');
      const isSvg = baseArt.includes('.svg');
      const artType = isSvg ? 'image/svg+xml' : 'image/jpeg';
      const artwork = [
        { src: baseArt, sizes: '96x96', type: artType },
        { src: baseArt, sizes: '128x128', type: artType },
        { src: baseArt, sizes: '192x192', type: artType },
        { src: baseArt, sizes: '256x256', type: artType },
        { src: baseArt, sizes: '384x384', type: artType },
        { src: baseArt, sizes: '512x512', type: artType }
      ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || track.name,
        artist: track.artist || 'AudioCar',
        album: track.album || 'Google Drive Cloud',
        artwork
      });
    } catch (e) {
      console.warn('Failed to update MediaSession metadata:', e);
    }

    this.updateMediaSessionPosition();
  }

  private startMediaSessionPositionSync() {
    this.stopMediaSessionPositionSync();
    this.updateMediaSessionPosition();
    // 1000ms interval Keep-Alive to prevent car browser daemon flooding
    this.mediaSessionSyncInterval = setInterval(() => {
      if (this.state.isPlaying && !this.activeAudio.paused) {
        this.updateMediaSessionPosition();
      }
    }, 1000);
  }

  private stopMediaSessionPositionSync() {
    if (this.mediaSessionSyncInterval) {
      clearInterval(this.mediaSessionSyncInterval);
      this.mediaSessionSyncInterval = null;
    }
  }

  public updateMediaSessionPosition() {
    if (
      typeof window !== 'undefined' &&
      'mediaSession' in navigator &&
      'setPositionState' in navigator.mediaSession &&
      !isNaN(this.activeAudio.duration) &&
      this.activeAudio.duration > 0
    ) {
      try {
        const safeDuration = Math.max(0.1, this.activeAudio.duration);
        const safePos = Math.min(Math.max(0, this.activeAudio.currentTime), Math.max(0, safeDuration - 0.05));
        navigator.mediaSession.setPositionState({
          duration: safeDuration,
          playbackRate: this.activeAudio.playbackRate || 1.0,
          position: safePos
        });
      } catch (e) {
        // Suppress rapid seek sync warnings
      }
    }
  }

  public setAllAvailableTracks(tracks: AudioTrack[]) {
    if (tracks && tracks.length > 0) {
      this.allAvailableTracks = [...tracks];
    }
  }

  public getAllAvailableTracks(): AudioTrack[] {
    return this.allAvailableTracks;
  }

  public async setPlaybackScope(scope: PlaybackScope, allTracks?: AudioTrack[]) {
    this.state.playbackScope = scope;
    await dbService.setSetting('player_scope', scope);
    preferencesService.updateCurrentPreference('playbackScope', scope);

    const libraryTracks = (allTracks && allTracks.length > 0)
      ? allTracks
      : (this.allAvailableTracks.length > 0 ? this.allAvailableTracks : this.originalQueueOrder);

    if (libraryTracks.length === 0) {
      this.notifyListeners();
      return;
    }

    this.allAvailableTracks = [...libraryTracks];
    const currentTrack = this.getCurrentTrack();

    if (scope === 'selected_folder') {
      if (currentTrack) {
        // Filter by current track's folder or album
        const folderTracks = libraryTracks.filter((t) => {
          if (currentTrack.folderId) {
            return t.folderId === currentTrack.folderId;
          }
          if (currentTrack.folderPath) {
            return t.folderPath === currentTrack.folderPath;
          }
          if (currentTrack.album && currentTrack.album !== 'Google Drive Cloud' && currentTrack.album !== 'mimusica') {
            return t.album === currentTrack.album;
          }
          return !t.folderId || t.folderId === 'root';
        });

        const targetList = folderTracks.length > 0 ? folderTracks : [currentTrack];
        const newIndex = targetList.findIndex((t) => t.id === currentTrack.id);
        this.originalQueueOrder = [...targetList];
        this.state.queue = this.state.isShuffle ? this.shuffleArray([...targetList]) : [...targetList];
        this.state.currentTrackIndex = newIndex !== -1 ? (this.state.isShuffle ? this.state.queue.findIndex((t) => t.id === currentTrack.id) : newIndex) : 0;
      }
    } else {
      // all_folders
      if (currentTrack) {
        const newIndex = libraryTracks.findIndex((t) => t.id === currentTrack.id);
        this.originalQueueOrder = [...libraryTracks];
        this.state.queue = this.state.isShuffle ? this.shuffleArray([...libraryTracks]) : [...libraryTracks];
        this.state.currentTrackIndex = newIndex !== -1 ? (this.state.isShuffle ? this.state.queue.findIndex((t) => t.id === currentTrack.id) : newIndex) : 0;
      } else {
        this.originalQueueOrder = [...libraryTracks];
        this.state.queue = this.state.isShuffle ? this.shuffleArray([...libraryTracks]) : [...libraryTracks];
        this.state.currentTrackIndex = 0;
      }
    }

    this.notifyListeners();
  }

  public getVisualizerData(): Uint8Array | null {
    if (!this.analyser) return null;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public async setQueue(tracks: AudioTrack[], startIndex: number = 0, autoPlay: boolean = true) {
    if (tracks.length === 0) return;

    this.originalQueueOrder = [...tracks];
    this.state.queue = this.state.isShuffle ? this.shuffleArray([...tracks]) : [...tracks];
    this.state.currentTrackIndex = Math.max(0, Math.min(startIndex, this.state.queue.length - 1));
    this.retryCount = 0;
    this.notifyListeners();

    if (autoPlay) {
      await this.playCurrentTrack();
    }
  }

  public getCurrentTrack(): AudioTrack | null {
    if (this.state.currentTrackIndex >= 0 && this.state.currentTrackIndex < this.state.queue.length) {
      return this.state.queue[this.state.currentTrackIndex];
    }
    return null;
  }

  public async playTrackById(trackId: string, trackList?: AudioTrack[]) {
    const list = trackList || this.state.queue;
    const index = list.findIndex((t) => t.id === trackId);
    if (index !== -1) {
      if (trackList) {
        await this.setQueue(trackList, index, true);
      } else {
        await this.transitionToTrackIndex(index);
      }
    }
  }

  private async getTrackStreamUrl(track: AudioTrack): Promise<string> {
    const url = await cloudService.getStreamUrl(track);
    if (url) return url;
    if (track.source === 'drive' && track.driveFileId) {
      return await driveService.getStreamBlobUrl(track.driveFileId, track.mimeType);
    }
    return track.streamUrl || '';
  }

  /**
   * Micro-fade out active audio element smoothly over 25ms to prevent audible click/chasquido on speakers
   */
  private async fadeOutAudio(durationMs: number = 25): Promise<void> {
    if (!this.activeAudio || this.activeAudio.paused || this.activeAudio.ended) return;
    try {
      if (this.audioContext && this.activeGainNode && this.audioContext.state !== 'suspended') {
        const now = this.audioContext.currentTime;
        const currentGain = this.activeGainNode.gain.value;
        this.activeGainNode.gain.cancelScheduledValues(now);
        this.activeGainNode.gain.setValueAtTime(currentGain, now);
        this.activeGainNode.gain.linearRampToValueAtTime(0.0001, now + (durationMs / 1000));
        await new Promise((resolve) => setTimeout(resolve, durationMs));
      }
    } catch {}
    try {
      this.activeAudio.pause();
    } catch {}
  }

  private async playCurrentTrack() {
    const track = this.getCurrentTrack();
    if (!track) return;

    if (this.isTrackRequiringAuth(track)) {
      // Attempt proactive silent refresh before declaring unauthenticated
      const refreshed = await authService.refreshAccessTokenSilently();
      if (!refreshed && this.isTrackRequiringAuth(track)) {
        this.state.isLoading = false;
        this.state.isPlaying = false;
        this.state.error = 'drive_auth_required';
        this.notifyListeners();
        this.notifyAuthRequired('drive', track);
        return;
      }
    }

    this.initWebAudio();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    this.state.isLoading = true;
    this.state.error = null;
    this.state.currentTime = 0;
    this.state.duration = track.duration || 0;
    this.notifyListeners();
    this.updateMediaSessionMetadata(track);

    try {
      // Smoothly silence outgoing audio before changing source to eliminate DAC click / chasquido
      if (!this.activeAudio.paused) {
        await this.fadeOutAudio(25);
      }

      const streamUrl = await this.getTrackStreamUrl(track);
      if (!streamUrl) throw new Error('No audio URL found for this track');

      const currentAudio = this.activeAudio;
      currentAudio.src = streamUrl;
      currentAudio.playbackRate = this.state.playbackRate;

      // Desvanecimiento (Fade In)
      if (this.state.isFadeInOutEnabled && this.activeGainNode && this.audioContext) {
        const now = this.audioContext.currentTime;
        this.activeGainNode.gain.cancelScheduledValues(now);
        this.activeGainNode.gain.setValueAtTime(0.0001, now);
        this.activeGainNode.gain.linearRampToValueAtTime(1.0, now + this.state.fadeInOutDuration);
      } else if (this.activeGainNode && this.audioContext) {
        const now = this.audioContext.currentTime;
        this.activeGainNode.gain.cancelScheduledValues(now);
        this.activeGainNode.gain.setValueAtTime(0.0001, now);
        this.activeGainNode.gain.linearRampToValueAtTime(1.0, now + 0.03); // 30ms anti-pop micro-ramp
      }

      await currentAudio.play();
      await dbService.logTrackPlayed(track.id);
      
      // Strict RAM Management: Evict all dormant Blob URLs except current and immediate next track
      const nextTrackIdx = this.getNextTrackIndex();
      const nextTrack = nextTrackIdx !== null ? this.state.queue[nextTrackIdx] : null;
      const currentFileId = track.cloudFileId || track.driveFileId || '';
      const nextFileId = nextTrack?.cloudFileId || nextTrack?.driveFileId || '';
      driveService.evictOldBlobsExcept([currentFileId, nextFileId]);

      // Lazy Buffering: Delay background cellular prefetching until user listens for 10s or 25% of track
      this.scheduleLazyPrefetch();
    } catch (err: any) {
      console.error('playCurrentTrack error:', err);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      const isAuthErr = err?.message?.includes('Google Drive') || 
                        err?.message?.includes('sign in') || 
                        err?.message?.includes('session') || 
                        err?.message?.includes('401') ||
                        err?.status === 401;
      if (isAuthErr || this.isTrackRequiringAuth(track)) {
        // Attempt silent recovery
        const recovered = await authService.refreshAccessTokenSilently();
        if (recovered) {
          try {
            const retryStreamUrl = await this.getTrackStreamUrl(track);
            if (retryStreamUrl) {
              this.activeAudio.src = retryStreamUrl;
              await this.activeAudio.play();
              this.state.isPlaying = true;
              this.notifyListeners();
              return;
            }
          } catch {}
        }
        this.state.error = 'drive_auth_required';
        this.notifyAuthRequired('drive', track);
      } else {
        this.state.error = err.message || 'Error al reproducir audio';
      }
      this.notifyListeners();
    }
  }

  /**
   * Hardware Gapless Pre-Priming: Warms up inactive channel with next track's Blob URL
   * Runs .load() with preload="auto" to warm up the physical codec in hardware.
   */
  public async preprimeNextTrack(nextTrack: AudioTrack) {
    if (!nextTrack || this.isPrepriming || this.isTransitioning) return;
    this.isPrepriming = true;

    try {
      this.initWebAudio();
      const inactiveAudio = this.inactiveAudio;
      const inactiveGain = this.inactiveGainNode;

      if (this.audioContext && inactiveGain) {
        const now = this.audioContext.currentTime;
        inactiveGain.gain.cancelScheduledValues(now);
        inactiveGain.gain.setValueAtTime(0.0001, now);
      }

      const streamUrl = await this.getTrackStreamUrl(nextTrack);
      if (streamUrl && !this.isTransitioning) {
        inactiveAudio.crossOrigin = 'anonymous';
        inactiveAudio.preload = 'auto';
        inactiveAudio.src = streamUrl;
        inactiveAudio.load(); // Forces physical hardware codec warm-up
        this.preprimedTrackId = nextTrack.id;
      }
    } catch (err) {
      console.warn('[AudioEngine] Error en pre-priming de códec:', err);
      this.preprimedTrackId = null;
    } finally {
      this.isPrepriming = false;
      this.enforceRamQuota();
    }
  }

  /**
   * Deterministic RAM Quota Enforcement: Strictly max 2 Blob URLs active in RAM.
   * Evicts older URLs deterministically via URL.revokeObjectURL.
   */
  public enforceRamQuota() {
    const currentTrack = this.getCurrentTrack();
    const nextIdx = this.getNextTrackIndex();
    const nextTrack = nextIdx !== null ? this.state.queue[nextIdx] : null;

    const currentFileId = currentTrack?.cloudFileId || currentTrack?.driveFileId || '';
    const nextFileId = nextTrack?.cloudFileId || nextTrack?.driveFileId || '';

    driveService.evictOldBlobsExcept([currentFileId, nextFileId]);
  }

  /**
   * Automated Seamless Transition to Next Track without Audio Focus loss
   */
  public async performTransitionToNext(duration: number = 1.5) {
    if (this.isTransitioning) return;

    const nextIdx = this.getNextTrackIndex();
    if (nextIdx === null) {
      this.pause();
      this.seek(0);
      return;
    }

    await this.transitionToTrackIndex(nextIdx, duration);
  }

  /**
   * Seamless Dual Audio Transition to Any Target Track Index
   * Guarantees zero pops, zero dropouts, and continuous in-vehicle Audio Focus.
   */
  public async transitionToTrackIndex(targetIdx: number, forcedDuration?: number) {
    if (targetIdx < 0 || targetIdx >= this.state.queue.length) return;
    if (targetIdx === this.state.currentTrackIndex && this.state.isPlaying && !forcedDuration) return;

    const targetTrack = this.state.queue[targetIdx];
    if (!targetTrack) return;

    if (this.isTrackRequiringAuth(targetTrack)) {
      const refreshed = await authService.refreshAccessTokenSilently();
      if (!refreshed && this.isTrackRequiringAuth(targetTrack)) {
        this.isTransitioning = false;
        this.state.isLoading = false;
        this.state.isPlaying = false;
        this.state.currentTrackIndex = targetIdx;
        this.state.error = 'drive_auth_required';
        this.notifyListeners();
        this.notifyAuthRequired('drive', targetTrack);
        return;
      }
    }

    // If not currently playing, start direct playback
    if (!this.state.isPlaying) {
      this.state.currentTrackIndex = targetIdx;
      await this.playCurrentTrack();
      return;
    }

    const duration = forcedDuration !== undefined
      ? forcedDuration
      : (this.state.isCrossfadeEnabled
          ? Math.max(1.0, this.state.crossfadeDuration)
          : (this.state.isFadeInOutEnabled ? Math.min(this.state.fadeInOutDuration, 2.0) : 1.5));

    this.isTransitioning = true;
    this.initWebAudio();

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const nextPlayerIndex = this.activePlayerIndex === 0 ? 1 : 0;
    const incomingAudio = nextPlayerIndex === 0 ? this.audioA : this.audioB;
    const outgoingAudio = this.activeAudio;
    const incomingGain = nextPlayerIndex === 0 ? this.gainNodeA : this.gainNodeB;
    const outgoingGain = this.activeGainNode;

    try {
      // If incoming audio does not have the target track primed yet, load it immediately
      if (this.preprimedTrackId !== targetTrack.id || !incomingAudio.src) {
        const streamUrl = await this.getTrackStreamUrl(targetTrack);
        if (!streamUrl) throw new Error('No stream URL available');
        incomingAudio.crossOrigin = 'anonymous';
        incomingAudio.preload = 'auto';
        incomingAudio.src = streamUrl;
      }

      incomingAudio.playbackRate = this.state.playbackRate;
      incomingAudio.currentTime = 0;

      const now = this.audioContext ? this.audioContext.currentTime : 0;

      // 1. Descending volume ramp on outgoing channel (prevents pops / clicks)
      if (this.audioContext && outgoingGain) {
        outgoingGain.gain.cancelScheduledValues(now);
        outgoingGain.gain.setValueAtTime(outgoingGain.gain.value || 1.0, now);
        outgoingGain.gain.linearRampToValueAtTime(0.0001, now + duration);
      }

      // 2. Ascending volume ramp on incoming channel simultaneously (0 to 1)
      if (this.audioContext && incomingGain) {
        incomingGain.gain.cancelScheduledValues(now);
        incomingGain.gain.setValueAtTime(0.0001, now);
        incomingGain.gain.linearRampToValueAtTime(1.0, now + duration);
      }

      // 3. Immediately start playing incoming channel so audio stream never drops to zero
      await incomingAudio.play();

      // 4. Update active channel and state immediately
      this.activePlayerIndex = nextPlayerIndex;
      this.state.currentTrackIndex = targetIdx;
      this.state.currentTime = 0;
      this.state.duration = targetTrack.duration || 0;
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this.updateMediaSessionMetadata(targetTrack);
      this.notifyListeners();
      dbService.logTrackPlayed(targetTrack.id).catch(() => {});

      // 5. Enforce RAM quota
      this.enforceRamQuota();

      // 6. Complete transition: pause outgoing audio, clean src and call load() to free decoder RAM
      if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = setTimeout(() => {
        outgoingAudio.pause();
        outgoingAudio.removeAttribute('src');
        outgoingAudio.load();
        this.isTransitioning = false;
        this.preprimedTrackId = null;
        this.enforceRamQuota();
      }, duration * 1000);
    } catch (err) {
      console.warn('[AudioEngine] Transition failed, fallback to direct play:', err);
      this.isTransitioning = false;
      this.state.currentTrackIndex = targetIdx;
      await this.playCurrentTrack();
    }
  }

  private async triggerCrossfadeToNext() {
    await this.performTransitionToNext(this.state.crossfadeDuration);
  }

  private getNextTrackIndex(): number | null {
    if (this.state.queue.length === 0) return null;

    if (this.state.playbackMode === 'repeat_one') {
      return this.state.currentTrackIndex;
    }

    if (this.state.currentTrackIndex + 1 < this.state.queue.length) {
      return this.state.currentTrackIndex + 1;
    }

    // At the end of queue
    if (this.state.playbackMode === 'continuous' || this.state.repeatMode === 'all') {
      return 0; // loop back to first track
    }

    return null; // Stop at end for 'linear' mode
  }

  public async play() {
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    const currentTrack = this.getCurrentTrack();
    if (this.isTrackRequiringAuth(currentTrack)) {
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.error = 'drive_auth_required';
      this.notifyListeners();
      this.notifyAuthRequired('drive', currentTrack || undefined);
      return;
    }

    if (this.activeAudio.src && this.state.currentTrackIndex !== -1) {
      try {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // Desvanecimiento (Fade in)
        if (this.state.isFadeInOutEnabled && this.activeGainNode && this.audioContext) {
          const now = this.audioContext.currentTime;
          this.activeGainNode.gain.cancelScheduledValues(now);
          this.activeGainNode.gain.setValueAtTime(0, now);
          this.activeGainNode.gain.linearRampToValueAtTime(1.0, now + this.state.fadeInOutDuration);
        } else if (this.activeGainNode && this.audioContext) {
          const now = this.audioContext.currentTime;
          this.activeGainNode.gain.cancelScheduledValues(now);
          this.activeGainNode.gain.setValueAtTime(1.0, now);
        }

        this.state.isPlaying = true;
        this.notifyListeners();
        await this.activeAudio.play();
      } catch (e) {
        console.warn('Play interrupted:', e);
      }
    } else if (this.state.queue.length > 0) {
      this.state.currentTrackIndex = 0;
      await this.playCurrentTrack();
    }
  }

  public pause() {
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    // Actualización inmediata del estado visual a "Pausa" para respuesta instantánea en la UI
    this.state.isPlaying = false;
    this.notifyListeners();
    this.stopMediaSessionPositionSync();
    this.persistCurrentSessionState();

    // Desvanecimiento gradual del audio en segundo plano (Fade out)
    if (this.state.isFadeInOutEnabled && this.activeGainNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      const currentGain = this.activeGainNode.gain.value || 1.0;
      this.activeGainNode.gain.cancelScheduledValues(now);
      this.activeGainNode.gain.setValueAtTime(currentGain, now);
      this.activeGainNode.gain.linearRampToValueAtTime(0.0001, now + this.state.fadeInOutDuration);

      this.fadeOutTimer = setTimeout(() => {
        if (!this.state.isPlaying) {
          this.activeAudio.pause();
        }
        this.fadeOutTimer = null;
      }, this.state.fadeInOutDuration * 1000);
    } else if (this.activeGainNode && this.audioContext && this.audioContext.state !== 'suspended') {
      // 25ms micro-fade to eliminate the pop/click on direct pause
      const now = this.audioContext.currentTime;
      const currentGain = this.activeGainNode.gain.value || 1.0;
      this.activeGainNode.gain.cancelScheduledValues(now);
      this.activeGainNode.gain.setValueAtTime(currentGain, now);
      this.activeGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.025);
      this.fadeOutTimer = setTimeout(() => {
        if (!this.state.isPlaying) {
          this.activeAudio.pause();
        }
        this.fadeOutTimer = null;
      }, 25);
    } else {
      this.activeAudio.pause();
    }
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public async next() {
    if (this.state.queue.length === 0) return;

    if (this.state.playbackMode === 'repeat_one') {
      this.seek(0);
      await this.play();
      return;
    }

    const nextIndex = this.getNextTrackIndex();
    if (nextIndex !== null) {
      await this.transitionToTrackIndex(nextIndex, 0.5);
    } else {
      this.pause();
      this.seek(0);
    }
  }

  public async previous() {
    if (this.state.queue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (this.activeAudio.currentTime > 3) {
      this.seek(0);
      return;
    }

    let prevIndex = -1;
    if (this.state.currentTrackIndex > 0) {
      prevIndex = this.state.currentTrackIndex - 1;
    } else if (this.state.playbackMode === 'continuous' || this.state.repeatMode === 'all') {
      prevIndex = this.state.queue.length - 1;
    }

    if (prevIndex !== -1) {
      await this.transitionToTrackIndex(prevIndex, 0.5);
    } else {
      this.seek(0);
    }
  }

  private handleTrackEnded() {
    if (this.state.playbackMode === 'repeat_one') {
      this.seek(0);
      this.play();
    } else {
      this.performTransitionToNext(1.5);
    }
  }

  public seek(seconds: number) {
    this.seekController.seekToSeconds(seconds);
  }

  public seekPercent(percent: number) {
    this.seekController.seekToPercent(percent);
  }

  public skipSeconds(seconds: number) {
    this.seekController.skip(seconds);
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(vol, 1));
    this.audioA.volume = clamped;
    this.audioB.volume = clamped;
    this.state.volume = clamped;
    this.state.isMuted = clamped === 0;

    if (this.masterGain && this.audioContext && this.audioContext.state !== 'suspended') {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.02);
    }

    this.notifyListeners();
    dbService.setSetting('player_volume', clamped);
    preferencesService.updateCurrentPreference('volume', clamped);
  }

  public toggleMute() {
    if (this.state.isMuted) {
      const vol = this.state.volume || 0.85;
      this.setVolume(vol);
      this.state.isMuted = false;
    } else {
      this.setVolume(0);
      this.state.isMuted = true;
    }
    this.notifyListeners();
  }

  public setPlaybackRate(rate: number) {
    this.audioA.playbackRate = rate;
    this.audioB.playbackRate = rate;
    this.state.playbackRate = rate;
    this.notifyListeners();
    this.updateMediaSessionPosition();
    dbService.setSetting('player_speed', rate);
    preferencesService.updateCurrentPreference('playbackRate', rate);
  }

  /**
   * Set Playback Mode (Lineal, Suflé, Continuo, Repetir 1)
   */
  public setPlaybackMode(mode: PlaybackMode) {
    this.state.playbackMode = mode;
    this.state.isShuffle = mode === 'shuffle';
    this.state.repeatMode = mode === 'continuous' ? 'all' : mode === 'repeat_one' ? 'one' : 'off';

    const currentTrack = this.getCurrentTrack();

    if (mode === 'shuffle') {
      this.state.queue = this.shuffleArray([...this.originalQueueOrder]);
      if (currentTrack) {
        const newIdx = this.state.queue.findIndex((t) => t.id === currentTrack.id);
        if (newIdx !== -1) {
          const temp = this.state.queue[0];
          this.state.queue[0] = this.state.queue[newIdx];
          this.state.queue[newIdx] = temp;
          this.state.currentTrackIndex = 0;
        }
      }
    } else {
      this.state.queue = [...this.originalQueueOrder];
      if (currentTrack) {
        const originalIdx = this.state.queue.findIndex((t) => t.id === currentTrack.id);
        this.state.currentTrackIndex = originalIdx !== -1 ? originalIdx : 0;
      }
    }

    this.notifyListeners();
    dbService.setSetting('player_mode', mode);
    preferencesService.updateCurrentPreference('playbackMode', mode);
  }

  public cyclePlaybackMode() {
    const modes: PlaybackMode[] = ['linear', 'shuffle', 'continuous', 'repeat_one'];
    const nextIdx = (modes.indexOf(this.state.playbackMode) + 1) % modes.length;
    this.setPlaybackMode(modes[nextIdx]);
  }

  public toggleShuffle() {
    if (this.state.playbackMode === 'shuffle') {
      this.setPlaybackMode('linear');
    } else {
      this.setPlaybackMode('shuffle');
    }
  }

  public cycleRepeatMode() {
    if (this.state.playbackMode === 'linear') {
      this.setPlaybackMode('continuous');
    } else if (this.state.playbackMode === 'continuous') {
      this.setPlaybackMode('repeat_one');
    } else {
      this.setPlaybackMode('linear');
    }
  }

  /**
   * Configure Crossfade (Crosfade)
   */
  public setCrossfade(enabled: boolean, durationSeconds?: number) {
    this.state.isCrossfadeEnabled = enabled;
    if (durationSeconds !== undefined) {
      this.state.crossfadeDuration = Math.max(1, Math.min(12, durationSeconds));
    }
    this.notifyListeners();
    dbService.setSetting('player_crossfade', enabled);
    preferencesService.updateCurrentPreference('isCrossfadeEnabled', enabled);
    if (durationSeconds !== undefined) {
      dbService.setSetting('player_crossfade_dur', this.state.crossfadeDuration);
      preferencesService.updateCurrentPreference('crossfadeDuration', this.state.crossfadeDuration);
    }
  }

  /**
   * Configure Desvanecimiento (Fade In / Fade Out)
   */
  public setFadeInOut(enabled: boolean, durationSeconds?: number) {
    this.state.isFadeInOutEnabled = enabled;
    if (durationSeconds !== undefined) {
      this.state.fadeInOutDuration = Math.max(0.5, Math.min(10, durationSeconds));
    }
    this.notifyListeners();
    dbService.setSetting('player_fade_in_out', enabled);
    preferencesService.updateCurrentPreference('isFadeInOutEnabled', enabled);
    if (durationSeconds !== undefined) {
      dbService.setSetting('player_fade_dur', this.state.fadeInOutDuration);
      preferencesService.updateCurrentPreference('fadeInOutDuration', this.state.fadeInOutDuration);
    }
  }

  public applyEQPreset(presetName: string) {
    this.state.eqPreset = presetName;
    this.notifyListeners();
    dbService.setSetting('player_eq', presetName);
    preferencesService.updateCurrentPreference('eqPreset', presetName);

    if (!this.bassFilter || !this.midFilter || !this.trebleFilter) return;

    switch (presetName) {
      case 'Bass Boost':
        this.bassFilter.gain.value = 6;
        this.midFilter.gain.value = 1;
        this.trebleFilter.gain.value = 2;
        break;
      case 'Vocal Clear':
        this.bassFilter.gain.value = -2;
        this.midFilter.gain.value = 5;
        this.trebleFilter.gain.value = 4;
        break;
      case 'Electronic / Dance':
        this.bassFilter.gain.value = 7;
        this.midFilter.gain.value = -1;
        this.trebleFilter.gain.value = 5;
        break;
      case 'Acoustic / Roadtrip':
        this.bassFilter.gain.value = 3;
        this.midFilter.gain.value = 2;
        this.trebleFilter.gain.value = 4;
        break;
      case 'Balanced':
      default:
        this.bassFilter.gain.value = 0;
        this.midFilter.gain.value = 0;
        this.trebleFilter.gain.value = 0;
        break;
    }
  }

  /**
   * Automatic Volume Normalization & Rebalancing (Auto-Leveling / Dynamics Compressor DSP)
   * Equalizes loudness across older tracks and modern loud masters for an even automotive sound level.
   */
  public setNormalization(enabled: boolean, preset?: 'balanced' | 'dynamic' | 'night') {
    this.state.isNormalizationEnabled = enabled;
    if (preset) {
      this.state.normalizationPreset = preset;
    }
    this.applyNormalizationSettings();
    this.notifyListeners();
    dbService.setSetting('player_norm_enabled', enabled);
    preferencesService.updateCurrentPreference('isNormalizationEnabled', enabled);
    if (preset) {
      dbService.setSetting('player_norm_preset', preset);
      preferencesService.updateCurrentPreference('normalizationPreset', preset);
    }
  }

  private applyNormalizationSettings() {
    if (!this.compressor || !this.normalizationGain || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    if (!this.state.isNormalizationEnabled) {
      // Default Master Protection Limiter settings (eliminates distortion, pops & clicks)
      this.compressor.threshold.setValueAtTime(-12, now);
      this.compressor.knee.setValueAtTime(30, now);
      this.compressor.ratio.setValueAtTime(12, now);
      this.compressor.attack.setValueAtTime(0.003, now);
      this.compressor.release.setValueAtTime(0.25, now);
      this.normalizationGain.gain.setValueAtTime(1.0, now);
      return;
    }

    switch (this.state.normalizationPreset) {
      case 'dynamic':
        // Gentle audiophile leveling (preserves large dynamic peaks while taming spikes)
        this.compressor.threshold.setValueAtTime(-18, now);
        this.compressor.knee.setValueAtTime(20, now);
        this.compressor.ratio.setValueAtTime(4, now);
        this.compressor.attack.setValueAtTime(0.005, now);
        this.compressor.release.setValueAtTime(0.25, now);
        this.normalizationGain.gain.setValueAtTime(1.15, now);
        break;

      case 'night':
        // Aggressive night/highway compression (brings up quiet whisper sections and limits loud thumps)
        this.compressor.threshold.setValueAtTime(-30, now);
        this.compressor.knee.setValueAtTime(40, now);
        this.compressor.ratio.setValueAtTime(16, now);
        this.compressor.attack.setValueAtTime(0.002, now);
        this.compressor.release.setValueAtTime(0.18, now);
        this.normalizationGain.gain.setValueAtTime(1.45, now);
        break;

      case 'balanced':
      default:
        // Standard Automotive Broadcast Normalization (optimal for car audio & mixed genres)
        this.compressor.threshold.setValueAtTime(-24, now);
        this.compressor.knee.setValueAtTime(30, now);
        this.compressor.ratio.setValueAtTime(10, now);
        this.compressor.attack.setValueAtTime(0.003, now);
        this.compressor.release.setValueAtTime(0.22, now);
        this.normalizationGain.gain.setValueAtTime(1.3, now);
        break;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  public async setBufferAheadCount(count: number) {
    this.state.bufferAheadCount = Math.max(1, Math.min(count, 5));
    this.notifyListeners();
    await dbService.setSetting('player_buffer_ahead', this.state.bufferAheadCount);
    preferencesService.updateCurrentPreference('bufferAheadCount', this.state.bufferAheadCount);
    this.prefetchUpcomingTracks().catch(() => {});
  }

  public async prefetchUpcomingTracks() {
    if (this.state.queue.length === 0) return;
    const count = this.state.bufferAheadCount || 3;
    const currentIdx = this.state.currentTrackIndex;
    const tracksToPrefetch: AudioTrack[] = [];

    for (let i = 1; i <= count; i++) {
      const nextIdx = (currentIdx + i) % this.state.queue.length;
      const track = this.state.queue[nextIdx];
      if (track && (track.cloudFileId || track.driveFileId)) {
        tracksToPrefetch.push(track);
      }
    }

    if (tracksToPrefetch.length === 0) return;

    this.state.isPreloading = true;
    this.notifyListeners();

    const loadedIds: string[] = [...(this.state.preloadedTrackIds || [])];

    for (const track of tracksToPrefetch) {
      try {
        const ok = await cloudService.prefetchTrack(track);
        if (ok && !loadedIds.includes(track.id)) {
          loadedIds.push(track.id);
        }
      } catch {
        // Non-blocking prefetch
      }
    }

    this.state.preloadedTrackIds = loadedIds;
    this.state.isPreloading = false;
    this.notifyListeners();

    // Hardware Gapless Pre-Priming: Pre-warm the inactive audio element with the immediate next track's URL
    // so hardware audio codecs and decoders are ready in RAM without startup latency stutter
    if (this.state.queue.length > 0 && !this.isTransitioning) {
      const nextIdx = this.getNextTrackIndex();
      if (nextIdx !== null && nextIdx !== this.state.currentTrackIndex) {
        const nextTrack = this.state.queue[nextIdx];
        if (nextTrack) {
          this.preprimeNextTrack(nextTrack).catch(() => {});
        }
      }
    }
  }

  private scheduleLazyPrefetch() {
    if (this.lazyPrefetchTimer) {
      clearTimeout(this.lazyPrefetchTimer);
    }
    this.hasTriggeredLazyPrefetch = false;

    // Wait 10 seconds of continuous listening before triggering mobile cellular prefetching
    this.lazyPrefetchTimer = setTimeout(() => {
      if (this.state.isPlaying && !this.hasTriggeredLazyPrefetch) {
        this.hasTriggeredLazyPrefetch = true;
        this.prefetchUpcomingTracks().catch(() => {});
      }
    }, 10000);
  }

  public async clearBufferCache() {
    await dbService.clearAudioBlobCache();
    this.state.preloadedTrackIds = [];
    this.notifyListeners();
    this.prefetchUpcomingTracks().catch(() => {});
  }

  public persistCurrentSessionState(force = false) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (!force && now - this.lastSessionPersistTime < 4000) return;
    this.lastSessionPersistTime = now;
    if (this.state.queue.length > 0) {
      try {
        const session = {
          queue: this.state.queue,
          currentTrackIndex: this.state.currentTrackIndex,
          currentTime: this.state.currentTime,
          isPlaying: false,
          playbackMode: this.state.playbackMode,
          playbackScope: this.state.playbackScope,
          volume: this.state.volume,
          eqPreset: this.state.eqPreset,
          timestamp: now
        };
        localStorage.setItem('audiocar_session_state', JSON.stringify(session));
      } catch {}
    }
  }

  public isTrackRequiringAuth(track?: AudioTrack | null): boolean {
    if (!track) return false;
    const isDriveTrack = track.source === 'drive' || (!track.source && !!track.driveFileId) || (!track.source && !!track.cloudFileId);
    if (!isDriveTrack) return false;
    const token = authService.getAccessToken();
    return !token && !track.cachedBlobUrl;
  }

  public onAuthRequired(listener: AuthRequiredListener): () => void {
    this.authRequiredListeners.add(listener);
    return () => this.authRequiredListeners.delete(listener);
  }

  public notifyAuthRequired(provider: 'drive', track?: AudioTrack) {
    this.authRequiredListeners.forEach((l) => {
      try {
        l(provider, track);
      } catch (e) {
        console.warn('Auth required listener error:', e);
      }
    });
  }

  public getState(): PlayerState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public notifyListeners() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }
}

export const audioEngine = new AudioEngine();
