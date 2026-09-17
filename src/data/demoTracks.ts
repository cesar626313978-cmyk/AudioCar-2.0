/**
 * Built-in Driving Soundtrack & Royalty-Free Audio Tracks
 * Features diverse artwork formats (JPG, PNG, GIF, WEBP) and missing-artwork fallbacks
 * to test album artwork rendering, playback options (Lineal, Suflé, Continuo, Crossfade, Desvanecimiento).
 */

import { AudioTrack } from '../types';

export const DEMO_TRACKS: AudioTrack[] = [
  {
    id: 'demo_track_1',
    name: 'Nightcall Horizon.mp3',
    title: 'Nightcall Horizon',
    artist: 'Kavinsky & Cyberwave',
    album: 'Outrun Highway 101',
    duration: 215, // 3m 35s
    size: 8640000,
    mimeType: 'audio/mpeg',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop',
    artworkFormat: 'JPG',
    streamUrl: '/demo/track_1.mp3',
    source: 'demo',
    bitrate: '320 kbps',
    year: '2024',
    isFavorite: true
  },
  {
    id: 'demo_track_2',
    name: 'Electric Neon Supercharger.mp3',
    title: 'Neon Supercharger',
    artist: 'AudioCar Synth Collective',
    album: 'Kilowatt Dreams',
    duration: 184, // 3m 04s
    size: 7380000,
    mimeType: 'audio/mpeg',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
    artworkFormat: 'PNG',
    streamUrl: '/demo/track_2.mp3',
    source: 'demo',
    bitrate: '320 kbps',
    year: '2025',
    isFavorite: true
  },
  {
    id: 'demo_track_3',
    name: 'Autopilot Coastline.mp3',
    title: 'Autopilot Coastline (Deep House Mix)',
    artist: 'Solaris Wave',
    album: 'Pacific Coast Highway',
    duration: 242, // 4m 02s
    size: 9680000,
    mimeType: 'audio/mpeg',
    thumbnailUrl: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif', // Animated GIF Album Art
    artworkFormat: 'GIF',
    streamUrl: '/demo/track_3.mp3',
    source: 'demo',
    bitrate: 'Flac 24-bit',
    year: '2024',
    isFavorite: false
  },
  {
    id: 'demo_track_4',
    name: 'Midnight Cruising.mp3',
    title: 'Midnight Cruising 120km/h',
    artist: 'Aero Dynamics',
    album: 'Aero Dynamics OST',
    duration: 198, // 3m 18s
    size: 7920000,
    mimeType: 'audio/mpeg',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
    artworkFormat: 'WEBP',
    streamUrl: '/demo/track_4.mp3',
    source: 'demo',
    bitrate: '320 kbps',
    year: '2023',
    isFavorite: true
  },
  {
    id: 'demo_track_5',
    name: 'Chill Sunrise Lo-Fi.mp3',
    title: 'Sunrise Over Mountain Pass (Sin Carátula)',
    artist: 'Lo-Fi Chill Voyager',
    album: 'Dawn Horizons',
    duration: 165, // 2m 45s
    size: 6600000,
    mimeType: 'audio/mpeg',
    thumbnailUrl: '', // Intentionally empty to test graceful fallback
    streamUrl: '/demo/track_5.mp3',
    source: 'demo',
    bitrate: '320 kbps',
    year: '2024',
    isFavorite: false
  },
  {
    id: 'demo_track_6',
    name: 'Cyberpunk Red Shift.mp3',
    title: 'Cyberpunk Red Shift',
    artist: 'HyperDrive',
    album: 'Sector 7 Neon',
    duration: 220, // 3m 40s
    size: 8800000,
    mimeType: 'audio/mpeg',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
    artworkFormat: 'JPG',
    streamUrl: '/demo/track_6.mp3',
    source: 'demo',
    bitrate: '320 kbps',
    year: '2025',
    isFavorite: true
  }
];
