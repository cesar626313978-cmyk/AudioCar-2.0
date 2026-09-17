import React, { useState, useEffect, useMemo } from 'react';
import { AudioTrack, ImageFormat } from '../types';
import { driveService } from '../services/driveService';
import { Music, Disc3, Disc } from 'lucide-react';

export interface AlbumArtworkProps {
  track?: AudioTrack | null;
  url?: string;
  title?: string;
  artist?: string;
  format?: ImageFormat;
  showFormatBadge?: boolean;
  allowZoom?: boolean;
  showVinyl?: boolean;
  isPlaying?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'fluid' | 'full';
  className?: string;
  rounded?: boolean;
}

// Curated Iconic Vinyl Record Center-Label Themes (Blue Note, Sun, Motown, Abbey, Stax, Gold, etc.)
const VINYL_LABEL_THEMES = [
  {
    id: 'blue-note',
    labelBg: 'bg-gradient-to-br from-blue-600 via-blue-800 to-indigo-950',
    ring: 'border-cyan-300/50',
    accentText: 'text-cyan-300',
    titleColor: 'text-white',
    subColor: 'text-blue-200',
    glow: 'rgba(59, 130, 246, 0.4)'
  },
  {
    id: 'sun-amber',
    labelBg: 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-950',
    ring: 'border-yellow-300/50',
    accentText: 'text-amber-300',
    titleColor: 'text-white',
    subColor: 'text-amber-100',
    glow: 'rgba(245, 158, 11, 0.4)'
  },
  {
    id: 'motown-purple',
    labelBg: 'bg-gradient-to-br from-purple-600 via-fuchsia-800 to-indigo-950',
    ring: 'border-fuchsia-300/50',
    accentText: 'text-fuchsia-300',
    titleColor: 'text-white',
    subColor: 'text-purple-200',
    glow: 'rgba(168, 85, 247, 0.4)'
  },
  {
    id: 'abbey-emerald',
    labelBg: 'bg-gradient-to-br from-emerald-600 via-teal-800 to-slate-950',
    ring: 'border-emerald-300/50',
    accentText: 'text-emerald-300',
    titleColor: 'text-white',
    subColor: 'text-emerald-100',
    glow: 'rgba(16, 185, 129, 0.4)'
  },
  {
    id: 'stax-ruby',
    labelBg: 'bg-gradient-to-br from-rose-600 via-red-700 to-neutral-950',
    ring: 'border-rose-300/50',
    accentText: 'text-rose-300',
    titleColor: 'text-white',
    subColor: 'text-rose-100',
    glow: 'rgba(244, 63, 94, 0.4)'
  },
  {
    id: 'dg-gold',
    labelBg: 'bg-gradient-to-br from-yellow-500 via-amber-600 to-yellow-950',
    ring: 'border-yellow-200/60',
    accentText: 'text-amber-200',
    titleColor: 'text-white',
    subColor: 'text-yellow-100',
    glow: 'rgba(234, 179, 8, 0.4)'
  },
  {
    id: 'cyan-matrix',
    labelBg: 'bg-gradient-to-br from-cyan-600 via-teal-800 to-slate-950',
    ring: 'border-cyan-300/50',
    accentText: 'text-cyan-200',
    titleColor: 'text-white',
    subColor: 'text-cyan-100',
    glow: 'rgba(6, 182, 212, 0.4)'
  },
  {
    id: 'coral-vintage',
    labelBg: 'bg-gradient-to-br from-orange-600 via-rose-700 to-neutral-950',
    ring: 'border-orange-300/50',
    accentText: 'text-orange-200',
    titleColor: 'text-white',
    subColor: 'text-orange-100',
    glow: 'rgba(249, 115, 22, 0.4)'
  }
];

// In-memory instant cache for discovered folder artworks across components
const folderArtworkCache = new Map<string, { url: string; format: ImageFormat }>();

export const AlbumArtwork: React.FC<AlbumArtworkProps> = ({
  track,
  url,
  title: propTitle,
  artist: propArtist,
  format: propFormat,
  showFormatBadge = false,
  allowZoom = false,
  showVinyl = false,
  isPlaying = false,
  size = 'md',
  className = '',
  rounded = true
}) => {
  const rawUrl = url || track?.thumbnailUrl || null;
  const folderId = track?.folderId && track.folderId !== 'root' ? track.folderId : null;
  
  // Instant synchronous lookup from memory cache if available
  const cachedArt = folderId ? folderArtworkCache.get(folderId) : null;

  const [hasError, setHasError] = useState(false);
  const [discoveredArtworkUrl, setDiscoveredArtworkUrl] = useState<string | null>(cachedArt?.url || null);
  const [discoveredFormat, setDiscoveredFormat] = useState<ImageFormat>(cachedArt?.format || 'JPG');
  const [isImgLoaded, setIsImgLoaded] = useState(Boolean(rawUrl || cachedArt?.url));

  // Derive title, artist, format and image URL from track or props
  const trackTitle = track?.title || propTitle || 'AudioCar Studio';
  const trackArtist = track?.artist || propArtist || 'Google Drive';
  const activeFormat = propFormat || track?.artworkFormat || discoveredFormat || 'JPG';

  // Look up folder artwork if track doesn't have an embedded thumbnail
  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    if (rawUrl) {
      setDiscoveredArtworkUrl(null);
      setIsImgLoaded(true);
      return;
    }

    if (folderId) {
      if (folderArtworkCache.has(folderId)) {
        const cached = folderArtworkCache.get(folderId)!;
        setDiscoveredArtworkUrl(cached.url);
        setDiscoveredFormat(cached.format);
        setIsImgLoaded(true);
        return;
      }

      driveService.discoverFolderArtwork(folderId).then((art) => {
        if (isMounted && art && art.url) {
          folderArtworkCache.set(folderId, { url: art.url, format: art.format || 'JPG' });
          setDiscoveredArtworkUrl(art.url);
          setDiscoveredFormat(art.format || 'JPG');
          setIsImgLoaded(true);
          setHasError(false);
        }
      }).catch(() => {});
    } else {
      setDiscoveredArtworkUrl(null);
    }

    return () => {
      isMounted = false;
    };
  }, [track?.id, folderId, rawUrl]);

  // Compute initials for the cover art monogram
  const initials = useMemo(() => {
    if (trackArtist && trackArtist !== 'Artista Desconocido' && trackArtist !== 'Google Drive') {
      const parts = trackArtist.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
      return (trackArtist[0] || 'A').toUpperCase();
    }
    const titleParts = trackTitle.trim().split(/\s+/).filter(Boolean);
    if (titleParts.length >= 2) return (titleParts[0][0] + titleParts[1][0]).toUpperCase();
    if (titleParts.length === 1 && titleParts[0].length >= 2) return titleParts[0].slice(0, 2).toUpperCase();
    return (trackTitle[0] || 'M').toUpperCase();
  }, [trackArtist, trackTitle]);

  // Deterministic vibrant color theme based on title & artist
  const theme = useMemo(() => {
    const key = `${trackArtist}_${trackTitle}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % VINYL_LABEL_THEMES.length;
    return VINYL_LABEL_THEMES[idx];
  }, [trackArtist, trackTitle]);

  const sizeClasses: Record<string, string> = {
    xs: 'w-8 h-8 min-w-[32px]',
    sm: 'w-10 h-10 min-w-[40px]',
    md: 'w-14 h-14 sm:w-16 sm:h-16 min-w-[56px]',
    lg: 'w-24 h-24 min-w-[96px]',
    xl: 'w-36 h-36 min-w-[144px]',
    fluid: 'w-full h-full aspect-square',
    full: 'w-full h-full aspect-square'
  };

  const badgeSizes: Record<string, string> = {
    xs: 'text-[6px] px-1 py-0.2',
    sm: 'text-[7px] px-1 py-0.2',
    md: 'text-[8px] px-1.5 py-0.5',
    lg: 'text-[9px] px-2 py-0.5',
    xl: 'text-xs px-2.5 py-1',
    fluid: 'text-[8px] px-1.5 py-0.5',
    full: 'text-xs px-2.5 py-1'
  };

  const activeImage = (!hasError && (rawUrl || discoveredArtworkUrl)) || null;
  const roundedClass = rounded
    ? size === 'xs' || size === 'sm'
      ? 'rounded-xl'
      : 'rounded-2xl'
    : 'rounded-none';

  const isCompact = size === 'xs' || size === 'sm';

  return (
    <div
      className={`relative select-none overflow-hidden shrink-0 shadow-md ${roundedClass} ${sizeClasses[size] || sizeClasses.md} ${className}`}
      style={{
        boxShadow: !activeImage ? `0 6px 20px -4px var(--led-color-glow, ${theme.glow})` : undefined
      }}
    >
      {/* 1. Realistic Personalized Spinning Vinyl Record Base Layer with Ambient LED Background */}
      <div
        className="w-full h-full flex items-center justify-center p-1 sm:p-1.5 relative overflow-hidden border transition-all duration-500"
        style={{
          background:
            'var(--led-border-gradient, linear-gradient(135deg, var(--led-color, #10B981) 0%, var(--led-color-subtle, rgba(16, 185, 129, 0.65)) 50%, var(--led-color-ambient, rgba(10, 15, 20, 0.95)) 100%))',
          borderColor: 'var(--led-color-subtle, rgba(255, 255, 255, 0.2))',
          boxShadow: 'inset 0 0 16px -2px rgba(0, 0, 0, 0.45)'
        }}
      >
        {/* The Vinyl LP Disc */}
        <div
          className={`relative w-[90%] h-[90%] rounded-full flex items-center justify-center overflow-hidden shadow-2xl border border-black/80 bg-[#0d0e12] animate-vinyl-spin transition-transform`}
          style={{
            animationPlayState: isPlaying ? 'running' : 'paused',
            boxShadow:
              '0 8px 24px -2px rgba(0, 0, 0, 0.75), 0 2px 8px 0 rgba(0, 0, 0, 0.6)'
          }}
        >
          {/* Concentric Sound Grooves Texture */}
          <div className="absolute inset-0 rounded-full vinyl-grooves-pattern opacity-90 pointer-events-none" />

          {/* Sound-track Division Rings */}
          <div className="absolute inset-[10%] rounded-full border border-white/[0.06] pointer-events-none" />
          <div className="absolute inset-[22%] rounded-full border border-white/[0.05] pointer-events-none" />
          <div className="absolute inset-[32%] rounded-full border border-white/[0.04] pointer-events-none" />

          {/* Realistic Specular Conic Light Sheen */}
          <div className="absolute inset-0 rounded-full vinyl-sheen-overlay pointer-events-none opacity-80 mix-blend-screen" />

          {/* Center Record Label ("La Galleta" personalizada del vinilo) */}
          <div
            className={`relative z-10 rounded-full ${theme.labelBg} border border-white/30 ring-1 ring-black/60 shadow-xl flex flex-col items-center justify-center overflow-hidden p-1 ${
              isCompact ? 'w-[52%] h-[52%]' : 'w-[48%] h-[48%]'
            }`}
          >
            {/* Fine Inner Label Foil Rings */}
            <div className="absolute inset-[3px] rounded-full border border-white/25 pointer-events-none" />

            {isCompact ? (
              /* Compact view for small thumbnails (xs, sm) */
              <div className="relative z-10 flex flex-col items-center justify-center">
                <span className="font-mono font-black text-white text-[8px] sm:text-[9px] tracking-wider drop-shadow">
                  {initials}
                </span>
                {/* Micro Spindle Hole */}
                <div className="w-2 h-2 rounded-full bg-neutral-300 border border-neutral-400 flex items-center justify-center shadow-inner mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-[#050505]" />
                </div>
              </div>
            ) : (
              /* High-fidelity view for medium, large & fluid player displays (md, lg, xl, fluid) */
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-1 px-1 text-center select-none">
                {/* Top Label Header */}
                <div className="text-[6px] sm:text-[7px] font-mono tracking-widest font-black uppercase text-white/90 drop-shadow flex items-center gap-0.5">
                  <span>STEREO</span>
                  <span>•</span>
                  <span>33⅓</span>
                </div>

                {/* Personalized Song Title & Artist */}
                <div className="w-full flex flex-col items-center justify-center min-w-0 my-auto">
                  <span className="text-[8px] sm:text-[9px] font-extrabold text-white leading-tight line-clamp-1 w-full px-1 drop-shadow-md">
                    {trackTitle}
                  </span>
                  <span className="text-[6.5px] sm:text-[7.5px] font-medium text-white/80 line-clamp-1 w-full px-1 drop-shadow">
                    {trackArtist}
                  </span>
                </div>

                {/* Brushed Center Spindle Grommet & Hole */}
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-neutral-200 border border-neutral-400 shadow-inner flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#08080a] ring-1 ring-neutral-600" />
                </div>

                {/* Bottom Audio Format Badge */}
                <div className="text-[5.5px] sm:text-[6.5px] font-mono font-bold tracking-wider uppercase text-white/75">
                  {activeFormat || 'HI-FI'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Seamless Image Overlay: Smoothly fades in if real album cover image exists */}
      {activeImage && (
        <img
          src={activeImage}
          alt={`${trackTitle} - ${trackArtist}`}
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setIsImgLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover shadow-inner transition-opacity duration-300 ${
            isImgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onError={() => setHasError(true)}
        />
      )}

      {/* Format Badge (JPG / PNG / GIF / WEBP) for real album covers */}
      {showFormatBadge && activeImage && (
        <div
          className={`absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-white font-mono font-bold tracking-wider rounded-md border border-white/20 shadow-sm ${badgeSizes[size] || badgeSizes.md}`}
        >
          {activeFormat}
        </div>
      )}
    </div>
  );
};
