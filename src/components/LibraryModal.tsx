import React, { useState } from 'react';
import { AudioTrack, DriveFolder } from '../types';
import { LibraryView } from './LibraryView';
import { DriveFolderExplorer } from './DriveFolderExplorer';
import { audioEngine } from '../services/audioEngine';
import { X, Check, Disc3, FolderTree, Library, Play } from 'lucide-react';

interface LibraryModalProps {
  tracks: AudioTrack[];
  folders: DriveFolder[];
  currentTrackId?: string;
  onRefreshDrive: () => Promise<void>;
  isLoading: boolean;
  isSyncing?: boolean;
  syncPercent?: number;
  syncStep?: string;
  onDeleteDemoTracks?: () => void;
  onRestoreDemoTracks?: () => void;
  onDeleteTrack?: (trackId: string) => void;
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  tracks,
  folders,
  currentTrackId,
  onRefreshDrive,
  isLoading,
  isSyncing = false,
  syncPercent = 0,
  syncStep = '',
  onDeleteDemoTracks,
  onRestoreDemoTracks,
  onDeleteTrack,
  onClose
}) => {
  const [subView, setSubView] = useState<'library' | 'folders'>('library');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [activeFolderTracks, setActiveFolderTracks] = useState<AudioTrack[]>([]);
  const [activeFolderName, setActiveFolderName] = useState<string>('');

  const handleSaveAndClose = () => {
    // If a folder has loaded tracks, play the entire folder immediately
    if (activeFolderTracks && activeFolderTracks.length > 0) {
      audioEngine.setQueue(activeFolderTracks, 0, true);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Top Header for Library Overlay */}
      <div className="h-16 px-4 md:px-8 bg-neutral-950/95 border-b border-neutral-800 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
            <Library className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Biblioteca de Música</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                {tracks.length} pistas
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Explora canciones, carpetas y listas de reproducción
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Sub-navigation */}
          <div className="flex items-center bg-neutral-900 rounded-full p-1 border border-neutral-800">
            <button
              onClick={() => {
                setSelectedFolderId(undefined);
                setActiveFolderTracks([]);
                setActiveFolderName('');
                setSubView('library');
              }}
              className={`hitbox-48 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                subView === 'library'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Biblioteca
            </button>
            <button
              onClick={() => {
                setSelectedFolderId(undefined);
                setSubView('folders');
              }}
              className={`hitbox-48 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                subView === 'folders'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Carpetas</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="hitbox-48 w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-colors flex items-center justify-center cursor-pointer"
            title="Cerrar Biblioteca y volver al reproductor"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Real-time Cloud Sync Progress Bar (if actively importing/syncing) */}
      {isSyncing && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 truncate">
                  {syncStep || 'Importando canciones de Google Drive (/mimusica)...'}
                </span>
                <span className="text-xs font-mono font-black text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-500/40 shrink-0">
                  {syncPercent}%
                </span>
              </div>
              <div className="w-48 sm:w-80 max-w-full bg-neutral-900 rounded-full h-1.5 mt-1 overflow-hidden border border-neutral-800">
                <div 
                  className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-200 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(6, syncPercent)}%` }}
                />
              </div>
            </div>
          </div>
          <span className="text-[11px] text-amber-300/80 font-medium hidden sm:inline shrink-0">
            Buscando audio y carátulas...
          </span>
        </div>
      )}

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4">
        {subView === 'folders' ? (
          <DriveFolderExplorer
            allTracks={tracks}
            onRefreshDrive={onRefreshDrive}
            isLoading={isLoading}
            onBackToLibrary={() => {
              setSelectedFolderId(undefined);
              setActiveFolderTracks([]);
              setActiveFolderName('');
              setSubView('library');
            }}
            initialFolderId={selectedFolderId}
            onActiveFolderTracksChange={(folderTracks, folderName) => {
              setActiveFolderTracks(folderTracks);
              setActiveFolderName(folderName);
            }}
          />
        ) : (
          <LibraryView
            tracks={tracks}
            folders={folders}
            currentTrackId={currentTrackId}
            onRefreshDrive={onRefreshDrive}
            isLoading={isLoading}
            onSelectFolder={(folderId?: string) => {
              setSelectedFolderId(folderId);
              setSubView('folders');
            }}
            onDeleteDemoTracks={onDeleteDemoTracks}
            onRestoreDemoTracks={onRestoreDemoTracks}
            onDeleteTrack={onDeleteTrack}
            initialTab="folders"
          />
        )}
      </div>

      {/* Bottom Sticky Action / Save Bar */}
      <div className="p-4 md:px-8 bg-neutral-950/95 border-t border-neutral-800 flex items-center justify-between shrink-0 z-10 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-neutral-400 truncate pr-2">
          <Disc3 className="w-4 h-4 text-neutral-500 animate-spin [animation-duration:8s] shrink-0" />
          {activeFolderTracks.length > 0 ? (
            <span className="truncate text-white font-medium">
              Carpeta activa: <span className="text-amber-400 font-bold">{activeFolderName || 'Seleccionada'}</span> ({activeFolderTracks.length} canciones listas para reproducir)
            </span>
          ) : (
            <>
              <span className="hidden sm:inline">Selecciona una pista o carpeta para reproducirla al instante en el coche.</span>
              <span className="sm:hidden">{tracks.length} canciones disponibles</span>
            </>
          )}
        </div>

        <button
          onClick={handleSaveAndClose}
          className="hitbox-56 px-7 sm:px-8 py-3 rounded-2xl bg-white hover:bg-neutral-200 active:scale-95 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-white/20 shrink-0"
          title={activeFolderTracks.length > 0 ? `Reproducir las ${activeFolderTracks.length} canciones de la carpeta y volver al reproductor` : 'Guardar y cerrar'}
        >
          {activeFolderTracks.length > 0 ? (
            <>
              <Play className="w-4 h-4 fill-black text-black" />
              <span>Guardar y Reproducir ({activeFolderTracks.length})</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-black stroke-[3]" />
              <span>Guardar y Cerrar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
