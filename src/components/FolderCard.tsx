import React, { useState, useEffect, useMemo } from 'react';
import { DriveFolder, AudioTrack, ImageFormat } from '../types';
import { driveService } from '../services/driveService';
import { Folder, Play, Shuffle, Music, Sparkles, Disc3, Disc, Volume2 } from 'lucide-react';

interface FolderCardProps {
  folder: DriveFolder;
  tracks: AudioTrack[];
  onSelectFolder: (folderId: string) => void;
  onPlayFolder: (folderTracks: AudioTrack[]) => void;
  onShuffleFolder?: (folderTracks: AudioTrack[]) => void;
}

// 12 Curated Automotive Luxury & Neon Gradient Themes
const FOLDER_THEMES = [
  {
    id: 'cyber-violet',
    bgGradient: 'from-violet-600 via-purple-700 to-indigo-950',
    cardBorder: 'hover:border-purple-500/80',
    glowColor: 'rgba(147, 51, 234, 0.35)',
    accentBg: 'bg-purple-500/20',
    accentText: 'text-purple-300',
    vinylCenter: 'from-purple-900 to-indigo-950',
    waveColor: 'bg-purple-400'
  },
  {
    id: 'sunset-amber',
    bgGradient: 'from-amber-500 via-orange-600 to-red-950',
    cardBorder: 'hover:border-amber-500/80',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    accentBg: 'bg-amber-500/20',
    accentText: 'text-amber-300',
    vinylCenter: 'from-amber-900 to-red-950',
    waveColor: 'bg-amber-400'
  },
  {
    id: 'electric-cyan',
    bgGradient: 'from-cyan-500 via-blue-600 to-slate-950',
    cardBorder: 'hover:border-cyan-500/80',
    glowColor: 'rgba(6, 182, 212, 0.35)',
    accentBg: 'bg-cyan-500/20',
    accentText: 'text-cyan-300',
    vinylCenter: 'from-cyan-900 to-blue-950',
    waveColor: 'bg-cyan-400'
  },
  {
    id: 'emerald-aurora',
    bgGradient: 'from-emerald-500 via-teal-700 to-slate-950',
    cardBorder: 'hover:border-emerald-500/80',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    accentBg: 'bg-emerald-500/20',
    accentText: 'text-emerald-300',
    vinylCenter: 'from-emerald-900 to-teal-950',
    waveColor: 'bg-emerald-400'
  },
  {
    id: 'crimson-speed',
    bgGradient: 'from-rose-600 via-red-700 to-neutral-950',
    cardBorder: 'hover:border-rose-500/80',
    glowColor: 'rgba(225, 29, 72, 0.35)',
    accentBg: 'bg-rose-500/20',
    accentText: 'text-rose-300',
    vinylCenter: 'from-rose-900 to-red-950',
    waveColor: 'bg-rose-400'
  },
  {
    id: 'neon-synth',
    bgGradient: 'from-fuchsia-600 via-pink-600 to-purple-950',
    cardBorder: 'hover:border-fuchsia-500/80',
    glowColor: 'rgba(217, 70, 239, 0.35)',
    accentBg: 'bg-fuchsia-500/20',
    accentText: 'text-fuchsia-300',
    vinylCenter: 'from-fuchsia-900 to-purple-950',
    waveColor: 'bg-fuchsia-400'
  },
  {
    id: 'sapphire-night',
    bgGradient: 'from-blue-600 via-indigo-700 to-slate-950',
    cardBorder: 'hover:border-blue-500/80',
    glowColor: 'rgba(37, 99, 235, 0.35)',
    accentBg: 'bg-blue-500/20',
    accentText: 'text-blue-300',
    vinylCenter: 'from-blue-900 to-indigo-950',
    waveColor: 'bg-blue-400'
  },
  {
    id: 'golden-lux',
    bgGradient: 'from-yellow-500 via-amber-600 to-stone-950',
    cardBorder: 'hover:border-yellow-500/80',
    glowColor: 'rgba(234, 179, 8, 0.35)',
    accentBg: 'bg-yellow-500/20',
    accentText: 'text-yellow-300',
    vinylCenter: 'from-amber-900 to-stone-950',
    waveColor: 'bg-yellow-400'
  },
  {
    id: 'teal-wave',
    bgGradient: 'from-teal-400 via-cyan-600 to-emerald-950',
    cardBorder: 'hover:border-teal-500/80',
    glowColor: 'rgba(20, 184, 166, 0.35)',
    accentBg: 'bg-teal-500/20',
    accentText: 'text-teal-300',
    vinylCenter: 'from-teal-900 to-emerald-950',
    waveColor: 'bg-teal-400'
  },
  {
    id: 'hyper-coral',
    bgGradient: 'from-orange-500 via-rose-600 to-violet-950',
    cardBorder: 'hover:border-orange-500/80',
    glowColor: 'rgba(249, 115, 22, 0.35)',
    accentBg: 'bg-orange-500/20',
    accentText: 'text-orange-300',
    vinylCenter: 'from-orange-900 to-rose-950',
    waveColor: 'bg-orange-400'
  }
];

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  tracks,
  onSelectFolder,
  onPlayFolder,
  onShuffleFolder
}) => {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [artworkFormat, setArtworkFormat] = useState<ImageFormat>('JPG');
  const [imageError, setImageError] = useState(false);
  const [isLoadingArt, setIsLoadingArt] = useState(true);

  // Deterministic color theme based on folder name
  const theme = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < folder.name.length; i++) {
      hash = (hash << 5) - hash + folder.name.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % FOLDER_THEMES.length;
    return FOLDER_THEMES[index];
  }, [folder.name]);

  // Compute clean initials/monogram for folder
  const monogram = useMemo(() => {
    const cleanName = folder.name.replace(/[_\-]/g, ' ').trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].slice(0, 2) + parts[1].slice(0, 1)).toUpperCase();
    }
    return cleanName.slice(0, 3).toUpperCase();
  }, [folder.name]);

  // Filter songs for this folder
  const folderNameLower = folder.name.toLowerCase();
  const folderTracks = useMemo(() => {
    return tracks.filter(
      (t) =>
        t.folderId === folder.id ||
        t.album?.toLowerCase() === folderNameLower ||
        t.folderPath?.toLowerCase().endsWith('/' + folderNameLower) ||
        t.folderPath?.toLowerCase().endsWith(folderNameLower)
    );
  }, [tracks, folder.id, folderNameLower]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingArt(true);

    const loadFolderCover = async () => {
      // 1. Discover companion artwork in the folder via Drive API (cover.jpg, folder.png, etc.)
      try {
        const cover = await driveService.discoverFolderArtwork(folder.id);
        if (cover && cover.url && isMounted) {
          setArtworkUrl(cover.url);
          setArtworkFormat(cover.format || 'JPG');
          setImageError(false);
          setIsLoadingArt(false);
          return;
        }
      } catch (err) {
        console.warn('Could not load direct cover for folder', folder.name, err);
      }

      // 2. Check if any track in this folder already has a thumbnail or artwork
      const trackWithThumb = folderTracks.find((t) => t.thumbnailUrl && t.thumbnailUrl.length > 5);
      if (trackWithThumb && trackWithThumb.thumbnailUrl && isMounted) {
        setArtworkUrl(trackWithThumb.thumbnailUrl);
        setArtworkFormat(trackWithThumb.artworkFormat || 'JPG');
        setImageError(false);
        setIsLoadingArt(false);
        return;
      }

      if (isMounted) {
        setIsLoadingArt(false);
      }
    };

    loadFolderCover();
    return () => {
      isMounted = false;
    };
  }, [folder.id, folder.name, folderTracks.length]);

  return (
    <div
      onClick={() => onSelectFolder(folder.id)}
      className={`group relative overflow-hidden rounded-3xl bg-[#0c0c0c] hover:bg-[#141414] border border-neutral-800/90 ${theme.cardBorder} transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-xl hover:shadow-2xl hover:-translate-y-1.5`}
      style={{
        boxShadow: `0 10px 30px -10px ${theme.glowColor}`
      }}
    >
      {/* Top Banner / Vibrant Artwork Presentation */}
      <div className={`relative w-full aspect-square bg-gradient-to-br ${theme.bgGradient} overflow-hidden flex items-center justify-center border-b border-neutral-800/60`}>
        {artworkUrl && !imageError ? (
          <>
            <img
              src={artworkUrl}
              alt={folder.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
              onError={() => setImageError(true)}
              loading="lazy"
            />
            {/* Format badge (JPG, PNG, GIF, WEBP) */}
            <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white border border-white/20 shadow-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{artworkFormat}</span>
            </div>
          </>
        ) : (
          /* Dynamic Colorful Vinyl Record & Monogram Cover Art */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
            {/* Concentric Vinyl Grooves Pattern */}
            <div
              className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, transparent 20%, rgba(255,255,255,0.12) 21%, transparent 22%, transparent 40%, rgba(255,255,255,0.12) 41%, transparent 42%, transparent 60%, rgba(255,255,255,0.12) 61%, transparent 62%, transparent 80%, rgba(255,255,255,0.12) 81%, transparent 82%)'
              }}
            />

            {/* Ambient Radial Spotlight */}
            <div className="absolute inset-0 bg-radial from-white/20 via-transparent to-black/60 pointer-events-none" />

            {/* Center Monogram & Vinyl Center Disc */}
            <div className="relative z-10 flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-500">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-black/70 backdrop-blur-md border-2 border-white/25 shadow-2xl flex items-center justify-center group-hover:border-white/50 transition-colors">
                {/* Rotating Vinyl Rings */}
                <Disc3 className="w-full h-full text-white/30 absolute inset-0 p-1 group-hover:rotate-180 transition-transform duration-1000 ease-in-out" />
                
                {/* Inner Monogram */}
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${theme.vinylCenter} border border-white/30 flex flex-col items-center justify-center shadow-inner`}>
                  <span className="text-sm sm:text-base font-black tracking-wider text-white font-mono drop-shadow-md">
                    {monogram}
                  </span>
                  <div className="w-4 h-0.5 bg-white/50 rounded-full mt-0.5" />
                </div>
              </div>

              {/* Styled Folder Tag */}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-mono font-bold tracking-widest text-white/90 shadow-md">
                <Folder className="w-3 h-3 text-white" />
                <span className="truncate max-w-[130px] sm:max-w-[160px] uppercase">
                  {folder.name}
                </span>
              </div>
            </div>

            {/* Subtle animated sound equalizer bars at bottom */}
            <div className="absolute bottom-3 left-4 flex items-end gap-1 pointer-events-none z-10 opacity-70 group-hover:opacity-100 transition-opacity">
              <span className={`w-1 h-3 rounded-full ${theme.waveColor} animate-pulse`} style={{ animationDelay: '0ms' }} />
              <span className={`w-1 h-5 rounded-full ${theme.waveColor} animate-pulse`} style={{ animationDelay: '150ms' }} />
              <span className={`w-1 h-2 rounded-full ${theme.waveColor} animate-pulse`} style={{ animationDelay: '300ms' }} />
              <span className={`w-1 h-4 rounded-full ${theme.waveColor} animate-pulse`} style={{ animationDelay: '450ms' }} />
            </div>
          </div>
        )}

        {/* Ambient Bottom Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Direct Tactile Play & Shuffle Buttons */}
        <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2 z-20">
          {folderTracks.length > 1 && onShuffleFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onShuffleFolder(folderTracks);
              }}
              className="hitbox-48 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/80 hover:bg-black text-white border border-white/30 backdrop-blur-md shadow-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              title={`Shuffle ${folder.name}`}
              aria-label="Shuffle folder"
            >
              <Shuffle className="w-5 h-5 text-white" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (folderTracks.length > 0) {
                onPlayFolder(folderTracks);
              } else {
                onSelectFolder(folder.id);
              }
            }}
            className="hitbox-56 w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-neutral-100 text-black shadow-[0_4px_25px_rgba(255,255,255,0.4)] active:scale-95 transition-all flex items-center justify-center cursor-pointer group/btn"
            title={`Play all songs from ${folder.name}`}
            aria-label="Play folder"
          >
            <Play className="w-6 h-6 fill-black text-black ml-1 group-hover/btn:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Card Body / Details */}
      <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2.5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider font-mono ${theme.accentText}`}>
              Drive Folder
            </span>
            <span className="text-xs font-mono font-bold text-white bg-neutral-900/90 px-2.5 py-0.5 rounded-full border border-neutral-800 shadow-sm">
              {folderTracks.length} {folderTracks.length === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-extrabold text-white group-hover:text-amber-300 transition-colors line-clamp-1 leading-snug">
            {folder.name}
          </h4>
        </div>

        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 truncate">
            <Music className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="truncate">
              {folderTracks.length > 0 
                ? (folderTracks[0].artist || folderTracks[0].title) 
                : 'Explore tracks'}
            </span>
          </span>
          <span className="text-[11px] font-bold uppercase text-neutral-400 group-hover:text-white shrink-0 font-mono flex items-center gap-1">
            <span>Open</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </span>
        </div>
      </div>
    </div>
  );
};
