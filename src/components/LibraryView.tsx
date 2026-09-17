/**
 * Library & Explorer View - Sophisticated Dark Automotive Layout
 * Features:
 * - Subtabs: Todas, Carpetas, Playlists, Recientes, Favoritos
 * - Dynamic Album Artwork previews (JPG, PNG, GIF, WEBP) with graceful fallbacks
 * - Instant search filter with audio and artwork format badges
 * - Touch-friendly track cards (min 60px height)
 * - Drive sync status & refresh button
 * - Option to delete DEMO songs or individual tracks
 */

import React, { useState, useMemo } from 'react';
import { AudioTrack, DriveFolder } from '../types';
import { audioEngine } from '../services/audioEngine';
import { dbService } from '../services/dbService';
import { authService } from '../services/authService';
import { AlbumArtwork } from './AlbumArtwork';
import { FolderCard } from './FolderCard';
import {
  Music2,
  Play,
  Shuffle,
  Heart,
  Search,
  RefreshCw,
  Folder,
  FolderTree,
  Trash2,
  RotateCcw
} from 'lucide-react';

interface LibraryViewProps {
  tracks: AudioTrack[];
  folders: DriveFolder[];
  currentTrackId?: string;
  onRefreshDrive: () => Promise<void>;
  isLoading: boolean;
  onSelectFolder: (folderId: string) => void;
  onDeleteDemoTracks?: () => void;
  onRestoreDemoTracks?: () => void;
  onDeleteTrack?: (trackId: string) => void;
  initialTab?: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  folders,
  currentTrackId,
  onRefreshDrive,
  isLoading,
  onSelectFolder,
  onDeleteDemoTracks,
  onRestoreDemoTracks,
  onDeleteTrack,
  initialTab = 'folders'
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'artist'>('name');

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const demoTracksCount = useMemo(() => {
    return tracks.filter((t) => t.source === 'demo' || t.id.startsWith('demo_')).length;
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      // Tab filter
      if (activeTab === 'favorites' && !track.isFavorite) return false;

      // Format filter
      if (selectedFormat !== 'all') {
        const ext = track.name.split('.').pop()?.toLowerCase();
        if (ext !== selectedFormat.toLowerCase()) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = track.title.toLowerCase().includes(q);
        const matchArtist = track.artist.toLowerCase().includes(q);
        const matchAlbum = track.album.toLowerCase().includes(q);
        const matchName = track.name.toLowerCase().includes(q);
        if (!matchTitle && !matchArtist && !matchAlbum && !matchName) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'artist') {
        return a.artist.localeCompare(b.artist);
      }
      if (sortBy === 'date') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      return a.title.localeCompare(b.title);
    });
  }, [tracks, activeTab, selectedFormat, searchQuery, sortBy]);

  const handlePlayAll = () => {
    if (filteredTracks.length > 0) {
      audioEngine.setQueue(filteredTracks, 0, true);
    }
  };

  const handlePlayTrack = (track: AudioTrack, index: number) => {
    audioEngine.setQueue(filteredTracks, index, true);
  };

  const toggleFavorite = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    await dbService.toggleFavorite(trackId);
    const track = tracks.find((t) => t.id === trackId);
    if (track) {
      track.isFavorite = !track.isFavorite;
      audioEngine.subscribe(() => {})?.();
    }
  };

  const handleDeleteSingleTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    if (onDeleteTrack) {
      onDeleteTrack(trackId);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 pb-28 flex flex-col space-y-6 select-none">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Biblioteca de Audio
          </h2>
          <p className="text-sm text-neutral-400 mt-0.5">
            {tracks.length} pistas disponibles ({tracks.filter((t) => t.source === 'drive').length} en Google Drive
            {demoTracksCount > 0 ? `, ${demoTracksCount} DEMO` : ''})
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Delete DEMO tracks button */}
          {demoTracksCount > 0 && onDeleteDemoTracks && (
            <button
              onClick={onDeleteDemoTracks}
              className="hitbox-48 px-3.5 py-2 rounded-full bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Eliminar todas las canciones DEMO de prueba"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Eliminar DEMO ({demoTracksCount})</span>
            </button>
          )}

          <button
            onClick={() => onRefreshDrive()}
            disabled={isLoading}
            className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
            title="Sincronizar pistas desde Google Drive"
          >
            <RefreshCw className={`w-4 h-4 text-neutral-300 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
          </button>

          {filteredTracks.length > 1 && (
            <button
              onClick={() => {
                audioEngine.setPlaybackMode('shuffle');
                const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
                audioEngine.setQueue(shuffled, 0, true);
              }}
              disabled={filteredTracks.length === 0}
              className="hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              title="Mezclar canciones de la lista aleatoriamente"
              aria-label="Mezclar todo"
            >
              <Shuffle className="w-4 h-4 text-white" />
              <span>Mezclar Todo</span>
            </button>
          )}

          <button
            onClick={handlePlayAll}
            disabled={filteredTracks.length === 0}
            className="hitbox-48 px-5 py-2 rounded-full bg-white hover:bg-neutral-200 active:scale-95 text-black text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-black text-black" />
            <span>Reproducir Todo</span>
          </button>
        </div>
      </div>

      {/* Subtabs Bar (Carpetas, Canciones, Favoritos) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-neutral-800">
        {[
          { id: 'folders', label: 'Carpetas Drive', icon: FolderTree },
          { id: 'all', label: 'Canciones', icon: Music2 },
          { id: 'favorites', label: 'Favoritos', icon: Heart }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`hitbox-48 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-white text-black shadow-md'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-black' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Folders View Tab */}
      {activeTab === 'folders' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0d0d] p-4 sm:p-5 rounded-2xl border border-neutral-800">
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-amber-400" />
                <span>Carpetas y Álbumes de Drive (/mimusica)</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Explora cada carpeta con sus carátulas de portada, formato de imagen y acceso táctil rápido
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-neutral-300 bg-black px-3.5 py-1.5 rounded-full border border-neutral-700">
                {folders.length} subdirectorios
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folders.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-[#0a0a0a] rounded-3xl border border-neutral-800 p-8 space-y-4">
                <Folder className="w-16 h-16 text-neutral-600 mx-auto" />
                <div>
                  <p className="text-white font-bold text-lg">
                    {authService.getUser()
                      ? 'No hay subcarpetas dentro de "mimusica"'
                      : 'Google Drive no conectado'}
                  </p>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">
                    {authService.getUser()
                      ? 'Crea subcarpetas como mimusica/40_Clasic, mimusica/Happy_music o mimusica/Dance Hits 90 en Google Drive y pulsa "Sincronizar Drive".'
                      : 'Inicia sesión con tu cuenta de Google Drive para cargar tus carpetas y álbumes desde la carpeta /mimusica.'}
                  </p>
                </div>
                <button
                  onClick={() => onRefreshDrive()}
                  className="mt-2 hitbox-48 px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors shadow-lg cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{authService.getUser() ? 'Sincronizar Ahora' : 'Conectar y Sincronizar'}</span>
                </button>
              </div>
            ) : (
              folders.map((f) => (
                <FolderCard
                  key={f.id}
                  folder={f}
                  tracks={tracks}
                  onSelectFolder={onSelectFolder}
                  onPlayFolder={(folderTracks) => audioEngine.setQueue(folderTracks, 0, true)}
                  onShuffleFolder={(folderTracks) => {
                    audioEngine.setPlaybackMode('shuffle');
                    const shuffled = [...folderTracks].sort(() => Math.random() - 0.5);
                    audioEngine.setQueue(shuffled, 0, true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Search & Filter Bar for Tracks */}
      {(activeTab === 'all' || activeTab === 'favorites' || activeTab === 'recent') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input with high touch area */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por título, artista o archivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-full bg-[#0f0f0f] border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 text-sm"
              />
            </div>

            {/* Format Filter Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['all', 'mp3', 'flac', 'm4a', 'wav'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`hitbox-48 px-3.5 py-1.5 rounded-full text-xs font-mono uppercase font-bold transition-all ${
                    selectedFormat === fmt
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Framed Scrollable Track Container (Keeps page stationary) */}
          <div className="bg-[#0c0c0c] border border-neutral-800/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-2xl flex flex-col gap-3">
            {/* Header info / counter */}
            <div className="flex items-center justify-between px-1.5 py-1 text-xs text-neutral-400 border-b border-neutral-800/70">
              <span className="font-bold uppercase tracking-wider text-neutral-300">
                Pistas ({filteredTracks.length})
              </span>
              <span className="font-mono text-[11px] text-neutral-500 hidden xs:inline">
                Scroll independiente • Pantalla fija
              </span>
            </div>

            {/* Scrollable track list box */}
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[350px] pr-1.5 overscroll-contain">
              {filteredTracks.length === 0 ? (
                <div className="py-16 text-center bg-[#0a0a0a] rounded-2xl border border-neutral-800/80 p-6 space-y-3">
                  <Music2 className="w-12 h-12 text-neutral-600 mx-auto" />
                  <p className="text-white font-semibold">No se encontraron pistas de audio</p>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    {searchQuery 
                      ? 'Prueba con otro término de búsqueda' 
                      : 'Sube tus canciones a la carpeta "mimusica" en Google Drive y pulsa "Sincronizar Drive".'}
                  </p>
                  {demoTracksCount === 0 && onRestoreDemoTracks && (
                    <button
                      onClick={onRestoreDemoTracks}
                      className="mt-2 hitbox-48 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider border border-neutral-700 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Cargar canciones DEMO</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredTracks.map((track, idx) => {
                  const isPlaying = track.id === currentTrackId;
                  const isDemo = track.source === 'demo' || track.id.startsWith('demo_');
                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track, idx)}
                      className={`hitbox-48 w-full p-3 md:px-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group ${
                        isPlaying
                          ? 'bg-white/10 border-white/40 shadow-md'
                          : 'bg-[#101010] hover:bg-[#161616] border-neutral-800/80'
                      }`}
                    >
                      {/* Left: Index, Album Artwork Thumbnail, Title & Artist */}
                      <div className="flex items-center gap-3.5 truncate pr-3">
                        {/* Play indicator / Index */}
                        <span className="w-6 text-center text-xs font-mono text-neutral-500 shrink-0">
                          {isPlaying ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-white inline-block animate-ping" />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        {/* Resilient Artwork Thumbnail with larger presence */}
                        <div className="relative group shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
                          <AlbumArtwork
                            track={track}
                            size="md"
                            isPlaying={isPlaying}
                            showFormatBadge={false}
                            allowZoom={false}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                            <Play className="w-5 h-5 fill-white text-white" />
                          </div>
                        </div>

                        {/* Title, Artist, & Format Badges */}
                        <div className="truncate">
                          <div className={`text-sm md:text-base font-bold truncate ${isPlaying ? 'text-white' : 'text-neutral-200'}`}>
                            {track.title}
                          </div>
                          <div className="text-xs md:text-sm font-medium text-neutral-400 truncate flex items-center gap-2">
                            <span>{track.artist}</span>
                            {track.artworkFormat && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-neutral-800 text-neutral-300 font-mono rounded border border-neutral-700">
                                {track.artworkFormat}
                              </span>
                            )}
                            {track.source === 'drive' ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono border border-neutral-700">DRIVE</span>
                            ) : track.source === 'demo' ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 font-mono border border-amber-800">DEMO</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Badges, Duration, Favorite & Delete single track */}
                      <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        <span className="text-xs font-mono text-neutral-500 hidden md:inline">
                          {track.bitrate || '320k'}
                        </span>

                        <span className="text-xs md:text-sm font-mono text-neutral-400">
                          {formatTime(track.duration)}
                        </span>

                        {/* Favorite Button */}
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(e, track.id)}
                          className="hitbox-48 w-9 h-9 md:w-10 md:h-10 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer"
                          title="Favorite"
                        >
                          <Heart
                            className={`w-4 h-4 md:w-5 md:h-5 ${
                              track.isFavorite ? 'fill-white text-white' : 'text-neutral-500'
                            }`}
                          />
                        </button>

                        {/* Delete individual DEMO track */}
                        {isDemo && onDeleteTrack && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSingleTrack(e, track.id)}
                            className="hitbox-48 w-9 h-9 md:w-10 md:h-10 rounded-full text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer"
                            title="Delete DEMO track"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
