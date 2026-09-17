import React, { useEffect, useState } from 'react';
import { SyncProgressState } from '../types';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Folder, 
  Music, 
  X, 
  Check, 
  Sparkles,
  HardDrive
} from 'lucide-react';

interface SyncProgressModalProps {
  isOpen: boolean;
  syncState: SyncProgressState;
  onClose: () => void;
  onExploreMimusica?: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isOpen,
  syncState,
  onClose,
  onExploreMimusica
}) => {
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);

  // Auto-close after 8 seconds on completion
  useEffect(() => {
    let timer: any = null;
    let interval: any = null;

    if (isOpen && syncState.stage === 'completed') {
      setAutoCloseCountdown(8);
      interval = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev === null || prev <= 1) return null;
          return prev - 1;
        });
      }, 1000);

      timer = setTimeout(() => {
        onClose();
      }, 8000);
    } else {
      setAutoCloseCountdown(null);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [isOpen, syncState.stage, onClose]);

  if (!isOpen) return null;

  const isCompleted = syncState.stage === 'completed' || (!syncState.isSyncing && !!syncState.completedSummary);
  const isError = syncState.stage === 'error' || (!syncState.isSyncing && !!syncState.error);
  const isSyncing = syncState.isSyncing;

  // Human-readable stage title
  const getStageTitle = () => {
    switch (syncState.stage) {
      case 'searching_folder':
        return 'Paso 1/4: Conectando con /mimusica';
      case 'discovering_subfolders':
        return 'Paso 2/4: Explorando álbumes y subcarpetas';
      case 'scanning_files':
        return 'Paso 3/4: Buscando canciones en Drive';
      case 'processing_tracks':
        return 'Paso 4/4: Procesando canciones y carátulas';
      case 'saving_local':
        return 'Finalizando: Guardando en memoria local';
      case 'completed':
        return '¡Sincronización terminada!';
      case 'error':
        return 'Incidencia en la sincronización';
      default:
        return 'Sincronizando biblioteca';
    }
  };

  return (
    <div 
      id="sync-progress-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSyncing) {
          onClose();
        }
      }}
    >
      <div 
        id="sync-progress-modal-card"
        className="relative w-full max-w-md bg-gradient-to-b from-[#0a1626] via-[#06101c] to-[#030812] border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.3)] text-white overflow-hidden select-none"
      >
        {/* Glow ambient background rings */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close button (only when finished or error) */}
        {!isSyncing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-10"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* CASE 1: ACTIVE SYNCHRONIZATION IN PROGRESS                                */}
        {/* ------------------------------------------------------------------------- */}
        {isSyncing && (
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Pulsing Sync Badge */}
            <div className="relative w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.4)]">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <div className="absolute inset-0 rounded-full border border-cyan-400 animate-ping opacity-30" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-[11px] font-mono text-cyan-300 font-bold uppercase tracking-wider mb-2">
                {getStageTitle()}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Sincronizando con Google Drive
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-[320px] mx-auto leading-relaxed">
                {syncState.step || 'Cargando pistas de audio desde /mimusica...'}
              </p>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="w-full space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-mono px-1">
                <span className="text-cyan-300/80 flex items-center gap-1.5 font-semibold">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  Progreso total
                </span>
                <span className="text-base font-extrabold text-cyan-200">
                  {syncState.percent}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-3.5 bg-slate-950/90 rounded-full border border-cyan-500/30 overflow-hidden relative p-0.5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(6,182,212,0.7)] relative overflow-hidden"
                  style={{ width: `${Math.max(4, Math.min(100, syncState.percent))}%` }}
                >
                  {/* Shimmer sweep animation */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite] w-full" />
                </div>
              </div>
            </div>

            {/* Detailed File Counter Card */}
            <div className="w-full bg-slate-900/70 border border-cyan-500/25 rounded-2xl p-3.5 text-left space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                  <Music className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    {syncState.totalFiles > 0 ? (
                      <>
                        Canción <strong className="text-white font-bold">{syncState.currentFile}</strong> de <strong className="text-cyan-200 font-bold">{syncState.totalFiles}</strong>
                      </>
                    ) : syncState.currentFile > 0 ? (
                      <>
                        Detectadas <strong className="text-white font-bold">{syncState.currentFile}</strong> pistas
                      </>
                    ) : (
                      'Buscando archivos de audio...'
                    )}
                  </span>
                </div>

                {syncState.totalFiles > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold">
                    {Math.round((syncState.currentFile / syncState.totalFiles) * 100)}%
                  </span>
                )}
              </div>

              {/* Current File Name Preview */}
              {syncState.currentFileName && (
                <div className="text-[11px] font-mono text-slate-300 truncate bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-cyan-400 font-semibold mr-1">Actual:</span>
                  <span title={syncState.currentFileName}>{syncState.currentFileName}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 font-mono italic">
              Por favor, espera unos instantes mientras se optimiza la caché de reproducción...
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* CASE 2: SYNCHRONIZATION COMPLETED (CLEAR PROMINENT NOTICE)                */}
        {/* ------------------------------------------------------------------------- */}
        {isCompleted && (
          <div className="flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200">
            {/* Green Success Badge */}
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/80 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]">
              <CheckCircle2 className="w-9 h-9" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/50 text-[11px] font-mono text-emerald-300 font-bold uppercase tracking-wider mb-2">
                ✓ Sincronización Finalizada
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                ¡Biblioteca lista para reproducir!
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 max-w-[320px] mx-auto leading-relaxed">
                Todas tus pistas han sido indexadas correctamente desde tu Google Drive. Ya puedes disfrutarlas en tu reproductor.
              </p>
            </div>

            {/* Statistics Summary Cards */}
            <div className="w-full grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-3 flex flex-col items-center">
                <Music className="w-5 h-5 text-emerald-400 mb-1" />
                <span className="text-xl font-extrabold text-white">
                  {syncState.completedSummary?.totalTracks ?? syncState.totalFiles ?? syncState.currentFile ?? 0}
                </span>
                <span className="text-[11px] font-mono text-slate-400">Canciones</span>
              </div>

              <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-3 flex flex-col items-center">
                <Folder className="w-5 h-5 text-cyan-400 mb-1" />
                <span className="text-xl font-extrabold text-white">
                  {syncState.completedSummary?.totalFolders ?? 0}
                </span>
                <span className="text-[11px] font-mono text-slate-400">Álbumes / Carpetas</span>
              </div>
            </div>

            {/* Auto-close notification */}
            {autoCloseCountdown !== null && (
              <p className="text-[11px] font-mono text-slate-400">
                Esta ventana se cerrará automáticamente en {autoCloseCountdown}s
              </p>
            )}

            {/* Action Buttons */}
            <div className="w-full space-y-2 pt-2">
              <button
                id="btn-sync-modal-done"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all min-h-[46px]"
              >
                <Check className="w-4 h-4" />
                <span>Entendido, ¡a escuchar música!</span>
              </button>

              {onExploreMimusica && (
                <button
                  onClick={() => {
                    onClose();
                    onExploreMimusica();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 text-xs sm:text-sm font-semibold text-cyan-200 transition-colors min-h-[42px]"
                >
                  <Folder className="w-4 h-4 text-cyan-400" />
                  <span>Explorar carpetas de /mimusica</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* CASE 3: ERROR / WARNING NOTICE                                            */}
        {/* ------------------------------------------------------------------------- */}
        {isError && (
          <div className="flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400/80 flex items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.4)]">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-rose-950/80 border border-rose-400/50 text-[11px] font-mono text-rose-300 font-bold uppercase tracking-wider mb-2">
                Aviso de Sincronización
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                No se pudo completar la sincronización
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 max-w-[320px] mx-auto leading-relaxed">
                {syncState.error || syncState.step || 'Ha ocurrido un error inesperado al conectar con Google Drive.'}
              </p>
            </div>

            <div className="w-full pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-sm font-bold shadow-md transition-all min-h-[46px]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
