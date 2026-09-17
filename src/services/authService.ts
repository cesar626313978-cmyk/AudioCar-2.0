/**
 * Google Authentication Service (Firebase Auth + Google Identity Services)
 * Manages OAuth 2.0 Access Tokens for Google Drive API v3
 * Configured with the official Cloud Project OAuth Client ID
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  User 
} from 'firebase/auth';
import { AudioTrack, DriveAuthUser } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { swService } from './swService';

declare global {
  interface Window {
    google?: any;
  }
}

const AUTH_STORAGE_KEY = 'tesladrive_auth_session';
const CLIENT_ID_KEY = 'tesladrive_custom_client_id';

// Primary provisioned client ID matching the applet Cloud Project
const DEFAULT_CLIENT_ID =
  (firebaseConfig as any).oAuthClientId ||
  ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) ||
  '1094273500016-jj1hfi1cv2p7ihqsvakmprpevd38ldau.apps.googleusercontent.com';

// Scopes adhere strictly to the Principle of Least Privilege:
// drive.readonly + drive.file allows read-only music streaming without any destructive access
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Initialize Firebase App instance safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

type AuthListener = (user: DriveAuthUser | null) => void;

class AuthService {
  private currentUser: DriveAuthUser | null = null;
  private tokenClient: any = null;
  private listeners: Set<AuthListener> = new Set();
  private isSigningIn = false;
  private isRefreshingToken = false;
  private pendingAuthResolve: ((user: DriveAuthUser) => void) | null = null;
  private pendingAuthReject: ((err: any) => void) | null = null;
  private autoRefreshTimer: any = null;

  constructor() {
    this.loadPersistedSession();
    this.setupFirebaseListener();
    this.startAutoRefreshLoop();
  }

  private setupFirebaseListener() {
    onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (!firebaseUser && !this.currentUser) {
        this.notifyListeners();
      }
    });
  }

  private startAutoRefreshLoop() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
    // Check every 5 minutes if token is expiring in less than 15 minutes
    this.autoRefreshTimer = setInterval(() => {
      this.checkAndRefreshSilently();
    }, 5 * 60 * 1000);

    // Also check on window focus/visibility
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkAndRefreshSilently();
        }
      });
    }
  }

  private async checkAndRefreshSilently() {
    if (!this.currentUser || this.currentUser.isManual || this.isRefreshingToken) return;

    const timeRemaining = this.currentUser.expiresAt - Date.now();
    // Refresh proactively if less than 15 minutes left or already expired
    if (timeRemaining < 15 * 60 * 1000) {
      console.log(`[AuthService] Token expiring in ${Math.round(timeRemaining / 60000)} min. Triggering silent refresh...`);
      await this.refreshAccessTokenSilently().catch((e) => {
        console.warn('[AuthService] Proactive silent refresh notice:', e);
      });
    }
  }

  private loadPersistedSession() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const user = JSON.parse(stored) as DriveAuthUser & { isManual?: boolean };
        if (user && user.email) {
          // Retain user identity even across browser sessions and offline driving
          this.currentUser = user;
          // If token has expired, trigger background refresh when GIS is ready
          if (!user.expiresAt || user.expiresAt <= Date.now()) {
            setTimeout(() => this.checkAndRefreshSilently(), 1500);
          }
        }
      }
    } catch (e) {
      console.warn('Could not parse stored session:', e);
    }
  }

  public getClientId(): string {
    const custom = localStorage.getItem(CLIENT_ID_KEY);
    if (custom) return custom;
    if ((firebaseConfig as any).oAuthClientId) return (firebaseConfig as any).oAuthClientId;
    return ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_CLIENT_ID;
  }

  public setClientId(clientId: string) {
    if (clientId.trim()) {
      localStorage.setItem(CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(CLIENT_ID_KEY);
    }
    this.tokenClient = null;
  }

  /**
   * Silent background token refresh using Google Identity Services (prompt: '')
   * Renews access token seamlessly without opening popups or interrupting audio.
   */
  public async refreshAccessTokenSilently(): Promise<string | null> {
    if (this.isRefreshingToken) {
      // If already in progress, wait for completion
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isRefreshingToken) {
            clearInterval(checkInterval);
            resolve(this.currentUser?.accessToken || null);
          }
        }, 300);
      });
    }

    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      return this.currentUser?.accessToken || null;
    }

    const current = this.currentUser;
    if (!current || current.isManual) {
      return current?.accessToken || null;
    }

    this.isRefreshingToken = true;

    try {
      return await new Promise<string | null>((resolve) => {
        const clientId = this.getClientId();
        const silentClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES.join(' '),
          prompt: '', // Silent refresh without popup or account picker
          hint: current.email || undefined,
          callback: async (tokenResponse: any) => {
            this.isRefreshingToken = false;
            if (tokenResponse && tokenResponse.access_token) {
              const expiresInSec = tokenResponse.expires_in || 3600;
              const expiresAt = Date.now() + expiresInSec * 1000 - 60000;

              const updatedUser: DriveAuthUser = {
                ...current,
                accessToken: tokenResponse.access_token,
                expiresAt
              };

              this.currentUser = updatedUser;
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
              this.notifyListeners();
              console.log('[AuthService] Silent token refresh succeeded. Valid for', Math.round(expiresInSec / 60), 'min.');
              resolve(tokenResponse.access_token);
            } else {
              console.warn('[AuthService] Silent refresh received no token:', tokenResponse?.error);
              resolve(this.currentUser?.accessToken || null);
            }
          },
          error_callback: (err: any) => {
            this.isRefreshingToken = false;
            console.warn('[AuthService] Silent token refresh error (offline or consent needed):', err);
            // Keep existing token so offline/cached audio keeps playing without disconnect screen
            resolve(this.currentUser?.accessToken || null);
          }
        });

        silentClient.requestAccessToken({ prompt: '' });
      });
    } catch (err) {
      this.isRefreshingToken = false;
      console.warn('[AuthService] Failed to execute silent refresh:', err);
      return this.currentUser?.accessToken || null;
    }
  }

  /**
   * Primary Sign-In Method:
   * 1. Uses Firebase Auth (signInWithPopup with GoogleAuthProvider) as the primary,
   *    fully-authorized mechanism for Google Workspace in AI Studio preview & production.
   * 2. Catches user cancellations (popup closed by user) cleanly without treating them
   *    as unhandled crashes or throwing console.error.
   * 3. Falls back to Google Identity Services (GIS) if Firebase Auth encounters an environment issue.
   */
  public async requestSignIn(): Promise<DriveAuthUser> {
    if (this.isSigningIn) {
      throw new Error('Ya hay un proceso de inicio de sesión en curso.');
    }

    this.isSigningIn = true;

    try {
      // 1. Primary Authentication: Firebase Auth
      return await this.signInWithFirebaseAuth();
    } catch (firebaseErr: any) {
      // Check if user simply closed or cancelled the popup
      const isPopupClosedByUser =
        firebaseErr?.code === 'auth/popup-closed-by-user' ||
        firebaseErr?.code === 'auth/cancelled-popup-request' ||
        firebaseErr?.message?.toLowerCase().includes('popup-closed-by-user') ||
        firebaseErr?.message?.toLowerCase().includes('popup window closed') ||
        firebaseErr?.message?.toLowerCase().includes('closed-by-user');

      if (isPopupClosedByUser) {
        console.warn('[AuthService] User closed the Google Auth popup window.');
        throw new Error('Inicio de sesión cancelado. Puedes volver a intentarlo cuando desees.');
      }

      console.warn('[AuthService] Firebase Auth sign-in failed, attempting GIS fallback...', firebaseErr?.message || firebaseErr);

      // 2. Fallback: Google Identity Services (GIS) Token Client if available
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        try {
          return await this.signInWithGIS();
        } catch (gisErr: any) {
          const isGisClosed =
            gisErr?.message?.toLowerCase().includes('closed') ||
            gisErr?.message?.toLowerCase().includes('cancelad') ||
            gisErr?.type === 'popup_closed';

          if (isGisClosed) {
            console.warn('[AuthService] GIS popup closed by user.');
            throw new Error('Inicio de sesión cancelado. Puedes volver a intentarlo cuando desees.');
          }
          throw gisErr;
        }
      }

      throw firebaseErr;
    } finally {
      this.isSigningIn = false;
    }
  }

  /**
   * Firebase Auth sign-in with Google Provider and explicit prompt: 'select_account'
   */
  private async signInWithFirebaseAuth(): Promise<DriveAuthUser> {
    const provider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error('No se recibió el token de acceso OAuth desde Google.');
    }

    const user: DriveAuthUser = {
      accessToken,
      expiresAt: Date.now() + 3600 * 1000 - 60000,
      email: result.user.email || 'usuario@google.com',
      name: result.user.displayName || 'Conductor AudioCar',
      picture: result.user.photoURL || ''
    };

    this.currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    this.notifyListeners();
    return user;
  }

  /**
   * Fallback: Google Identity Services (GIS) Token Client
   */
  private async signInWithGIS(): Promise<DriveAuthUser> {
    return new Promise<DriveAuthUser>((resolve, reject) => {
      this.pendingAuthResolve = resolve;
      this.pendingAuthReject = reject;

      const initialized = this.initTokenClient();
      if (initialized && this.tokenClient) {
        try {
          this.tokenClient.requestAccessToken({ prompt: 'select_account' });
          return;
        } catch (gisErr) {
          console.warn('[AuthService] GIS requestAccessToken error:', gisErr);
          this.pendingAuthResolve = null;
          this.pendingAuthReject = null;
          reject(gisErr);
        }
      } else {
        this.pendingAuthResolve = null;
        this.pendingAuthReject = null;
        reject(new Error('Google Identity Services no está disponible en este momento.'));
      }
    });
  }

  public initTokenClient(callback?: (user: DriveAuthUser) => void): boolean {
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      return false;
    }

    const clientId = this.getClientId();

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error) {
            console.warn('[AuthService] GIS notice:', tokenResponse.error);
            if (this.pendingAuthReject) {
              this.pendingAuthReject(new Error(tokenResponse.error_description || tokenResponse.error));
              this.pendingAuthReject = null;
              this.pendingAuthResolve = null;
            }
            return;
          }

          if (tokenResponse && tokenResponse.access_token) {
            const expiresInSec = tokenResponse.expires_in || 3600;
            const expiresAt = Date.now() + expiresInSec * 1000 - 60000;

            const profile = await this.fetchUserProfile(tokenResponse.access_token);

            const user: DriveAuthUser = {
              accessToken: tokenResponse.access_token,
              expiresAt,
              email: profile.email || 'usuario@google.com',
              name: profile.name || 'Conductor AudioCar',
              picture: profile.picture || ''
            };

            this.currentUser = user;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
            this.notifyListeners();

            if (this.pendingAuthResolve) {
              this.pendingAuthResolve(user);
              this.pendingAuthResolve = null;
              this.pendingAuthReject = null;
            }

            if (callback) callback(user);
          }
        },
        error_callback: (err: any) => {
          const isClosed =
            err?.type === 'popup_closed' ||
            err?.message?.toLowerCase().includes('closed') ||
            err === 'popup_closed';

          if (isClosed) {
            console.warn('[AuthService] Google Auth popup closed by user:', err);
          } else {
            console.warn('[AuthService] Google Auth notice:', err);
          }

          if (this.pendingAuthReject) {
            this.pendingAuthReject(new Error(err?.message || err?.error || 'Inicio de sesión cancelado'));
            this.pendingAuthReject = null;
            this.pendingAuthResolve = null;
          }
        }
      });
      return true;
    } catch (err) {
      console.warn('[AuthService] Failed to initTokenClient:', err);
      return false;
    }
  }

  private async fetchUserProfile(accessToken: string): Promise<{ email?: string; name?: string; picture?: string }> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
    }
    return {};
  }

  public setDirectSession(accessToken: string, email: string = 'conductor@audiocar.drive', name: string = 'Conductor Conectado') {
    const user: DriveAuthUser & { isManual: boolean } = {
      accessToken,
      email,
      name,
      expiresAt: Date.now() + 3600 * 1000 * 24, // 24h for manual developer tokens
      isManual: true
    };
    this.currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    this.notifyListeners();
  }

  public async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }

    if (this.currentUser?.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.currentUser.accessToken, () => {
          console.log('Access token revoked');
        });
      } catch (e) {
        console.warn('Error revoking token:', e);
      }
    }
    this.currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    swService.clearToken();
    this.notifyListeners();
  }

  public getUser(): DriveAuthUser | null {
    if (this.currentUser) {
      // If expired or about to expire, trigger background refresh
      if (this.currentUser.expiresAt && this.currentUser.expiresAt <= Date.now() + 10 * 60 * 1000) {
        this.checkAndRefreshSilently().catch(() => {});
      }
      return this.currentUser;
    }
    return null;
  }

  public getAccessToken(): string | null {
    const user = this.getUser();
    return user ? user.accessToken : null;
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (!this.currentUser) return null;
    if (this.currentUser.expiresAt && this.currentUser.expiresAt <= Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessTokenSilently().catch(() => {});
    }
    return this.currentUser?.accessToken || null;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getUser());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const user = this.getUser();
    if (user?.accessToken) {
      swService.syncToken(user.accessToken);
    }
    this.listeners.forEach((listener) => listener(user));
  }
}

export const authService = new AuthService();
