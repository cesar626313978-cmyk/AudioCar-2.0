/**
 * Service Worker Manager for AudioCar
 * Handles registration, token synchronization with SW Auth Relay,
 * and offline buffer coordination.
 */

class ServiceWorkerService {
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW Service] Service Worker registered with scope:', this.registration.scope);

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Service] Controller changed, updating token sync...');
        this.resyncStoredToken();
      });

      // Attempt immediate token sync from localStorage
      this.resyncStoredToken();
    } catch (err) {
      console.warn('[SW Service] Failed to register Service Worker:', err);
    }
  }

  public syncToken(token: string): void {
    if (!token) return;

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_TOKEN',
        token: token.trim()
      });
      console.log('[SW Service] OAuth token posted to Service Worker controller.');
    } else if (this.registration && this.registration.active) {
      this.registration.active.postMessage({
        type: 'SET_TOKEN',
        token: token.trim()
      });
    }
  }

  public clearToken(): void {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_TOKEN' });
    }
  }

  private resyncStoredToken(): void {
    try {
      const stored = localStorage.getItem('tesladrive_auth_session');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.accessToken && user.expiresAt && user.expiresAt > Date.now()) {
          this.syncToken(user.accessToken);
        }
      }
    } catch (e) {
      console.warn('[SW Service] Stored token parse notice:', e);
    }
  }
}

export const swService = new ServiceWorkerService();
