import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Disc, 
  Music, 
  HardDrive, 
  Folder, 
  Search, 
  Loader2, 
  RefreshCw, 
  Check, 
  ArrowLeft,
  Sparkles,
  Globe,
  Plus,
  Minus,
  ChevronRight,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { PlayerState, AudioTrack, DriveFolder, DriveAuthUser } from '../types';
import { audioEngine } from '../services/audioEngine';
import { authService } from '../services/authService';
import { driveService, MimusicaStructure } from '../services/driveService';
import { subscribeWeather, requestAndFetchWeather, LocalWeather } from '../services/weatherService';
import { DEMO_TRACKS } from '../data/demoTracks';
import { EclipseNeonBorder } from './EclipseNeonBorder';

interface SphericalPlayerProps {
  playerState: PlayerState;
  user: DriveAuthUser | null;
  tracks: AudioTrack[];
  folders: DriveFolder[];
  onTracksChange: (tracks: AudioTrack[]) => void;
  onFoldersChange: (folders: DriveFolder[]) => void;
  isLoadingDrive: boolean;
  setIsLoadingDrive: (loading: boolean) => void;
}

export function SphericalPlayer({
  playerState,
  user,
  tracks,
  folders,
  onTracksChange,
  onFoldersChange,
  isLoadingDrive,
  setIsLoadingDrive,
}: SphericalPlayerProps) {
  // View mode inside the sphere: 'player' | 'playlist' | 'drive_menu' | 'mimusica_selector'
  const [innerView, setInnerView] = useState<'player' | 'playlist' | 'drive_menu' | 'mimusica_selector'>('player');
  const [mimusicaStructure, setMimusicaStructure] = useState<MimusicaStructure | null>(null);
  const [mimusicaNotFound, setMimusicaNotFound] = useState(false);
  const [activeFolderMode, setActiveFolderMode] = useState<{ type: 'all' | 'subfolder'; name: string; folderId?: string }>({
    type: 'all',
    name: 'Toda /mimusica'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [syncStatusText, setSyncStatusText] = useState<string>('');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [localWeather, setLocalWeather] = useState<LocalWeather | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeWeather((w) => setLocalWeather(w));
    return unsubscribe;
  }, []);

  const sphereRef = useRef<HTMLDivElement>(null);
  const currentTrack = playerState.queue[playerState.currentTrackIndex] || null;

  // Track progress calculation
  const effectiveTime = isScrubbing && scrubTime !== null ? scrubTime : playerState.currentTime;
  const duration = playerState.duration > 0 ? playerState.duration : (currentTrack?.duration || 1);
  const progressFraction = Math.min(1, Math.max(0, effectiveTime / duration));
  const progressDegrees = progressFraction * 360;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Handle radial circumference scrub
  const handleRadialScrub = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!sphereRef.current || duration <= 0) return;
    const rect = sphereRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle clockwise from 12 o'clock (top)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    const frac = angle / 360;
    const targetTime = frac * duration;
    setScrubTime(targetTime);
  };

  const handleMouseDownScrub = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    handleRadialScrub(e);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleRadialScrub(moveEvent);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsScrubbing(false);

      if (!sphereRef.current || duration <= 0) return;
      const rect = sphereRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let angle = Math.atan2(upEvent.clientY - centerY, upEvent.clientX - centerX) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      const finalTime = (angle / 360) * duration;
      audioEngine.seek(finalTime);
      setScrubTime(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTouchStartScrub = (e: React.TouchEvent) => {
    setIsScrubbing(true);
    handleRadialScrub(e);

    const onTouchMove = (moveEvent: TouchEvent) => {
      handleRadialScrub(moveEvent);
    };

    const onTouchEnd = (endEvent: TouchEvent) => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      setIsScrubbing(false);

      if (!sphereRef.current || duration <= 0) return;
      const rect = sphereRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const touch = endEvent.changedTouches[0];
      if (touch) {
        let angle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
        const finalTime = (angle / 360) * duration;
        audioEngine.seek(finalTime);
      }
      setScrubTime(null);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    try {
      setIsLoadingDrive(true);
      setSyncStatusText('Conectando con Google Drive...');
      await authService.requestSignIn();
      await loadMimusicaData(true);
    } catch (err: any) {
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.toLowerCase().includes('cancelad') ||
        err?.message?.toLowerCase().includes('cerrad') ||
        err?.message?.toLowerCase().includes('popup');

      if (isCancelled) {
        console.warn('[SphericalPlayer] Login cancelled by user');
        setSyncStatusText('Inicio de sesión cancelado');
      } else {
        console.warn('[SphericalPlayer] Login error:', err);
        setSyncStatusText(err?.message || 'Error de conexión');
      }
      setTimeout(() => setSyncStatusText(''), 4000);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  // Dedicated scanner strictly for /mimusica and its subdirectories
  // NEVER creates the folder and NEVER scans the whole drive
  const loadMimusicaData = async (forceRefresh: boolean = false) => {
    if (!authService.getAccessToken()) return;
    try {
      setIsLoadingDrive(true);
      setSyncStatusText(forceRefresh ? 'Actualizando /mimusica...' : 'Consultando /mimusica...');
      const structure = await driveService.getMimusicaStructure(forceRefresh, (prog) => {
        setSyncStatusText(prog.step);
      });

      setMimusicaStructure(structure);

      if (!structure.exists) {
        setMimusicaNotFound(true);
        setSyncStatusText('Carpeta /mimusica no encontrada en Google Drive');
        setInnerView('mimusica_selector');
      } else {
        setMimusicaNotFound(false);
        onFoldersChange(structure.subfolders.map((s) => s.folder));

        if (structure.allTracks.length > 0) {
          if (activeFolderMode.type === 'subfolder' && activeFolderMode.folderId) {
            const subTracks = structure.tracksByFolderId[activeFolderMode.folderId] || structure.allTracks;
            onTracksChange(subTracks);
            audioEngine.setQueue(subTracks, 0, false);
          } else {
            onTracksChange(structure.allTracks);
            audioEngine.setQueue(structure.allTracks, 0, false);
            setActiveFolderMode({ type: 'all', name: 'Toda /mimusica' });
          }
          setSyncStatusText(`¡${structure.allTracks.length} canciones cargadas desde /mimusica!`);
        } else {
          setSyncStatusText('La carpeta /mimusica está vacía');
        }
      }
      setTimeout(() => setSyncStatusText(''), 3500);
    } catch (e: any) {
      console.warn('Error loading /mimusica:', e);
      setSyncStatusText(e?.message || 'Error al leer /mimusica');
      setTimeout(() => setSyncStatusText(''), 4000);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  // Automatically check /mimusica when user logs in
  useEffect(() => {
    if (user) {
      loadMimusicaData(false);
    }
  }, [user]);

  // Option 1: Play all music in /mimusica without reloading the player
  const handleSelectPlayAll = (shuffle: boolean = false) => {
    if (!mimusicaStructure || mimusicaStructure.allTracks.length === 0) {
      setSyncStatusText('No hay canciones en /mimusica');
      setTimeout(() => setSyncStatusText(''), 3000);
      return;
    }
    const all = mimusicaStructure.allTracks;
    onTracksChange(all);
    audioEngine.setQueue(all, 0, true);
    if (shuffle && !playerState.isShuffle) {
      audioEngine.toggleShuffle();
    }
    setActiveFolderMode({ type: 'all', name: 'Toda /mimusica' });
    setInnerView('player');
  };

  // Option 2: Play a specific subfolder of /mimusica without reloading the player
  const handleSelectSubfolder = (folder: DriveFolder) => {
    if (!mimusicaStructure) return;
    const subTracks = mimusicaStructure.tracksByFolderId[folder.id] || [];
    if (subTracks.length === 0) {
      setSyncStatusText(`No hay canciones en "${folder.name}"`);
      setTimeout(() => setSyncStatusText(''), 3000);
      return;
    }
    onTracksChange(subTracks);
    audioEngine.setQueue(subTracks, 0, true);
    setActiveFolderMode({ type: 'subfolder', name: folder.name, folderId: folder.id });
    setInnerView('player');
  };

  // Pick folder with Google Picker (optional fallback)
  const handlePickFolder = async () => {
    try {
      setIsLoadingDrive(true);
      setSyncStatusText('Abriendo selector de Google Drive...');
      const picked = await driveService.promptPickMusicFolder();
      if (picked) {
        setSyncStatusText(`Cargando carpeta ${picked.name}...`);
        const folderTracks = await driveService.listAudioFiles(picked.id, undefined, (p) => {
          setSyncStatusText(p.step);
        });
        if (folderTracks && folderTracks.length > 0) {
          onTracksChange(folderTracks);
          audioEngine.setQueue(folderTracks, 0, true);
          setActiveFolderMode({ type: 'subfolder', name: picked.name, folderId: picked.id });
        }
      }
    } catch (e: any) {
      console.warn('Picker cancelled or error:', e);
    } finally {
      setIsLoadingDrive(false);
      setTimeout(() => setSyncStatusText(''), 3000);
    }
  };

  // Load demo tracks
  const handleLoadDemoTracks = () => {
    onTracksChange(DEMO_TRACKS);
    audioEngine.setQueue(DEMO_TRACKS, 0, true);
    setActiveFolderMode({ type: 'all', name: 'Pistas de muestra' });
    setInnerView('player');
  };

  // Cycle repeat mode: 'off' -> 'all' -> 'one'
  const handleToggleRepeat = () => {
    audioEngine.cycleRepeatMode();
  };

  // Toggle shuffle mode
  const handleToggleShuffle = () => {
    audioEngine.toggleShuffle();
  };

  // Filter tracks in internal playlist
  const filteredTracks = useMemo(() => {
    const list = tracks.length > 0 ? tracks : DEMO_TRACKS;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [tracks, searchQuery]);

  // Audio quality tag
  const audioQualityTag = useMemo(() => {
    if (!currentTrack) return 'AUDIO EN ESPERA';
    if (currentTrack.bitrate?.toLowerCase().includes('flac') || currentTrack.name.toLowerCase().endsWith('.flac')) {
      return 'FLAC • 24-BIT BIT-PERFECT';
    }
    if (currentTrack.mimeType.includes('wav')) {
      return 'WAV • PCM LOSSLESS';
    }
    return currentTrack.bitrate || 'DRIVE STREAM • 320 KBPS';
  }, [currentTrack]);

  return (
    <div id="spherical-player-root" className="relative flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
      {/* Dynamic Solar Eclipse Neon Corona - Reacts in Real Time to Music Frequency & Intensity */}
      <EclipseNeonBorder isPlaying={playerState.isPlaying} />
      
      {/* THE SPHERICAL GLOBE CONTAINER (Optimized for Car Touch Screens) */}
      <div 
        ref={sphereRef}
        id="earth-sphere-container"
        className="relative w-[360px] h-[360px] sm:w-[500px] sm:h-[500px] md:w-[560px] md:h-[560px] lg:w-[600px] lg:h-[600px] rounded-full overflow-hidden select-none border-2 border-cyan-400/50 bg-[#030712] shadow-[0_0_60px_rgba(6,182,212,0.35),inset_0_0_100px_rgba(0,0,0,0.98)] flex flex-col items-center justify-between transition-all duration-300"
      >
        {/* TERRESTRIAL GLOBE WIREFRAME (Parallels & Meridians) */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
          viewBox="0 0 520 520"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Latitude Parallels */}
          <ellipse cx="260" cy="260" rx="252" ry="252" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4 6" />
          <ellipse cx="260" cy="260" rx="252" ry="70" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
          <ellipse cx="260" cy="180" rx="230" ry="50" stroke="#38bdf8" strokeWidth="0.6" opacity="0.4" />
          <ellipse cx="260" cy="340" rx="230" ry="50" stroke="#38bdf8" strokeWidth="0.6" opacity="0.4" />
          <ellipse cx="260" cy="110" rx="170" ry="30" stroke="#38bdf8" strokeWidth="0.5" opacity="0.3" />
          <ellipse cx="260" cy="410" rx="170" ry="30" stroke="#38bdf8" strokeWidth="0.5" opacity="0.3" />
          
          {/* Longitude Meridians */}
          <line x1="260" y1="8" x2="260" y2="512" stroke="#38bdf8" strokeWidth="0.8" opacity="0.5" />
          <line x1="8" y1="260" x2="512" y2="260" stroke="#38bdf8" strokeWidth="0.8" opacity="0.5" />
          <ellipse cx="260" cy="260" rx="80" ry="252" stroke="#38bdf8" strokeWidth="0.6" opacity="0.4" />
          <ellipse cx="260" cy="260" rx="160" ry="252" stroke="#38bdf8" strokeWidth="0.6" opacity="0.4" />
        </svg>

        {/* CIRCUMFERENCE SCRUBBING RING (The Orbital 360° Progress Ring) */}
        <svg 
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10"
          viewBox="0 0 520 520"
        >
          {/* Track background */}
          <circle
            cx="260"
            cy="260"
            r="252"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="5"
          />
          {/* Active progress */}
          <circle
            cx="260"
            cy="260"
            r="252"
            fill="none"
            stroke="url(#earthProgressGradient)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 252}
            strokeDashoffset={(2 * Math.PI * 252) * (1 - progressFraction)}
            className="transition-all duration-75 ease-linear"
          />
          <defs>
            <linearGradient id="earthProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>

        {/* Orbit Scrubber Handle Trigger along the perimeter */}
        <div 
          id="orbital-scrub-ring"
          className="absolute inset-0 rounded-full cursor-pointer z-20 touch-none pointer-events-auto"
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 6% 6%, 6% 94%, 94% 94%, 94% 6%, 6% 6%)' }}
          onMouseDown={handleMouseDownScrub}
          onTouchStart={handleTouchStartScrub}
          title="Arrastra o haz clic a lo largo de la circunferencia para avanzar o retroceder"
        />

        {/* Floating Scrubber Time Tooltip when dragging */}
        {isScrubbing && scrubTime !== null && (
          <div className="absolute top-12 z-30 px-3 py-1 bg-cyan-950/90 text-cyan-300 text-xs font-mono font-bold rounded-full border border-cyan-400 shadow-lg pointer-events-none">
            {formatTime(scrubTime)}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: MAIN SPHERICAL PLAYER CONTROLS (OPTIMIZED FOR CAR TOUCH SCREENS) */}
        {/* ========================================================================= */}
        {innerView === 'player' && (
          <div className="relative w-full h-full flex flex-col justify-between items-center p-5 sm:p-7 md:p-8 z-20 text-white select-none">
            
            {/* 1. NORTHERN POLAR REGION: Quick-Touch Drive Status & Audio Format */}
            <div className="flex flex-col items-center gap-2 pt-2 sm:pt-4 w-full max-w-[340px]">
              {/* Google Drive Status Button - Large Touch Target */}
              <button
                id="btn-drive-status"
                onClick={() => setInnerView('drive_menu')}
                className="flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-full bg-cyan-950/70 hover:bg-cyan-900/80 active:scale-95 border-2 border-cyan-400/40 text-xs sm:text-sm font-semibold text-cyan-200 transition-all shadow-md backdrop-blur-md min-h-[44px]"
              >
                <HardDrive className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="truncate max-w-[180px]">
                  {user ? (user.name || user.email.split('@')[0]) : 'Conectar Drive'}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${user ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-amber-400'}`} />
              </button>

              {/* Active Folder Switcher Badge - In-Car Touch Friendly */}
              {user && (
                <button
                  id="btn-active-folder-selector"
                  onClick={() => setInnerView('mimusica_selector')}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900 active:scale-95 border border-cyan-400/50 text-cyan-200 text-xs sm:text-sm font-semibold transition-all shadow-md backdrop-blur-md max-w-[280px]"
                  title="Cambiar subcarpeta o reproducir toda /mimusica"
                >
                  <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">
                    {activeFolderMode.type === 'all'
                      ? `📁 /mimusica (Todo • ${tracks.length})`
                      : `📂 ${activeFolderMode.name} (${tracks.length})`}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                </button>
              )}

              {/* Status Notice or Audio Format Badge */}
              {syncStatusText ? (
                <div className="text-[11px] sm:text-xs font-mono text-cyan-300 animate-pulse tracking-wide truncate max-w-[280px]">
                  {syncStatusText}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-300/90 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    {audioQualityTag}
                  </div>

                  {/* Weather & Road Notice Chip - In-Car Glanceable */}
                  <button
                    id="btn-weather-glance"
                    onClick={() => {
                      if (!localWeather?.isGps) {
                        requestAndFetchWeather();
                      }
                      window.dispatchEvent(new CustomEvent('audiocar-launch-ufo', { detail: { category: 'weather' } }));
                    }}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 hover:bg-cyan-900/80 active:scale-95 border border-cyan-400/30 text-[10px] sm:text-[11px] font-mono text-cyan-200 transition-all shadow-sm backdrop-blur-md max-w-[180px] truncate"
                    title="Toca para actualizar pronóstico o invocar el OVNI con el tiempo"
                  >
                    <span>{localWeather ? localWeather.icon : '🌤️'}</span>
                    <span className="truncate font-semibold">
                      {localWeather 
                        ? `${localWeather.city}: ${localWeather.temperature}°C`
                        : 'Tiempo Local'}
                    </span>
                    {localWeather?.roadNotice && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" title="Aviso vial activo" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 2. EQUATORIAL CORE: Car Touch Playback Triad & Big Song Title */}
            <div className="flex flex-col items-center text-center w-full px-2 sm:px-4 my-auto">
              {/* Big Song Title (High Contrast for Daytime/Nighttime driving glance) */}
              <h2 
                id="track-title"
                className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight line-clamp-2 max-w-[280px] sm:max-w-[400px] drop-shadow-lg"
                title={currentTrack?.title || 'Sin reproducción'}
              >
                {currentTrack ? currentTrack.title : 'Esfera Terrestre'}
              </h2>

              {/* Artist / Album Name */}
              <p 
                id="track-artist"
                className="text-sm sm:text-base text-cyan-300 font-semibold tracking-wide mt-1.5 truncate max-w-[280px] sm:max-w-[360px]"
              >
                {currentTrack ? currentTrack.artist : 'Google Drive Music'}
              </p>

              {/* High-Visibility Tactile Playback Row (All inside equatorial max-width) */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 mt-4 sm:mt-6 w-full max-w-[330px] sm:max-w-[440px]">
                {/* Shuffle Button */}
                <button
                  id="btn-toggle-shuffle"
                  onClick={handleToggleShuffle}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border-2 shrink-0 ${
                    playerState.isShuffle 
                      ? 'bg-cyan-500/30 text-cyan-200 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-950/70 text-slate-400 border-cyan-500/20 hover:text-white'
                  }`}
                  title={playerState.isShuffle ? 'Aleatorio activado' : 'Aleatorio desactivado'}
                  aria-label="Modo aleatorio"
                >
                  <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Previous Track - Big Car Touch Button */}
                <button
                  id="btn-previous-track"
                  onClick={() => audioEngine.previous()}
                  className="w-12 h-12 sm:w-15 sm:h-15 md:w-16 md:h-16 rounded-full bg-slate-900/80 hover:bg-cyan-950/90 active:scale-90 border-2 border-cyan-400/40 text-cyan-200 flex items-center justify-center shadow-lg transition-all shrink-0"
                  title="Pista anterior"
                  aria-label="Pista anterior"
                >
                  <SkipBack className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>

                {/* Central Play/Pause - Massive Core Button */}
                <button
                  id="btn-play-pause-main"
                  onClick={() => audioEngine.togglePlay()}
                  disabled={playerState.isLoading}
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-cyan-500/40 via-cyan-400/30 to-blue-600/50 hover:from-cyan-400/50 hover:to-blue-500/60 active:scale-95 border-3 border-cyan-300 shadow-[0_0_35px_rgba(6,182,212,0.55)] flex items-center justify-center text-white transition-all cursor-pointer shrink-0"
                  title={playerState.isPlaying ? 'Pausar' : 'Reproducir'}
                  aria-label={playerState.isPlaying ? 'Pausar' : 'Reproducir'}
                >
                  {playerState.isLoading ? (
                    <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-200 animate-spin" />
                  ) : playerState.isPlaying ? (
                    <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-current text-white" />
                  ) : (
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current text-white ml-1" />
                  )}
                </button>

                {/* Next Track - Big Car Touch Button */}
                <button
                  id="btn-next-track"
                  onClick={() => audioEngine.next()}
                  className="w-12 h-12 sm:w-15 sm:h-15 md:w-16 md:h-16 rounded-full bg-slate-900/80 hover:bg-cyan-950/90 active:scale-90 border-2 border-cyan-400/40 text-cyan-200 flex items-center justify-center shadow-lg transition-all shrink-0"
                  title="Siguiente pista"
                  aria-label="Siguiente pista"
                >
                  <SkipForward className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>

                {/* Repeat Button */}
                <button
                  id="btn-toggle-repeat"
                  onClick={handleToggleRepeat}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all active:scale-90 border-2 shrink-0 ${
                    playerState.repeatMode !== 'off' 
                      ? 'bg-cyan-500/30 text-cyan-200 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-950/70 text-slate-400 border-cyan-500/20 hover:text-white'
                  }`}
                  title={`Repetición: ${playerState.repeatMode}`}
                  aria-label="Modo repetición"
                >
                  {playerState.repeatMode === 'one' ? (
                    <Repeat1 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-200" />
                  ) : (
                    <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>

              {/* Time display: 01:24 / 03:45 */}
              <div className="font-mono text-xs sm:text-sm text-cyan-200 font-bold tracking-widest mt-3">
                <span>{formatTime(effectiveTime)}</span>
                <span className="mx-1.5 text-slate-500">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 3. SOUTHERN POLAR REGION: Tactile Volume & In-Sphere Playlist Button (Safely Contained) */}
            <div className="flex flex-col items-center gap-2.5 pb-5 sm:pb-7 md:pb-8 w-full max-w-[270px] sm:max-w-[320px]">
              
              {/* Tactile Volume Control with Step Buttons - Contained Width */}
              <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/85 border border-cyan-500/35 text-sm shadow-md w-full">
                {/* Mute / Unmute Button */}
                <button
                  id="btn-toggle-mute"
                  onClick={() => audioEngine.toggleMute()}
                  className="w-8 h-8 rounded-full bg-cyan-950/60 hover:bg-cyan-900/80 active:scale-90 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all border border-cyan-500/20 shrink-0"
                  title={playerState.isMuted ? 'Activar sonido' : 'Silenciar'}
                >
                  {playerState.isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : playerState.volume > 0.5 ? (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                  ) : (
                    <Volume1 className="w-3.5 h-3.5 text-cyan-300" />
                  )}
                </button>

                {/* Quick Volume Down Step Button */}
                <button
                  id="btn-vol-down"
                  onClick={() => audioEngine.setVolume(Math.max(0, playerState.volume - 0.1))}
                  className="w-8 h-8 rounded-full bg-cyan-950/50 hover:bg-cyan-900/80 active:scale-90 text-cyan-200 flex items-center justify-center border border-cyan-500/30 font-bold shrink-0"
                  title="Bajar volumen"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* Tactile Volume Slider */}
                <input
                  id="input-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={playerState.isMuted ? 0 : playerState.volume}
                  onChange={(e) => audioEngine.setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-2.5 accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer min-w-[50px]"
                  title={`Volumen: ${Math.round((playerState.isMuted ? 0 : playerState.volume) * 100)}%`}
                />

                {/* Quick Volume Up Step Button */}
                <button
                  id="btn-vol-up"
                  onClick={() => audioEngine.setVolume(Math.min(1, playerState.volume + 0.1))}
                  className="w-8 h-8 rounded-full bg-cyan-950/50 hover:bg-cyan-900/80 active:scale-90 text-cyan-200 flex items-center justify-center border border-cyan-500/30 font-bold shrink-0"
                  title="Subir volumen"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <span className="font-mono text-[11px] sm:text-xs font-bold text-cyan-300 w-7 text-right shrink-0">
                  {Math.round((playerState.isMuted ? 0 : playerState.volume) * 100)}%
                </span>
              </div>

              {/* Centered In-Sphere Navigation Buttons - In-car touch friendly */}
              <div className="flex items-center gap-2 max-w-[320px]">
                {user && (
                  <button
                    id="btn-open-in-sphere-mimusica"
                    onClick={() => setInnerView('mimusica_selector')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900 active:scale-95 border-2 border-cyan-400/50 text-cyan-100 text-xs sm:text-sm font-bold transition-all shadow-md min-h-[42px]"
                    title="Explorar /mimusica y subcarpetas"
                  >
                    <Folder className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="truncate">/mimusica</span>
                  </button>
                )}

                <button
                  id="btn-open-in-sphere-playlist"
                  onClick={() => setInnerView('playlist')}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-cyan-950/80 hover:bg-cyan-900 active:scale-95 border-2 border-cyan-400/50 text-cyan-100 text-xs sm:text-sm font-bold transition-all shadow-md min-h-[42px]"
                  title="Ver lista de pistas dentro de la esfera"
                >
                  <Disc className="w-4 h-4 text-cyan-300 animate-spin-slow shrink-0" />
                  <span className="truncate">Pistas ({tracks.length > 0 ? tracks.length : DEMO_TRACKS.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: CIRCULAR IN-SPHERE TRACKLIST (BROWSE SONGS INSIDE THE GLOBE) */}
        {/* ========================================================================= */}
        {innerView === 'playlist' && (
          <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-8 z-20 text-white select-none">
            {/* Top Bar inside Sphere */}
            <div className="flex items-center justify-between pt-2 border-b border-cyan-500/30 pb-3">
              <button
                id="btn-back-to-player-view"
                onClick={() => setInnerView('player')}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-cyan-200 hover:text-white px-3.5 py-2 rounded-full bg-cyan-950/70 border border-cyan-400/40 active:scale-90 transition-all min-h-[42px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <span className="text-xs sm:text-sm font-mono uppercase tracking-wider text-slate-200 font-bold">
                Biblioteca
              </span>

              <button
                id="btn-refresh-tracks"
                onClick={user ? () => loadMimusicaData(true) : handleLoadDemoTracks}
                disabled={isLoadingDrive}
                className="w-10 h-10 flex items-center justify-center text-cyan-300 hover:text-white rounded-full bg-cyan-950/50 border border-cyan-500/30 active:scale-90"
                title="Actualizar canciones de /mimusica"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Search - Car Touch Input */}
            <div className="relative my-2.5">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar canción o artista..."
                className="w-full bg-cyan-950/50 border border-cyan-500/30 rounded-full pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Scrollable Song List strictly fitted inside the circle */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 my-1 max-h-[230px] sm:max-h-[300px] scrollbar-thin scrollbar-thumb-cyan-700">
              {filteredTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Music className="w-10 h-10 text-slate-500 mb-2" />
                  <p className="text-sm text-slate-300 font-medium">No hay canciones disponibles</p>
                  {!user && (
                    <button
                      onClick={handleLoadDemoTracks}
                      className="mt-3 px-4 py-2 rounded-full bg-cyan-600/50 hover:bg-cyan-600 text-xs sm:text-sm text-white font-semibold transition-all"
                    >
                      Cargar canciones de demostración
                    </button>
                  )}
                </div>
              ) : (
                filteredTracks.map((t, idx) => {
                  const isCurrent = currentTrack?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        const originalIndex = playerState.queue.findIndex(item => item.id === t.id);
                        if (originalIndex >= 0) {
                          audioEngine.transitionToTrackIndex(originalIndex);
                        } else {
                          audioEngine.setQueue(filteredTracks, idx, true);
                        }
                        setInnerView('player');
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all min-h-[48px] active:scale-[0.98] ${
                        isCurrent 
                          ? 'bg-cyan-500/30 border-2 border-cyan-400 text-white shadow-md' 
                          : 'hover:bg-cyan-950/50 text-slate-200 border border-cyan-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        {isCurrent && playerState.isPlaying ? (
                          <div className="flex gap-1 items-end h-4 w-4 shrink-0">
                            <span className="w-1 h-full bg-cyan-400 animate-pulse" />
                            <span className="w-1 h-2/3 bg-cyan-300 animate-pulse" />
                            <span className="w-1 h-4/5 bg-cyan-200 animate-pulse" />
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-slate-400 w-5 text-center shrink-0">{idx + 1}</span>
                        )}
                        <div className="truncate">
                          <p className="font-semibold text-xs sm:text-sm truncate">{t.title}</p>
                          <p className="text-[11px] sm:text-xs text-cyan-300/80 truncate">{t.artist}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-slate-400 ml-2 shrink-0">
                        {formatTime(t.duration)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Quick Switch */}
            <div className="pt-2.5 border-t border-cyan-500/30 flex justify-center">
              <button
                onClick={() => setInnerView('player')}
                className="text-xs sm:text-sm text-cyan-300 hover:text-white flex items-center gap-2 py-2 px-4 rounded-full bg-cyan-950/60 border border-cyan-500/30 active:scale-95"
              >
                <Globe className="w-4 h-4" />
                <span>Volver al Reproductor Central</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: GOOGLE DRIVE CONNECTION & FOLDER HUB (INSIDE THE SPHERE) */}
        {/* ========================================================================= */}
        {innerView === 'drive_menu' && (
          <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-8 z-20 text-white">
            {/* Header */}
            <div className="flex items-center justify-between pt-2 border-b border-cyan-500/20 pb-2">
              <button
                onClick={() => setInnerView('player')}
                className="flex items-center gap-1 text-xs text-cyan-300 hover:text-white px-2 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                Google Drive
              </span>
              <div className="w-6" />
            </div>

            {/* Drive Connection Status Content */}
            <div className="flex-1 flex flex-col items-center justify-center text-center p-2 space-y-3">
              <div className="w-14 h-14 rounded-full bg-cyan-500/20 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-md">
                <HardDrive className="w-7 h-7" />
              </div>

              {user ? (
                <>
                  <div>
                    <h3 className="text-base font-bold text-white">{user.name}</h3>
                    <p className="text-xs text-cyan-300 font-mono">{user.email}</p>
                    <p className="text-xs text-emerald-400 mt-1 flex items-center justify-center gap-1 font-medium">
                      <Check className="w-4 h-4" /> Conectado (Solo lectura)
                    </p>
                  </div>

                  <div className="w-full max-w-[260px] space-y-2.5 pt-2">
                    {/* Explore /mimusica Button */}
                    <button
                      onClick={() => setInnerView('mimusica_selector')}
                      disabled={isLoadingDrive}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-full bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-xs sm:text-sm font-bold text-white transition-all shadow-md min-h-[46px]"
                    >
                      <Folder className="w-4 h-4" />
                      <span>Explorar /mimusica</span>
                    </button>

                    {/* Sync /mimusica Button */}
                    <button
                      onClick={() => loadMimusicaData(true)}
                      disabled={isLoadingDrive}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 text-xs sm:text-sm text-cyan-200 transition-all min-h-[44px]"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                      <span>Sincronizar /mimusica</span>
                    </button>

                    {/* Disconnect Button */}
                    <button
                      onClick={async () => {
                        await authService.signOut();
                        setInnerView('player');
                      }}
                      className="w-full text-xs text-rose-400 hover:underline pt-1 py-1"
                    >
                      Cerrar sesión de Drive
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-base font-bold text-white">Google Drive</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-[260px]">
                      Conéctate para reproducir tus canciones desde la carpeta <strong className="text-cyan-300">/mimusica</strong> de tu Drive.
                    </p>
                  </div>

                  <div className="w-full max-w-[260px] space-y-2.5 pt-2">
                    {/* Sign in with Google Button */}
                    <button
                      id="btn-google-drive-login"
                      onClick={handleGoogleSignIn}
                      disabled={isLoadingDrive}
                      className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-full bg-white hover:bg-slate-100 active:scale-95 text-slate-900 text-xs sm:text-sm font-bold shadow-lg transition-transform min-h-[48px]"
                    >
                      {isLoadingDrive ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-800" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.92H1.26v3.15C3.25 21.36 7.35 24 12 24z" />
                          <path fill="#FBBC05" d="M5.32 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.43l4.06-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.25 2.64 1.26 6.57l4.06 3.15c.94-2.82 3.58-4.97 6.68-4.97z" />
                        </svg>
                      )}
                      <span>Iniciar sesión con Google</span>
                    </button>

                    {/* Fallback to Demo Music */}
                    <button
                      onClick={handleLoadDemoTracks}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 text-xs sm:text-sm font-semibold text-cyan-200 transition-colors min-h-[44px]"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Probar pistas de muestra</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Back to Player */}
            <div className="pt-2.5 border-t border-cyan-500/30 flex justify-center">
              <button
                onClick={() => setInnerView('player')}
                className="text-xs sm:text-sm text-cyan-300 hover:text-white flex items-center gap-2 py-2 px-4 rounded-full bg-cyan-950/60 border border-cyan-500/30 active:scale-95"
              >
                <Globe className="w-4 h-4" />
                <span>Volver a la Esfera</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: DIRECTORY /mimusica EXPLORER & SEAMLESS REPLAY SWITCHER */}
        {/* ========================================================================= */}
        {innerView === 'mimusica_selector' && (
          <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-7 md:p-8 z-20 text-white select-none">
            {/* Top Bar inside Sphere */}
            <div className="flex items-center justify-between pt-2 border-b border-cyan-500/30 pb-3">
              <button
                id="btn-back-from-mimusica"
                onClick={() => setInnerView('player')}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-cyan-200 hover:text-white px-3.5 py-2 rounded-full bg-cyan-950/70 border border-cyan-400/40 active:scale-90 transition-all min-h-[42px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <div className="text-center">
                <span className="text-xs sm:text-sm font-mono uppercase tracking-wider text-cyan-300 font-bold block">
                  Directorio /mimusica
                </span>
                <span className="text-[10px] text-slate-400">
                  {activeFolderMode.name}
                </span>
              </div>

              <button
                id="btn-refresh-mimusica"
                onClick={() => loadMimusicaData(true)}
                disabled={isLoadingDrive}
                className="w-10 h-10 flex items-center justify-center text-cyan-300 hover:text-white rounded-full bg-cyan-950/50 border border-cyan-500/30 active:scale-90"
                title="Sincronizar /mimusica"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Main Content inside Sphere */}
            <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1 scrollbar-thin scrollbar-thumb-cyan-500/40">
              {isLoadingDrive ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-cyan-300">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs text-center font-mono">{syncStatusText || 'Leyendo /mimusica...'}</p>
                </div>
              ) : mimusicaNotFound ? (
                <div className="flex flex-col items-center justify-center text-center p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <h4 className="text-sm font-bold text-amber-200">Carpeta /mimusica no encontrada</h4>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-[280px]">
                    Crea una carpeta llamada <span className="font-mono text-cyan-300 font-bold">mimusica</span> en tu Google Drive y sube dentro tus canciones o subcarpetas (ej: Rock, Pop, etc.).
                  </p>
                  <button
                    onClick={() => loadMimusicaData(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md min-h-[44px]"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Ya la he creado, comprobar</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Mode 1: Play All Songs in /mimusica Card */}
                  <div className={`p-3.5 rounded-2xl border transition-all ${
                    activeFolderMode.type === 'all'
                      ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-cyan-950/40 border-cyan-500/30 hover:bg-cyan-950/60'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-cyan-400" />
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white">Toda la carpeta /mimusica</h4>
                          <p className="text-[11px] text-cyan-300/80">
                            {mimusicaStructure?.allTracks.length || 0} canciones en total
                          </p>
                        </div>
                      </div>
                      {activeFolderMode.type === 'all' && (
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/50">
                          En reproducción
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSelectPlayAll(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-xs font-bold text-white transition-all min-h-[44px]"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Reproducir Todo</span>
                      </button>
                      <button
                        onClick={() => handleSelectPlayAll(true)}
                        className="flex items-center justify-center gap-1 py-2 px-3.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900 active:scale-95 border border-cyan-400/40 text-xs font-semibold text-cyan-200 transition-all min-h-[44px]"
                        title="Reproducir en orden aleatorio"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Aleatorio</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode 2: Select Specific Subfolder */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                        Subcarpetas de /mimusica ({mimusicaStructure?.subfolders.length || 0})
                      </span>
                    </div>

                    {(!mimusicaStructure || mimusicaStructure.subfolders.length === 0) ? (
                      <div className="text-center py-6 px-4 bg-cyan-950/20 rounded-xl border border-cyan-500/20">
                        <p className="text-xs text-slate-300">
                          No tienes subcarpetas dentro de /mimusica.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Puedes organizar tu música en carpetas (ej. /mimusica/Rock, /mimusica/Viajes) desde Google Drive y aparecerán aquí automáticamente.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {mimusicaStructure.subfolders.map((item) => {
                          const isCurrent = activeFolderMode.type === 'subfolder' && activeFolderMode.folderId === item.folder.id;
                          return (
                            <button
                              key={item.folder.id}
                              onClick={() => handleSelectSubfolder(item.folder)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.98] min-h-[50px] ${
                                isCurrent
                                  ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] text-white'
                                  : 'bg-cyan-950/40 border-cyan-500/30 hover:bg-cyan-900/50 text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <FolderOpen className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-cyan-300' : 'text-cyan-400/70'}`} />
                                <div className="truncate">
                                  <p className="text-xs sm:text-sm font-semibold truncate">
                                    {item.folder.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    {item.trackCount} {item.trackCount === 1 ? 'canción' : 'canciones'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {isCurrent ? (
                                  <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-cyan-300 bg-cyan-400/20 px-2 py-0.5 rounded-full border border-cyan-400/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                    Activa
                                  </span>
                                ) : (
                                  <Play className="w-3.5 h-3.5 text-cyan-400 opacity-60" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Bottom Bar: Quick Back */}
            <div className="pt-2 border-t border-cyan-500/30 flex justify-center">
              <button
                onClick={() => setInnerView('player')}
                className="text-xs sm:text-sm text-cyan-300 hover:text-white flex items-center gap-2 py-2 px-5 rounded-full bg-cyan-950/60 border border-cyan-500/30 active:scale-95 min-h-[40px]"
              >
                <Globe className="w-4 h-4" />
                <span>Volver al Reproductor</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
