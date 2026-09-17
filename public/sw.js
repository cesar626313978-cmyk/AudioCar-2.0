/**
 * AudioCar High-Performance Service Worker & Audio Relay
 * Compliant with Google Drive Mobility Streaming Architecture:
 * 1. Auth Relay: Dynamically injects Authorization: Bearer token for stream requests
 * 2. WebKit (Safari/iOS) 206 Partial Content Synthetic Handler for Range Requests
 * 3. Offline Audio Cache ('gdrive-offline-audio-v1') with Range-slicing
 * 4. Stale-While-Revalidate & Network-First caching for application assets
 */

const APP_CACHE_NAME = 'audiocar-app-v4';
const OFFLINE_AUDIO_CACHE = 'gdrive-offline-audio-v1';
let oauthToken = '';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/audiocar-logo.svg'
];

// 1. Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((e) => {
        console.warn('[Service Worker] Asset pre-cache partial notice:', e);
      });
    })
  );
});

// 2. Activate Event & Token Recovery
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => {
      return cache.match('/oauth-token').then((response) => {
        if (response) {
          return response.text().then((token) => {
            if (token && token.trim()) {
              oauthToken = token.trim();
              console.log('[Service Worker] Stored OAuth token restored successfully.');
            }
          });
        }
      });
    }).then(() => {
      return caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== APP_CACHE_NAME && key !== OFFLINE_AUDIO_CACHE) {
              return caches.delete(key);
            }
          })
        );
      });
    }).then(() => self.clients.claim())
  );
});

// 3. Client Message Handler
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SET_TOKEN') {
    oauthToken = (event.data.token || '').trim();
    if (oauthToken) {
      event.waitUntil(
        caches.open(APP_CACHE_NAME).then((cache) => {
          return cache.put('/oauth-token', new Response(oauthToken));
        }).then(() => {
          console.log('[Service Worker] OAuth token securely synced and persisted.');
        })
      );
    }
  }

  if (event.data.type === 'CLEAR_TOKEN') {
    oauthToken = '';
    event.waitUntil(
      caches.open(APP_CACHE_NAME).then((cache) => cache.delete('/oauth-token'))
    );
  }
});

// 4. Fetch Event Interceptor
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. Intercept Virtual Stream Route: /stream/:fileId (CORS-free local proxy)
  if (url.pathname.startsWith('/stream/')) {
    const fileId = url.pathname.replace('/stream/', '').split('?')[0];
    const targetUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    event.respondWith(handleGDriveStreamingRequest(targetUrl, event.request));
    return;
  }

  // B. Intercept Direct Google Drive API media streams
  if (url.hostname === 'www.googleapis.com' && url.pathname.includes('/drive/v3/files/') && url.search.includes('alt=media')) {
    event.respondWith(handleGDriveStreamingRequest(event.request.url, event.request));
    return;
  }

  // C. Pass-through for Google Auth/Discovery endpoints
  if (
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('googleusercontent.com')
  ) {
    return;
  }

  // D. Network-First for HTML/Navigation
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const responseToCache = response.clone();
            caches.open(APP_CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // E. Stale-While-Revalidate for app assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(APP_CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

/**
 * High-performance streaming relay with synthetic HTTP 206 Partial Content response generator
 * Resolves WebKit (Safari/iOS) Range Request bug and enables seamless seeking & 4G/5G resilience
 * Integrates Full Jitter Exponential Backoff for Google Drive 403/429 Weighted Units Quota.
 */
async function handleGDriveStreamingRequest(targetUrl, originalRequest) {
  const offlineCache = await caches.open(OFFLINE_AUDIO_CACHE);
  
  // 1. Check if audio exists in local offline cache
  const cachedResponse = await offlineCache.match(targetUrl, { ignoreSearch: true });
  if (cachedResponse) {
    console.log('[Service Worker] Serving stream from offline cache:', targetUrl);
    if (originalRequest.headers.has('range')) {
      return generateSynthetic206Response(originalRequest, cachedResponse);
    }
    return cachedResponse;
  }

  // 2. Resolve authentication token
  let token = oauthToken;
  if (!token) {
    const appCache = await caches.open(APP_CACHE_NAME);
    const tokenResp = await appCache.match('/oauth-token');
    if (tokenResp) {
      token = (await tokenResp.text()).trim();
      oauthToken = token;
    }
  }

  // If no token, return informative 401 response
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'No autorizado. Token de Google Drive ausente en Service Worker.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // 3. Inject Bearer token and forward Range headers
  const headers = new Headers(originalRequest.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const proxiedRequest = new Request(targetUrl, {
    method: 'GET',
    headers: headers,
    mode: 'cors',
    credentials: 'omit'
  });

  // 4. Exponential backoff with Full Jitter for 403 / 429 quota handling
  const MAX_RETRIES = 4;
  const BASE_DELAY = 1000;
  const MAX_DELAY = 16000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const networkResponse = await fetch(proxiedRequest);

      // Check if retryable quota or server error
      if (
        (networkResponse.status === 429 || networkResponse.status === 403 || networkResponse.status >= 500) &&
        attempt < MAX_RETRIES
      ) {
        const exponentialDelay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
        const jittered = Math.floor(200 + Math.random() * (exponentialDelay - 200));
        console.warn(`[SW Backoff] Drive stream hit status ${networkResponse.status}, retrying in ${jittered}ms (Attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, jittered));
        continue;
      }

      // If HTTP 200 (Full content), store in offline cache in background for instant playback and 206 slicing
      if (networkResponse.status === 200) {
        const clone = networkResponse.clone();
        offlineCache.put(targetUrl, clone).catch((err) => {
          console.warn('[Service Worker] Could not cache audio stream:', err);
        });
        return networkResponse;
      }

      return networkResponse;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const exponentialDelay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
        const jittered = Math.floor(200 + Math.random() * (exponentialDelay - 200));
        console.warn(`[SW Backoff] Network error during stream fetch, retrying in ${jittered}ms:`, error);
        await new Promise((r) => setTimeout(r, jittered));
      } else {
        console.error('[Service Worker] Streaming fetch error after retries:', error);
        return new Response(
          JSON.stringify({ error: 'Fallo de conexión en streaming de audio.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
  }

  return new Response(
    JSON.stringify({ error: 'Límite de cuota o error de red en Google Drive.' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Synthetic HTTP 206 Partial Content Generator (RFC 7233 compliant)
 * Extracts range bytes, slices ArrayBuffer, and constructs Content-Range header
 */
async function generateSynthetic206Response(request, fullResponse) {
  const rangeHeader = request.headers.get('range');
  const arrayBuffer = await fullResponse.arrayBuffer();
  const totalLength = arrayBuffer.byteLength;

  if (!rangeHeader) {
    return new Response(arrayBuffer, {
      status: 200,
      headers: fullResponse.headers
    });
  }

  // Regex pattern matches "bytes=start-end" or "bytes=start-"
  const bytesMatch = /^bytes\=(\d+)\-(\d+)?$/i.exec(rangeHeader);

  if (bytesMatch) {
    const start = parseInt(bytesMatch[1], 10);
    const end = bytesMatch[2] ? parseInt(bytesMatch[2], 10) : totalLength - 1;

    // Safeguards against buffer overflow
    const safeEnd = Math.min(end, totalLength - 1);
    if (start >= totalLength || start > safeEnd) {
      return new Response(null, {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: {
          'Content-Range': `bytes */${totalLength}`
        }
      });
    }

    const chunkLength = (safeEnd - start) + 1;
    const slicedBuffer = arrayBuffer.slice(start, safeEnd + 1);

    const responseHeaders = new Headers(fullResponse.headers);
    responseHeaders.set('Content-Range', `bytes ${start}-${safeEnd}/${totalLength}`);
    responseHeaders.set('Content-Length', String(chunkLength));
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Content-Type', fullResponse.headers.get('Content-Type') || 'audio/mpeg');

    return new Response(slicedBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: responseHeaders
    });
  }

  return new Response(null, {
    status: 416,
    statusText: 'Range Not Satisfiable',
    headers: {
      'Content-Range': `bytes */${totalLength}`
    }
  });
}
