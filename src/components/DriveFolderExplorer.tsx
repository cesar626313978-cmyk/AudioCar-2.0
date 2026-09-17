/**
 * Google Drive Folder Explorer Component - AudioCar
 * Features:
 * - Scoped exclusively to the root folder "mimusica" and its subdirectories
 * - Breadcrumb navigation starting at "mimusica"
 * - Large touch targets for folder navigation
 * - Direct folder audio playback (Play entire folder)
 * - Companion album artwork previews (JPG, PNG, GIF, WEBP)
 */

import React, { useState, useEffect } from 'react';
import { AudioTrack, DriveFolder } from '../types';
import { driveService, MUSIC_ROOT_FOLDER_NAME } from '../services/driveService';
import { audioEngine } from '../services/audioEngine';
import { AlbumArtwork } from './AlbumArtwork';
import { FolderCard } from './FolderCard';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  Play, 
  Shuffle,
  Music2, 
  ArrowLeft, 
  RefreshCw,
  FolderLock
} from 'lucide-react';

interface DriveFolderExplorerProps {
  allTracks: AudioTrack[];
  onRefreshDrive: () => Promise<void>;
  isLoading: boolean;
  onBackToLibrary: () => void;
  initialFolderId?: string;
  onActiveFolderTracksChange?: (tracks: AudioTrack[], folderName: string) => void;
}

export const DriveFolderExplorer: React.FC<DriveFolderExplorerProps> = ({
  allTracks,
  isLoading,
  onBackToLibrary,
  onRefreshDrive,
  initialFolderId,
  onActiveFolderTracksChange
}) => {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>(initialFolderId || 'root');
  const [rootFolder, setRootFolder] = useState<DriveFolder | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: MUSIC_ROOT_FOLDER_NAME }
  ]);
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(
    audioEngine.getState().isPlaying ? audioEngine.getCurrentTrack()?.id || null : null
  );

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((st) => {
      setPlayingTrackId(st.isPlaying ? audioEngine.getCurrentTrack()?.id || null : null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initialFolderId && initialFolderId !== 'root' && initialFolderId !== 'root_all') {
      loadSpecificFolder(initialFolderId);
    } else {
      initRootFolderAndLoad();
    }
  }, [initialFolderId]);

  const loadSpecificFolder = async (folderId: string) => {
    setIsFetchingFolders(true);
    try {
      const root = await driveService.getMusicRootFolder(false);
      if (root) {
        setRootFolder(root);
      }

      const rootId = root ? root.id : 'root';
      const rootName = root ? root.name : MUSIC_ROOT_FOLDER_NAME;

      // Find folder name from tracks or parent lookup
      const matchingTrack = allTracks.find((t) => t.folderId === folderId);
      let targetFolderName = matchingTrack?.album || matchingTrack?.folderPath?.split('/').pop() || 'Subcarpeta';

      const subfolders = await driveService.listFolders(folderId);
      setFolders(subfolders);

      setFolderPath([
        { id: rootId, name: rootName },
        { id: folderId, name: targetFolderName }
      ]);
      setCurrentFolderId(folderId);
    } catch (e) {
      console.warn('Could not load specific folder:', e);
      initRootFolderAndLoad();
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const initRootFolderAndLoad = async () => {
    setIsFetchingFolders(true);
    try {
      const root = await driveService.getMusicRootFolder(false);
      if (root) {
        setRootFolder(root);
        setFolderPath([{ id: root.id, name: root.name }]);
        setCurrentFolderId(root.id);
        const result = await driveService.listFolders(root.id);
        setFolders(result);
      } else {
        setRootFolder(null);
        setFolderPath([{ id: 'root', name: MUSIC_ROOT_FOLDER_NAME }]);
        setCurrentFolderId('root');
        setFolders([]);
      }
    } catch (e) {
      console.warn('Could not load root folders:', e);
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      setIsFetchingFolders(true);
      const folder = await driveService.promptPickMusicFolder();
      if (folder) {
        setRootFolder(folder);
        setFolderPath([{ id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
        const result = await driveService.listFolders(folder.id);
        setFolders(result);
        await onRefreshDrive();
      }
    } catch (err) {
      console.warn('Could not pick folder with Google Picker:', err);
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const loadSubfolders = async (targetId: string) => {
    setIsFetchingFolders(true);
    try {
      const result = await driveService.listFolders(targetId);
      setFolders(result);
    } catch (e) {
      console.warn('Could not load subfolders:', e);
      setFolders([]);
    } finally {
      setIsFetchingFolders(false);
    }
  };

  const handleEnterFolder = async (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => {
      // Avoid duplicate appends if already in path
      const exists = prev.some((p) => p.id === folder.id);
      if (exists) return prev;
      return [...prev, { id: folder.id, name: folder.name }];
    });
    await loadSubfolders(folder.id);
  };

  const handleNavigateBreadcrumb = async (index: number) => {
    const target = folderPath[index];
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(target.id);

    if (index === 0 || target.id === 'root' || (rootFolder && target.id === rootFolder.id)) {
      await initRootFolderAndLoad();
    } else {
      await loadSubfolders(target.id);
    }
  };

  // Determine tracks in current view
  const isAtRoot = currentFolderId === 'root' || (rootFolder && currentFolderId === rootFolder.id);

  const currentFolderTracks = allTracks.filter((t) => {
    if (t.source !== 'drive') return false;
    if (isAtRoot) {
      // Only tracks strictly located at root (not inside subfolders)
      return t.folderId === currentFolderId || t.folderPath === `/${MUSIC_ROOT_FOLDER_NAME}` || t.album === 'mimusica';
    }
    // Match by folder ID or folder path or album name
    const currentFolderObj = folderPath[folderPath.length - 1];
    const targetNameLower = currentFolderObj?.name?.toLowerCase() || '';
    const matchId = t.folderId === currentFolderId;
    const matchName =
      Boolean(targetNameLower) &&
      (t.album?.toLowerCase() === targetNameLower ||
        t.folderPath?.toLowerCase().endsWith('/' + targetNameLower) ||
        t.folderPath?.toLowerCase().endsWith(targetNameLower));
    return matchId || matchName;
  });

  const currentFolderName = folderPath[folderPath.length - 1]?.name || MUSIC_ROOT_FOLDER_NAME;
  const fullCurrentPath = '/' + folderPath.map((p) => p.name).join('/');

  useEffect(() => {
    if (onActiveFolderTracksChange) {
      if (currentFolderTracks.length > 0) {
        onActiveFolderTracksChange(currentFolderTracks, currentFolderName);
      } else {
        onActiveFolderTracksChange([], '');
      }
    }
  }, [currentFolderTracks.length, currentFolderName]);

  const handlePlayEntireFolder = () => {
    if (currentFolderTracks.length > 0) {
      audioEngine.setQueue(currentFolderTracks, 0, true);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 pb-28 flex flex-col space-y-6 select-none">
      {/* Top Bar with Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLibrary}
            className="hitbox-48 w-11 h-11 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 transition-all flex items-center justify-center cursor-pointer"
            title="Volver a la biblioteca"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                <FolderOpen className="w-6 h-6 text-white" />
                <span>Explorador AudioCar</span>
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                <FolderLock className="w-3 h-3 text-neutral-300" />
                <span>/{rootFolder ? rootFolder.name : MUSIC_ROOT_FOLDER_NAME}</span>
              </span>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1 overflow-x-auto">
              {folderPath.map((item, idx) => {
                const isLast = idx === folderPath.length - 1;
                return (
                  <React.Fragment key={item.id + idx}>
                    <button
                      onClick={() => handleNavigateBreadcrumb(idx)}
                      className={`transition-colors whitespace-nowrap cursor-pointer ${
                        isLast ? 'text-white font-bold' : 'hover:text-white underline-offset-2 hover:underline'
                      }`}
                    >
                      {item.name}
                    </button>
                    {!isLast && (
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePickFolder}
            disabled={isFetchingFolders || isLoading}
            className="hitbox-48 px-4 py-2 rounded-full bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
            title="Seleccionar otra carpeta de Google Drive usando Google Picker"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cambiar Carpeta</span>
            <span className="sm:hidden">Carpeta</span>
          </button>

          <button
            onClick={async () => {
              await onRefreshDrive();
              if (isAtRoot) {
                await initRootFolderAndLoad();
              } else {
                await loadSubfolders(currentFolderId);
              }
            }}
            disabled={isFetchingFolders || isLoading}
            className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFolders || isLoading ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>

          {isAtRoot ? (
            allTracks.length > 0 && (
              <>
                {allTracks.length > 1 && (
                  <button
                    onClick={() => {
                      audioEngine.setPlaybackMode('shuffle');
                      const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
                      audioEngine.setQueue(shuffled, 0, true);
                    }}
                    className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs md:text-sm font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                    title="Mezclar todas las canciones de /mimusica aleatoriamente"
                  >
                    <Shuffle className="w-4 h-4 text-white" />
                    <span className="hidden sm:inline">Mezclar Todo</span>
                  </button>
                )}

                <button
                  onClick={() => audioEngine.setQueue(allTracks, 0, true)}
                  className="hitbox-48 px-5 py-2 rounded-full bg-white hover:bg-neutral-200 active:scale-95 text-black text-xs md:text-sm font-bold uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer"
                  title="Reproducir todas las canciones de /mimusica y sus subcarpetas"
                >
                  <Play className="w-4 h-4 fill-black text-black" />
                  <span>Reproducir Todo ({allTracks.length})</span>
                </button>
              </>
            )
          ) : (
            <>
              {currentFolderTracks.length > 1 && (
                <button
                  onClick={() => {
                    audioEngine.setPlaybackMode('shuffle');
                    const shuffled = [...currentFolderTracks].sort(() => Math.random() - 0.5);
                    audioEngine.setQueue(shuffled, 0, true);
                  }}
                  disabled={currentFolderTracks.length === 0}
                  className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs md:text-sm font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  title="Mezclar canciones de la carpeta aleatoriamente"
                  aria-label="Mezclar carpeta"
                >
                  <Shuffle className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Mezclar</span>
                </button>
              )}

              <button
                onClick={handlePlayEntireFolder}
                disabled={currentFolderTracks.length === 0}
                className="hitbox-48 px-5 py-2 rounded-full bg-white hover:bg-neutral-200 active:scale-95 text-black text-xs md:text-sm font-bold uppercase tracking-wider shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black text-black" />
                <span>Reproducir Carpeta ({currentFolderTracks.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subfolders Grid */}
      {folders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Folder className="w-4 h-4 text-white" />
              <span>Subcarpetas en {currentFolderName} ({folders.length})</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                tracks={allTracks}
                onSelectFolder={() => handleEnterFolder(f)}
                onPlayFolder={(folderTracks) => audioEngine.setQueue(folderTracks, 0, true)}
                onShuffleFolder={(folderTracks) => {
                  audioEngine.setPlaybackMode('shuffle');
                  const shuffled = [...folderTracks].sort(() => Math.random() - 0.5);
                  audioEngine.setQueue(shuffled, 0, true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tracks in Current Subfolder (Only displayed when inside a subfolder or if loose files exist at root) */}
      {(!isAtRoot || (isAtRoot && folders.length === 0)) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Music2 className="w-4 h-4 text-white" />
              <span>Archivos de Audio ({currentFolderTracks.length})</span>
            </h3>
            <span className="text-xs font-mono text-neutral-500 truncate max-w-[280px] sm:max-w-md">
              Ruta: {fullCurrentPath}
            </span>
          </div>

          {currentFolderTracks.length === 0 ? (
            <div className="py-14 text-center bg-[#0a0a0a] rounded-3xl border border-neutral-800 px-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto">
                <Music2 className="w-7 h-7 text-neutral-500" />
              </div>
              <div>
                <p className="text-base text-white font-bold">
                  No hay canciones en {fullCurrentPath}
                </p>
                <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Crea tu carpeta <span className="text-cyan-400 font-mono font-bold">mimusica</span> en Google Drive y añade tus canciones o subcarpetas (ej: Rock, Pop, etc.). Luego pulsa "Sincronizar".
                </p>
                <div className="pt-3">
                  <button
                    onClick={handlePickFolder}
                    disabled={isFetchingFolders || isLoading}
                    className="hitbox-48 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Seleccionar Carpeta con Google Picker</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {currentFolderTracks.map((track, idx) => (
                <div
                  key={track.id}
                  onClick={() => audioEngine.setQueue(currentFolderTracks, idx, true)}
                  className="hitbox-48 w-full p-3.5 rounded-2xl bg-[#0a0a0a] hover:bg-[#141414] border border-neutral-800 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5 truncate pr-2">
                    <span className="w-6 text-center text-xs font-mono text-neutral-500 shrink-0">{idx + 1}</span>
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 shadow-md">
                      <AlbumArtwork
                        track={track}
                        size="md"
                        isPlaying={playingTrackId === track.id}
                        showFormatBadge={false}
                        allowZoom={false}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-white group-hover:text-neutral-200 truncate">
                        {track.title}
                      </div>
                      <div className="text-xs text-neutral-400 truncate flex items-center gap-2">
                        <span>{track.artist}</span>
                        {track.album && track.album !== 'mimusica' && (
                          <span className="text-neutral-500">• {track.album}</span>
                        )}
                        {track.artworkFormat && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-neutral-800 text-neutral-300 font-mono rounded border border-neutral-700">
                            {track.artworkFormat}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-neutral-500">{track.bitrate || '320k'}</span>
                    <div className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-700 group-hover:bg-white group-hover:text-black text-white flex items-center justify-center transition-colors">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
