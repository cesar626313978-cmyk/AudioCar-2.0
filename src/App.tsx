/**
 * Main Application Shell - Spherical Earth Audio Player (Google Drive)
 * Minimalist, ultra-clean single-view design modeled after the terrestrial sphere.
 * All controls, playback, search, and Google Drive access are integrated within the circle.
 */

import React, { useState, useEffect } from 'react';
import { PlayerState, AudioTrack, DriveFolder, DriveAuthUser } from './types';
import { audioEngine } from './services/audioEngine';
import { authService } from './services/authService';
import { driveService } from './services/driveService';
import { dbService } from './services/dbService';
import { DEMO_TRACKS } from './data/demoTracks';
import { SphericalPlayer } from './components/SphericalPlayer';
import { SpaceBackground } from './components/SpaceBackground';
import { UfoBanner } from './components/UfoBanner';

export function App() {
  const [playerState, setPlayerState] = useState<PlayerState>(audioEngine.getState());
  const [user, setUser] = useState<DriveAuthUser | null>(authService.getUser());
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);

  // Initialize and subscribe to core services
  useEffect(() => {
    // 1. Audio Engine playback state subscription
    const unsubscribeAudio = audioEngine.subscribe((state) => {
      setPlayerState(state);
    });

    // 2. Auth service state subscription
    const unsubscribeAuth = authService.subscribe(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        // Auto-refresh tracks when logged in
        refreshDriveTracks();
      }
    });

    // 3. Load initial local cache / demo tracks
    loadInitialMusic();

    // 4. Initialize Google Identity Services token client
    authService.initTokenClient();

    return () => {
      unsubscribeAudio();
      unsubscribeAuth();
    };
  }, []);

  const loadInitialMusic = async () => {
    try {
      const cached = await dbService.getAllTracks();
      if (cached && cached.length > 0) {
        setTracks(cached);
        if (audioEngine.getState().queue.length === 0) {
          audioEngine.setQueue(cached, 0, false);
        }
      } else {
        // Default to high-fidelity demo tracks for instant experience
        setTracks(DEMO_TRACKS);
        if (audioEngine.getState().queue.length === 0) {
          audioEngine.setQueue(DEMO_TRACKS, 0, false);
        }
      }
    } catch (e) {
      console.warn('Error loading initial music cache:', e);
      setTracks(DEMO_TRACKS);
      if (audioEngine.getState().queue.length === 0) {
        audioEngine.setQueue(DEMO_TRACKS, 0, false);
      }
    }
  };

  const refreshDriveTracks = async () => {
    if (!authService.getAccessToken()) return;
    try {
      setIsLoadingDrive(true);
      const structure = await driveService.getMimusicaStructure(false);
      if (structure.exists && structure.allTracks.length > 0) {
        setTracks(structure.allTracks);
        audioEngine.setQueue(structure.allTracks, 0, false);
      }
    } catch (err) {
      console.warn('Could not auto-refresh /mimusica tracks:', err);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  return (
    <div 
      id="app-root"
      className="relative w-screen h-screen overflow-hidden bg-[#03060d] text-white flex flex-col items-center justify-center select-none antialiased"
    >
      {/* Living Space Background with Drifting Stars, Distant Planets, Comets & Cosmic Clouds */}
      <SpaceBackground />

      {/* Retro Sci-Fi UFO flying banner passing by occasionally */}
      <UfoBanner />

      {/* Pure Central Focus: The Terrestrial Spherical Player with Eclipse Neon Corona */}
      <main className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4 pointer-events-none">
        <SphericalPlayer
          playerState={playerState}
          user={user}
          tracks={tracks}
          folders={folders}
          onTracksChange={(newTracks) => setTracks(newTracks)}
          onFoldersChange={(newFolders) => setFolders(newFolders)}
          isLoadingDrive={isLoadingDrive}
          setIsLoadingDrive={setIsLoadingDrive}
        />
      </main>
    </div>
  );
}

export default App;
