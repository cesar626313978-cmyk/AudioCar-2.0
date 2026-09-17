/**
 * Audio Settings, Equalizer & Playback Options Modal - Sophisticated Dark
 * Configure:
 * - Playback Modes: Lineal, Suflé (Shuffle), Continuo (Loop All), Repetir 1 (Loop Track)
 * - Crosfade (Fundido Cruzado): Configurable overlapping transition (1s to 12s)
 * - Desvanecimiento (Fade In / Fade Out): Smooth volume ramping on play/pause
 * - 3-Band Equalizer DSP Presets
 * - Playback speed, Google Drive OAuth Client ID, and Local Cache
 */

import React, { useState, useEffect } from 'react';
import { PlayerState, PlaybackMode, PlaybackScope, AudioTrack, DriveAuthUser } from '../types';
import { audioEngine } from '../services/audioEngine';
import { authService } from '../services/authService';
import { preferencesService, CloudSyncStatus } from '../services/preferencesService';
import {
  X,
  Sliders,
  Database,
  Check,
  Zap,
  Sparkles,
  Waves,
  Shuffle,
  Repeat,
  Repeat1,
  ArrowRight,
  SlidersHorizontal,
  Volume2,
  Folder,
  FolderTree,
  Layers,
  Radio,
  ShieldCheck,
  Wifi,
  HardDrive,
  MessageSquare,
  RotateCcw,
  User,
  UserCheck,
  ExternalLink,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';

interface AudioSettingsModalProps {
  playerState: PlayerState;
  onClose: () => void;
  hasDemoTracks?: boolean;
  onDeleteDemoTracks?: () => void;
  onRestoreDemoTracks?: () => void;
  allTracks?: AudioTrack[];
  onOpenDonation?: () => void;
  onOpenContact?: () => void;
  onOpenHelp?: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  playerState,
  onClose,
  hasDemoTracks = false,
  onDeleteDemoTracks,
  onRestoreDemoTracks,
  allTracks,
  onOpenDonation,
  onOpenContact,
  onOpenHelp
}) => {
  const [clearedCacheMsg, setClearedCacheMsg] = useState(false);
  const [currentUser, setCurrentUser] = useState<DriveAuthUser | null>(authService.getUser());
  const [resetMsg, setResetMsg] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(preferencesService.getCloudSyncStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = authService.subscribe((user) => {
      setCurrentUser(user);
    });
    const unsubSync = preferencesService.subscribeSyncStatus((status) => {
      setCloudSyncStatus(status);
    });
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  const handleResetDefaults = async () => {
    const email = currentUser?.email || 'default';
    const defaults = await preferencesService.resetToDefaults(email);
    audioEngine.applyPreferencesProfile(defaults);
    setResetMsg(true);
    setTimeout(() => setResetMsg(false), 3000);
  };

  const handleManualSync = async () => {
    if (!currentUser?.email) return;
    setIsManualSyncing(true);
    try {
      await preferencesService.syncWithCloud(currentUser.email);
      setSyncFeedback('¡Sincronizado!');
      setTimeout(() => setSyncFeedback(null), 2500);
    } catch {
      setSyncFeedback('Error al sincronizar');
      setTimeout(() => setSyncFeedback(null), 2500);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleSaveAndClose = async () => {
    await preferencesService.flushCloudSync();
    onClose();
  };

  const currentTrack = audioEngine.getCurrentTrack();
  const currentFolderName = currentTrack?.folderPath || (currentTrack?.album && currentTrack.album !== 'Google Drive Cloud' && currentTrack.album !== 'mimusica' ? currentTrack.album : 'Carpeta /mimusica');

  const playbackModes: { id: PlaybackMode; label: string; icon: React.FC<any>; desc: string }[] = [
    { id: 'linear', label: 'Lineal', icon: ArrowRight, desc: 'Reproduce en orden estricto de inicio a fin' },
    { id: 'shuffle', label: 'Aleatorio (Shuffle)', icon: Shuffle, desc: 'Orden aleatorio inteligente sin repetición' },
    { id: 'continuous', label: 'Continuo (Bucle)', icon: Repeat, desc: 'Repite la lista entera infinitamente' },
    { id: 'repeat_one', label: 'Repetir Pista', icon: Repeat1, desc: 'Repite en bucle la misma canción' }
  ];

  const presets = [
    { id: 'Balanced', label: 'Equilibrado / Flat', desc: 'Fidelidad neutral para todo tipo de música' },
    { id: 'Bass Boost', label: 'Refuerzo de Graves (Bass)', desc: 'Graves profundos para el sistema de altavoces' },
    { id: 'Vocal Clear', label: 'Voces Claras & Podcasts', desc: 'Realce de frecuencias medias para hablar' },
    { id: 'Electronic / Dance', label: 'Electrónica / Dance', desc: 'Graves potentes y agudos brillantes' },
    { id: 'Acoustic / Roadtrip', label: 'Acústico & Roadtrip', desc: 'Calidez espacial para viajes en carretera' }
  ];

  const handleClearCache = async () => {
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        indexedDB.deleteDatabase('TeslaDriveAudioDB');
        localStorage.clear();
        setClearedCacheMsg(true);
        setTimeout(() => setClearedCacheMsg(false), 3000);
      } catch (e) {
        console.warn('Could not clear storage:', e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-5 sm:p-6 bg-gradient-to-b from-neutral-900/90 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md shrink-0">
              <Sliders className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Opciones de Reproducción & DSP</h2>
              <p className="text-xs text-neutral-400">Modos, Crossfade, Desvanecimiento y Perfil Acústico</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="hitbox-48 w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">

        {/* 0. Perfil de Usuario & Preferencias Persistentes por Cuenta */}
        <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {currentUser?.picture ? (
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full border border-neutral-700 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 font-bold shrink-0">
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : <User className="w-5 h-5 text-neutral-400" />}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">
                  {currentUser ? currentUser.email : 'Modo Local / Invitado'}
                </span>
                {currentUser && (
                  <>
                    {cloudSyncStatus === 'syncing' || isManualSyncing ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/80 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                        Sincronizando Nube...
                      </span>
                    ) : cloudSyncStatus === 'synced' ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1.5">
                        <Cloud className="w-3 h-3 text-emerald-400" />
                        Nube Drive Sincronizada
                      </span>
                    ) : cloudSyncStatus === 'error' ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1.5">
                        <CloudOff className="w-3 h-3 text-amber-400" />
                        Guardado Local (Pendiente Nube)
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center gap-1.5">
                        <CloudOff className="w-3 h-3 text-neutral-400" />
                        Modo Local
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {currentUser
                  ? 'Tus modos, EQ, crossfade, búfer y luces LED se guardan en la nube (Drive AppData) para estar sincronizados en cualquier navegador o en tu coche.'
                  : 'Inicia sesión con tu cuenta de Google Drive para sincronizar tus preferencias en la nube.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {currentUser && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isManualSyncing}
                className="hitbox-48 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Sincronizar preferencias con Google Drive AppData ahora"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-neutral-400 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{syncFeedback || (isManualSyncing ? 'Sincronizando...' : 'Sincronizar')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetDefaults}
              className="hitbox-48 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Restablecer ajustes de audio recomendados para el coche"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>{resetMsg ? '¡Restablecido!' : 'Valores Recomendados'}</span>
            </button>
          </div>
        </div>

        {/* 1. Playback Modes (Lineal, Suflé, Continuo, Repetir 1) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-white" />
            <span>Modo de Reproducción</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {playbackModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = playerState.playbackMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => audioEngine.setPlaybackMode(mode.id)}
                  className={`hitbox-48 p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-white/10 border-white/40 shadow-md'
                      : 'bg-[#0f0f0f] hover:bg-[#151515] border-neutral-800'
                  }`}
                >
                  <div className={`p-2 rounded-xl border shrink-0 ${
                    isSelected ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                        {mode.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-xs text-neutral-400 mt-0.5 block">{mode.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Ámbito de Reproducción (Carpeta Seleccionada vs Todas las Carpetas) */}
        <div className="space-y-3 pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-white" />
              <span>Ámbito de Reproducción (Alcance)</span>
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              {playerState.playbackScope === 'selected_folder' ? 'Solo Carpeta Actual' : 'Todas las Carpetas'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Opción A: Carpeta Seleccionada / Actual */}
            <button
              type="button"
              onClick={() => audioEngine.setPlaybackScope('selected_folder', allTracks)}
              className={`hitbox-48 p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                playerState.playbackScope === 'selected_folder'
                  ? 'bg-white/10 border-white/40 shadow-md ring-1 ring-white/20'
                  : 'bg-[#0f0f0f] hover:bg-[#151515] border-neutral-800'
              }`}
            >
              <div
                className={`p-2 rounded-xl border shrink-0 ${
                  playerState.playbackScope === 'selected_folder'
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                <Folder className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${
                      playerState.playbackScope === 'selected_folder' ? 'text-white' : 'text-neutral-200'
                    }`}
                  >
                    Carpeta Seleccionada
                  </span>
                  {playerState.playbackScope === 'selected_folder' && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                </div>
                <span className="text-xs text-neutral-400 mt-0.5 block leading-relaxed">
                  Reproduce en orden o aleatorio únicamente las canciones de la carpeta activa
                </span>
                {currentTrack && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 truncate max-w-full">
                    <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate font-mono">{currentFolderName}</span>
                  </div>
                )}
              </div>
            </button>

            {/* Opción B: Todas las canciones de todas las carpetas */}
            <button
              type="button"
              onClick={() => audioEngine.setPlaybackScope('all_folders', allTracks)}
              className={`hitbox-48 p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                playerState.playbackScope === 'all_folders'
                  ? 'bg-white/10 border-white/40 shadow-md ring-1 ring-white/20'
                  : 'bg-[#0f0f0f] hover:bg-[#151515] border-neutral-800'
              }`}
            >
              <div
                className={`p-2 rounded-xl border shrink-0 ${
                  playerState.playbackScope === 'all_folders'
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                <FolderTree className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${
                      playerState.playbackScope === 'all_folders' ? 'text-white' : 'text-neutral-200'
                    }`}
                  >
                    Todas las Carpetas
                  </span>
                  {playerState.playbackScope === 'all_folders' && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                </div>
                <span className="text-xs text-neutral-400 mt-0.5 block leading-relaxed">
                  Reproduce todas las canciones de todas las carpetas y subcarpetas (/mimusica)
                </span>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300">
                  <Layers className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>{allTracks ? `${allTracks.length} canciones en la biblioteca` : 'Biblioteca completa'}</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Normalización y Rebalanceo Automático de Volumen (Auto-Leveling) */}
        <div className="space-y-3 pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-white" />
              <span>Normalización y Rebalanceo de Volumen (Auto-Leveling)</span>
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              {playerState.isNormalizationEnabled ? 'Activo (Mismo Nivel)' : 'Desactivado'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Rebalanceo Automático de Ganancia (AGC / ReplayGain)</span>
                </div>
                <div className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                  Iguala automáticamente el nivel sonoro de todas las canciones (antiguas y modernas) para que salgan al mismo volumen sin tener que ajustar el dial mientras conduces.
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => audioEngine.setNormalization(!playerState.isNormalizationEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 border shrink-0 ${
                  playerState.isNormalizationEnabled ? 'bg-white border-white' : 'bg-neutral-800 border-neutral-700'
                }`}
                title={playerState.isNormalizationEnabled ? 'Desactivar normalización' : 'Activar normalización automática'}
              >
                <div className={`w-6 h-6 rounded-full transition-transform ${
                  playerState.isNormalizationEnabled ? 'translate-x-6 bg-black' : 'translate-x-0 bg-neutral-400'
                }`} />
              </button>
            </div>

            {playerState.isNormalizationEnabled && (
              <div className="space-y-2 pt-2 border-t border-neutral-800/60">
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                  Perfil de Nivelación:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'balanced', label: 'Equilibrado (Coche)', desc: 'Recomendado para el vehículo. Sonido parejo y natural.' },
                    { id: 'dynamic', label: 'Dinámico (Hi-Fi)', desc: 'Nivelación suave preservando la dinámica musical original.' },
                    { id: 'night', label: 'Modo Noche / Viaje', desc: 'Máxima uniformidad para evitar sustos de volumen.' }
                  ].map((p) => {
                    const isSelected = (playerState.normalizationPreset || 'balanced') === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => audioEngine.setNormalization(true, p.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-white/10 border-white text-white shadow-sm'
                            : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                            {p.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-1 block leading-snug">
                          {p.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Crossfade & Desvanecimiento (Fade In / Fade Out) */}
        <div className="space-y-4 pt-2 border-t border-neutral-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Waves className="w-4 h-4 text-white" />
            <span>Transiciones de Audio (Crossfade & Desvanecimiento)</span>
          </h3>

          {/* Crossfade Card */}
          <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Crosfade (Fundido Cruzado)</span>
                  <span className="text-xs font-mono text-neutral-400">
                    {playerState.isCrossfadeEnabled ? `${playerState.crossfadeDuration}s` : 'Desactivado'}
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  Solapamiento suave entre el final de una pista y el comienzo de la siguiente
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => audioEngine.setCrossfade(!playerState.isCrossfadeEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 border ${
                  playerState.isCrossfadeEnabled ? 'bg-white border-white' : 'bg-neutral-800 border-neutral-700'
                }`}
              >
                <div className={`w-6 h-6 rounded-full transition-transform ${
                  playerState.isCrossfadeEnabled ? 'translate-x-6 bg-black' : 'translate-x-0 bg-neutral-400'
                }`} />
              </button>
            </div>

            {playerState.isCrossfadeEnabled && (
              <div className="space-y-2 pt-2 border-t border-neutral-800/60">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span>Duración de Fundido:</span>
                  <span className="font-bold text-white">{playerState.crossfadeDuration} Segundos</span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={playerState.crossfadeDuration}
                  onChange={(e) => audioEngine.setCrossfade(true, parseInt(e.target.value, 10))}
                  className="automotive-slider w-full h-4"
                />

                {/* Preset quick buttons */}
                <div className="flex gap-2 pt-1">
                  {[2, 4, 6, 8, 12].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => audioEngine.setCrossfade(true, sec)}
                      className={`hitbox-48 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                        playerState.crossfadeDuration === sec
                          ? 'bg-white text-black'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desvanecimiento (Fade In / Fade Out) Card */}
          <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Desvanecimiento (Fade In & Out)</span>
                  <span className="text-xs font-mono text-neutral-400">
                    {playerState.isFadeInOutEnabled ? `${playerState.fadeInOutDuration}s` : 'Desactivado'}
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  Atenuación progresiva al reproducir, pausar y cambiar de pista para evitar cortes bruscos
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => audioEngine.setFadeInOut(!playerState.isFadeInOutEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 border ${
                  playerState.isFadeInOutEnabled ? 'bg-white border-white' : 'bg-neutral-800 border-neutral-700'
                }`}
              >
                <div className={`w-6 h-6 rounded-full transition-transform ${
                  playerState.isFadeInOutEnabled ? 'translate-x-6 bg-black' : 'translate-x-0 bg-neutral-400'
                }`} />
              </button>
            </div>

            {playerState.isFadeInOutEnabled && (
              <div className="space-y-2 pt-2 border-t border-neutral-800/60">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span>Tiempo de rampa (Desvanecimiento):</span>
                  <span className="font-bold text-white">{playerState.fadeInOutDuration} Segundos</span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={playerState.fadeInOutDuration}
                  onChange={(e) => audioEngine.setFadeInOut(true, parseInt(e.target.value, 10))}
                  className="automotive-slider w-full h-4"
                />

                {/* Preset quick buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-mono text-neutral-400 mr-1">Preajustes rápidos:</span>
                  {[1, 2, 3, 5, 8, 10].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => audioEngine.setFadeInOut(true, dur)}
                      className={`hitbox-48 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold transition-all ${
                        playerState.fadeInOutDuration === dur
                          ? 'bg-white text-black shadow-sm ring-2 ring-white/30'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Equalizer Presets */}
        <div className="space-y-3 pt-2 border-t border-neutral-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span>Perfiles de Ecualización (EQ DSP)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {presets.map((preset) => {
              const isSelected = playerState.eqPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => audioEngine.applyEQPreset(preset.id)}
                  className={`hitbox-48 p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white/10 border-white/40 shadow-md'
                      : 'bg-[#0f0f0f] hover:bg-[#151515] border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                      {preset.label}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="text-xs text-neutral-400 mt-1">{preset.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Mega-Buffer Anticorte para Coche (Resistencia a Zonas sin 4G/5G y Túneles) */}
        <div className="space-y-3 pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Mega-Buffer Anticorte para Conducción (4G / 5G / Túneles)</span>
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              {playerState.bufferAheadCount} {playerState.bufferAheadCount === 1 ? 'Pista' : 'Pistas'} Anticipadas
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-neutral-800 space-y-3">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-white" />
                <span>Pre-carga Inteligente de Canciones en Memoria e IndexedDB</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Cuando circulas por zonas sin cobertura o túneles, la música no se corta porque las siguientes pistas ya están descargadas al 100% en local. Además, mantiene el canal de audio activo para evitar que el coche cambie a la radio FM.
              </div>
            </div>

            {/* Selector de pistas anticipadas */}
            <div className="pt-2 border-t border-neutral-800/60 space-y-2">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                Canciones siguientes a mantener listas en caché:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 5].map((cnt) => {
                  const isSelected = (playerState.bufferAheadCount || 3) === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => audioEngine.setBufferAheadCount(cnt)}
                      className={`hitbox-48 p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-white text-black font-bold border-white shadow-md'
                          : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      <div className="text-sm">{cnt} {cnt === 1 ? 'Pista' : 'Pistas'}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-neutral-800' : 'text-neutral-400'}`}>
                        {cnt === 1 ? '~3-4 min' : cnt === 2 ? '~7-8 min' : cnt === 3 ? '~12 min' : '~20 min'} buffer
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buffer status indicator */}
            <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>
                  {playerState.isPreloading
                    ? 'Descargando y asegurando siguientes canciones en caché...'
                    : `${playerState.preloadedTrackIds?.length || 0} canciones listas para reproducción sin conexión`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => audioEngine.clearBufferCache()}
                className="text-[11px] text-neutral-400 hover:text-white underline"
              >
                Refrescar Buffer
              </button>
            </div>
          </div>
        </div>

        {/* 6. Velocidad de Reproducción */}
        <div className="space-y-3 pt-2 border-t border-neutral-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <span>Velocidad de Reproducción (Podcasts / Audiolibros)</span>
          </h3>

          <div className="grid grid-cols-5 gap-2">
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => audioEngine.setPlaybackRate(rate)}
                className={`hitbox-48 py-2.5 rounded-full font-mono text-xs font-bold uppercase transition-all ${
                  playerState.playbackRate === rate
                    ? 'bg-white text-black shadow-md'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>


        {/* 6. Pistas DEMO & Almacenamiento */}
        <div className="pt-2 border-t border-neutral-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f0f0f] p-4 rounded-2xl border border-neutral-800">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-neutral-400" />
                <span>Canciones de Demostración (DEMO)</span>
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {hasDemoTracks
                  ? 'Hay pistas de prueba activas. Puedes eliminarlas para escuchar únicamente tu Google Drive.'
                  : 'Pistas DEMO eliminadas. Tu biblioteca solo contiene canciones de tu Google Drive.'}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasDemoTracks && onDeleteDemoTracks ? (
                <button
                  type="button"
                  onClick={onDeleteDemoTracks}
                  className="hitbox-48 px-4 py-2 rounded-full bg-red-950/50 hover:bg-red-900/80 text-red-300 border border-red-800 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Eliminar Canciones DEMO
                </button>
              ) : onRestoreDemoTracks ? (
                <button
                  type="button"
                  onClick={onRestoreDemoTracks}
                  className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Restaurar DEMO
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* 7. Apoyo y Donaciones Revolut / Café */}
        {onOpenDonation && (
          <div className="pt-2 border-t border-neutral-800 space-y-2">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-white text-black font-black text-[11px] flex items-center justify-center">
                    R
                  </div>
                  <span>¿Te gusta AudioCar? Invita a un café con Revolut</span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  Aporte voluntario 100% privado mediante código QR, Apple Pay, Google Pay o tarjeta.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDonation();
                }}
                className="hitbox-48 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md cursor-pointer"
              >
                <span>Invitar a un Café</span>
              </button>
            </div>
          </div>
        )}

        {/* 8. Contacto, Sugerencias y Asistencia */}
        {(onOpenContact || onOpenHelp) && (
          <div className="pt-2 border-t border-neutral-800 space-y-2">
            {onOpenHelp && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-amber-400 text-black font-bold flex items-center justify-center">
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <span>Guía de Inicio Rápido & Tutorial Paso a Paso</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Aprende cómo sincronizar tu Google Drive, reproducir canciones y usar todos los modos de audio.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHelp();
                  }}
                  className="hitbox-48 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                >
                  <span>Ver Guía</span>
                </button>
              </div>
            )}

            {onOpenContact && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center">
                      <MessageSquare className="w-3 h-3" />
                    </div>
                    <span>Contacto, Asistencia & Sugerencias</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    ¿Tienes una idea para mejorar la app o un problema técnico? Escríbenos directamente.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenContact();
                  }}
                  className="hitbox-48 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                >
                  <span>Enviar Opinión</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 9. Local Storage & Cache */}
        <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-neutral-400" />
              <span>Local Storage & IndexedDB</span>
            </div>
            <div className="text-xs text-neutral-400">
              Offline cache for tracks, metadata, album art and playlists
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleClearCache();
            }}
            className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:text-white border border-neutral-700 transition-colors cursor-pointer"
          >
            {clearedCacheMsg ? 'Cache Cleared!' : 'Clear Cache'}
          </button>
        </div>

        {/* 10. Política de Privacidad (Enlace simple y directo) */}
        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-neutral-400" />
            <span>Privacidad y Protección de Datos</span>
          </div>

          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white underline underline-offset-4 py-1"
          >
            <span>Ver Política de Privacidad</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Fixed Bottom Save / Action Bar */}
      <div className="p-4 sm:p-5 border-t border-neutral-800/90 bg-neutral-950/95 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Settings apply in real time to the player.</span>
          <span className="sm:hidden">Settings active</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSaveAndClose();
          }}
          className="hitbox-56 px-8 py-3 rounded-2xl bg-white hover:bg-neutral-200 active:scale-95 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-white/20"
        >
          <Check className="w-4 h-4 text-black stroke-[3]" />
          <span>Save & Close</span>
        </button>
      </div>
    </div>
  </div>
  );
};
