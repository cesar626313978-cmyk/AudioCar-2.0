import React, { useState, useEffect } from 'react';
import { cloudService } from '../services/cloudService';
import { googleDriveProvider } from '../services/providers/GoogleDriveProvider';
import { driveService } from '../services/driveService';
import { CloudProviderType, CloudUserSession } from '../types';
import { 
  X, 
  Cloud, 
  Check, 
  Sparkles, 
  FolderOpen, 
  AlertCircle, 
  RotateCw, 
  CheckCircle2, 
  Info,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Music,
  ExternalLink
} from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [activeProviderId, setActiveProviderId] = useState<CloudProviderType>(cloudService.getActiveProviderId());
  const [sessions, setSessions] = useState<Record<CloudProviderType, CloudUserSession | null>>(cloudService.getAllSessions());
  const [loadingProvider, setLoadingProvider] = useState<CloudProviderType | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressPercent, setSyncProgressPercent] = useState<number>(0);
  const [syncProgressStep, setSyncProgressStep] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'drive' | 'guide'>('drive');
  const [linkedFolderName, setLinkedFolderName] = useState<string>(
    driveService.getSelectedMusicFolder()?.name || 'mimusica'
  );

  const refreshSessions = () => {
    setSessions(cloudService.getAllSessions());
    setActiveProviderId(cloudService.getActiveProviderId());
    setLinkedFolderName(driveService.getSelectedMusicFolder()?.name || 'mimusica');
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const handlePickFolder = async () => {
    setErrorMessage(null);
    try {
      const folder = await driveService.promptPickMusicFolder();
      if (folder) {
        setLinkedFolderName(folder.name);
        setIsSyncing(true);
        setSyncProgressPercent(15);
        setSyncProgressStep(`Sincronizando carpeta /${folder.name}...`);
        const res = await cloudService.syncLibrary('drive', (p) => {
          setSyncProgressPercent(p.percent);
          setSyncProgressStep(p.step);
        });
        setSyncProgressPercent(100);
        setSyncStatus(`¡Carpeta vinculada con éxito! ${res.tracks.length} canciones sincronizadas.`);
        onSuccess();
      }
    } catch (err: any) {
      console.warn('[AuthModal] Error al seleccionar carpeta con Google Picker:', err);
      setErrorMessage(err.message || 'No se pudo seleccionar la carpeta con Google Picker.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncStatus(null);
        setSyncProgressPercent(0);
        setSyncProgressStep('');
      }, 4000);
    }
  };

  const handleConnectGoogle = async () => {
    setLoadingProvider('drive');
    setErrorMessage(null);
    setSyncProgressPercent(10);
    setSyncProgressStep('Conectando con Google...');
    try {
      await googleDriveProvider.login();
      refreshSessions();
      cloudService.setActiveProvider('drive');
      setActiveProviderId('drive');
      setIsSyncing(true);
      const res = await cloudService.syncLibrary('drive', (p) => {
        setSyncProgressPercent(p.percent);
        setSyncProgressStep(p.step);
      });
      setSyncProgressPercent(100);
      setSyncStatus(`¡Sincronización completada! ${res.tracks.length} canciones encontradas.`);
      // We don't trigger another manual sync notice here as the modal is already open
    } catch (err: any) {
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.toLowerCase().includes('cancelad') ||
        err?.message?.toLowerCase().includes('cerrad') ||
        err?.message?.toLowerCase().includes('popup');

      if (isCancelled) {
        console.warn('[AuthModal] Google Sign-in cancelled by user:', err?.message || 'Popup closed');
        setErrorMessage('Inicio de sesión cancelado. Puedes volver a intentarlo cuando desees.');
      } else {
        console.warn('[AuthModal] Google Sign-in error:', err);
        setErrorMessage(err?.message || 'Error al conectar con Google Drive. Revisa los permisos en la ventana emergente.');
      }
    } finally {
      setLoadingProvider(null);
      setIsSyncing(false);
      setTimeout(() => {
        setSyncStatus(null);
        setSyncProgressPercent(0);
        setSyncProgressStep('');
      }, 4000);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncProgressPercent(10);
    setSyncProgressStep('Iniciando sincronización...');
    setErrorMessage(null);
    setSyncStatus(null);
    try {
      const res = await cloudService.syncLibrary('drive', (p) => {
        setSyncProgressPercent(p.percent);
        setSyncProgressStep(p.step);
      });
      setSyncProgressPercent(100);
      setSyncStatus(`¡Listo! ${res.tracks.length} pistas actualizadas.`);
      onSuccess();
    } catch (err: any) {
      console.warn('[AuthModal] Sync error:', err);
      setErrorMessage(err.message || 'Error al sincronizar con Google Drive.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncStatus(null);
        setSyncProgressPercent(0);
        setSyncProgressStep('');
      }, 4000);
    }
  };

  const handleSelectDemo = async () => {
    cloudService.setActiveProvider('demo');
    setActiveProviderId('demo');
    onSuccess();
  };

  const handleDisconnect = async () => {
    setLoadingProvider('drive');
    try {
      await cloudService.logoutProvider('drive');
      refreshSessions();
      onSuccess();
    } catch (err) {
      console.warn('[AuthModal] Disconnect error:', err);
    } finally {
      setLoadingProvider(null);
    }
  };

  const driveSession = sessions.drive;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto select-none animate-in fade-in duration-200">
      <div className="bg-[#0c0c0c] border border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-white relative flex flex-col max-h-[94vh]">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-neutral-800/80 flex items-center justify-between bg-gradient-to-b from-neutral-900/90 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg">
              <Cloud className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Google Drive Cloud Music</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Transmisión directa y segura desde tu cuenta personal de Google Drive
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="hitbox-48 w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/80 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 px-4 sm:px-6 pt-3 gap-2 bg-[#080808]">
          <button
            onClick={() => setActiveTab('drive')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'drive'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Conexión Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Guía Carpeta /mimusica</span>
          </button>
        </div>

        {/* Tab 1: Google Drive Connection */}
        {activeTab === 'drive' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
            
            {/* Direct Information Tip */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-300 leading-relaxed">
                AudioCar lee tus archivos de audio desde la carpeta <strong className="text-white font-mono bg-black/60 px-1.5 py-0.5 rounded border border-neutral-700">/mimusica</strong> en Google Drive. No transfiere ni comparte tus archivos a ningún servidor externo.
              </p>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-2xl text-xs text-red-200 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>Aviso de conexión</span>
                </div>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Sync Feedback Alert */}
            {syncStatus && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-700/60 rounded-2xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{syncStatus}</span>
              </div>
            )}

            {/* Google Drive Main Card */}
            <div className={`p-4 sm:p-5 rounded-3xl border transition-all overflow-hidden ${
              driveSession
                ? 'bg-neutral-900/95 border-neutral-700 ring-1 ring-neutral-700/60 shadow-xl'
                : 'bg-[#121212] border-neutral-800 hover:border-neutral-700'
            }`}>
              {driveSession ? (
                <div className="space-y-3.5">
                  {/* Top identity bar & disconnect action */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black/90 border border-neutral-800 flex items-center justify-center shrink-0 p-2.5 shadow-md">
                        <svg className="w-full h-full" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm sm:text-base text-white">Google Drive</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Conectado
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate mt-0.5" title={driveSession.email}>
                          {driveSession.email}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      disabled={loadingProvider === 'drive' || isSyncing}
                      title="Cerrar sesión de Google Drive"
                      className="hitbox-48 h-9 px-3 rounded-xl bg-neutral-800/90 hover:bg-red-950/80 text-neutral-400 hover:text-red-300 border border-neutral-700/70 hover:border-red-800 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0 gap-1.5 text-xs font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Desconectar</span>
                    </button>
                  </div>

                  {/* Linked Folder Status & Google Picker Button */}
                  <div className="p-3.5 rounded-2xl bg-black/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] text-neutral-400 block font-medium">Carpeta de música en Drive:</span>
                        <span className="text-xs sm:text-sm font-bold text-white truncate block font-mono">
                          /{linkedFolderName}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handlePickFolder}
                      disabled={isSyncing}
                      className="hitbox-48 h-9 px-3.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      title="Seleccionar otra carpeta en Google Drive usando Google Picker"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Elegir con Google Picker</span>
                    </button>
                  </div>

                  {/* Real-time Progress Bar when syncing */}
                  {isSyncing && (
                    <div className="p-3 rounded-2xl bg-black/60 border border-neutral-800 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                        <span className="flex items-center gap-2 min-w-0">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                          <span className="truncate">{syncProgressStep || 'Sincronizando biblioteca...'}</span>
                        </span>
                        <span className="text-amber-400 font-mono font-bold shrink-0 ml-2">{syncProgressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-800/80 overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${Math.max(8, syncProgressPercent)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons: Sincronizar & Cambiar cuenta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="hitbox-48 h-11 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 whitespace-nowrap w-full"
                    >
                      <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span className="whitespace-nowrap">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>

                    <button
                      onClick={handleConnectGoogle}
                      disabled={loadingProvider === 'drive' || isSyncing}
                      title="Cambiar a otra cuenta de Google/Gmail"
                      className="hitbox-48 h-11 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap w-full"
                    >
                      <Cloud className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="whitespace-nowrap">Cambiar cuenta</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black/90 border border-neutral-800 flex items-center justify-center shrink-0 p-2.5 shadow-md">
                      <svg className="w-full h-full" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-white">Google Drive</span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        Acceso seguro a tu biblioteca de audio
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleConnectGoogle}
                    disabled={loadingProvider === 'drive'}
                    className="hitbox-48 h-10 sm:h-11 px-4 sm:px-5 rounded-2xl bg-white hover:bg-neutral-200 active:scale-95 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {loadingProvider === 'drive' ? (
                      <RotateCw className="w-4 h-4 animate-spin text-black shrink-0" />
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 text-neutral-800 shrink-0" />
                        <span className="whitespace-nowrap">Elegir cuenta</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Demo Mode fallback banner */}
            <div className={`p-4 rounded-2xl border transition-all overflow-hidden ${
              activeProviderId === 'demo'
                ? 'bg-neutral-900 border-amber-400/40 ring-1 ring-amber-400/20 shadow-lg'
                : 'bg-[#111111] border-neutral-800 hover:border-neutral-700'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Modo Demo Local</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                        Offline
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      6 canciones de prueba para probar ecualizador y visualizadores
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSelectDemo}
                  className={`hitbox-48 h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    activeProviderId === 'demo'
                      ? 'bg-amber-400 text-black font-extrabold shadow-sm'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  }`}
                >
                  {activeProviderId === 'demo' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      <span>Activo</span>
                    </>
                  ) : (
                    <span>Probar</span>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Google Drive Structure Guide */}
        {activeTab === 'guide' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-neutral-300 custom-scrollbar flex-1">
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>Estructura Recomendada en tu Google Drive</span>
              </h3>
              
              <p className="text-neutral-400 text-xs leading-relaxed">
                Crea una carpeta llamada <strong className="text-white">mimusica</strong> en la raíz de tu Google Drive. AudioCar indexará automáticamente todos los archivos de audio y las carátulas.
              </p>

              <div className="bg-black/90 p-4 rounded-2xl border border-neutral-800 font-mono text-[11px] space-y-1.5 text-neutral-300 leading-relaxed">
                <div className="text-amber-300 font-bold">📁 Raíz de Google Drive (Mi Unidad)</div>
                <div className="pl-4 text-white font-bold">└── 📁 mimusica <span className="text-emerald-400 font-normal">← (Carpeta principal)</span></div>
                <div className="pl-8 text-neutral-300">├── 📁 Queen - A Night at the Opera</div>
                <div className="pl-12 text-neutral-400">├── 🎵 Bohemian Rhapsody.mp3</div>
                <div className="pl-12 text-purple-400">└── 🖼️ cover.jpg <span className="text-neutral-500">(Carátula del álbum)</span></div>
                <div className="pl-8 text-neutral-300">├── 📁 Daft Punk - Discovery</div>
                <div className="pl-12 text-neutral-400">├── 🎵 One More Time.flac</div>
                <div className="pl-12 text-neutral-400">└── 🎵 Harder Better Faster.mp3</div>
                <div className="pl-8 text-neutral-300">└── 🎵 Cancion_Suelta.m4a</div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-white">Formatos Compatibles:</h4>
              <ul className="grid grid-cols-2 gap-2 text-neutral-400 text-[11px]">
                <li className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                  <strong className="text-white">Audio:</strong> MP3, FLAC, M4A, AAC, WAV, OGG, OPUS, WEBM
                </li>
                <li className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                  <strong className="text-white">Carátulas:</strong> JPG, PNG, WEBP, GIF
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveTab('drive')}
                className="hitbox-48 w-full h-11 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Volver a Conexión Google Drive</span>
              </button>
            </div>
          </div>
        )}

        {/* Fixed Bottom Save / Action Bar */}
        <div className="p-4 sm:p-5 border-t border-neutral-800/90 bg-neutral-950/95 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate text-[11px] sm:text-xs">Conexión oficial directa con Google Drive API v3</span>
          </div>

          <button
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="hitbox-56 px-6 sm:px-7 py-2.5 rounded-2xl bg-white hover:bg-neutral-200 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-white/20 shrink-0"
          >
            <Check className="w-4 h-4 text-black stroke-[3]" />
            <span>Aceptar</span>
          </button>
        </div>

      </div>
    </div>
  );
};
