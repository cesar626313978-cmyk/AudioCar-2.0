import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './services/swService';

// Global resilience listeners to prevent vehicle webview crashes or reload loops
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.warn('[AudioCar Safety Guard] Caught global error:', event.message || event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[AudioCar Safety Guard] Caught unhandled rejection:', event.reason);
    // Prevent default browser crash behavior
    event.preventDefault();
  });

  // Tesla MCU browser safety: Prevent contextmenu & auxclick (middle-click / multi-finger press) from opening duplicate browser tabs
  window.addEventListener('contextmenu', (event) => {
    // Only allow contextmenu if target is explicitly an input or textarea
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('auxclick', (event) => {
    // Block middle clicks from opening new tabs
    event.preventDefault();
  }, { passive: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
