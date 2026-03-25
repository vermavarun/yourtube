// Service Worker for secure video streaming
// Intercepts video requests and adds authentication token from sessionStorage

const CACHE_NAME = 'video-sw-v5'; // FIXED: Force same-origin mode to allow custom headers!
const VIDEO_API_PATTERN = /\/api\/video\/[^?]+/;

// Install event - activate immediately
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event - claim all clients immediately
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    self.clients.claim()
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

// Fetch event - intercept video requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  console.log('[Service Worker] Fetch event:', url.pathname);

  // Only intercept /api/video/* requests
  if (!VIDEO_API_PATTERN.test(url.pathname)) {
    console.log('[Service Worker] Not a video request, letting through');
    return; // Don't call event.respondWith, let browser handle it normally
  }

  // Don't intercept requests that already have the auth header (from our own fetch)
  if (event.request.headers.has('X-Video-Token')) {
    console.log('[Service Worker] Skipping intercept - request already has token');
    return; // Don't call event.respondWith, let browser handle it normally
  }

  console.log('[Service Worker] Matched video API pattern, intercepting...');
  event.respondWith(handleVideoRequest(event.request));
});

async function handleVideoRequest(request) {
  try {
    const url = new URL(request.url);
    const encryptedId = url.pathname.split('/').pop();

    console.log('[Service Worker] Intercepting video request:', encryptedId);

    // Get all clients (browser tabs/windows)
    const clients = await self.clients.matchAll({ type: 'window' });

    if (clients.length === 0) {
      console.error('[Service Worker] No clients available');
      return new Response('No client available', { status: 500 });
    }

    // Request token from the client with retry logic
    const client = clients[0];

    const getTokenWithRetry = async (retries = 3, delay = 200) => {
      for (let i = 0; i < retries; i++) {
        try {
          const messageChannel = new MessageChannel();

          const tokenPromise = new Promise((resolve, reject) => {
            messageChannel.port1.onmessage = (event) => {
              if (event.data.token) {
                resolve(event.data.token);
              } else {
                reject(new Error(event.data.error || 'No token received'));
              }
            };

            // Timeout after 2 seconds per attempt
            setTimeout(() => reject(new Error('Token request timeout')), 2000);
          });

          // Ask client for token
          client.postMessage(
            { type: 'GET_VIDEO_TOKEN', videoId: encryptedId },
            [messageChannel.port2]
          );

          const token = await tokenPromise;
          console.log('[Service Worker] Token received on attempt', i + 1);
          return token;

        } catch (error) {
          console.log(`[Service Worker] Token attempt ${i + 1} failed:`, error.message);
          if (i < retries - 1) {
            console.log(`[Service Worker] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }
    };

    const token = await getTokenWithRetry();
    console.log('[Service Worker] Token received, making authenticated request');
    console.log('[Service Worker] Token preview:', token.substring(0, 30) + '...');

    // Create new request with token in header
    const headers = new Headers(request.headers);
    headers.set('X-Video-Token', token);

    // Log all headers being sent
    console.log('[Service Worker] Request headers:');
    for (let [key, value] of headers) {
      console.log(`  ${key}: ${key === 'X-Video-Token' ? value.substring(0, 20) + '...' : value}`);
    }

    // Remove any token from query string
    const cleanUrl = url.origin + url.pathname;
    console.log('[Service Worker] Request URL:', cleanUrl);

    const authenticatedRequest = new Request(cleanUrl, {
      method: request.method,
      headers: headers,
      mode: 'same-origin', // Force same-origin mode to allow custom headers
      credentials: 'same-origin', // Include credentials for same-origin
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      integrity: request.integrity,
    });

    // Fetch with authentication
    const response = await fetch(authenticatedRequest);
    console.log('[Service Worker] Response received:', response.status);

    return response;

  } catch (error) {
    console.error('[Service Worker] Error handling video request:', error);
    return new Response(`Service Worker Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
