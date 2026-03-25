'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return;
    }

    // Set up message listener FIRST (before registration)
    // This ensures we can respond to token requests immediately
    const messageHandler = (event: MessageEvent) => {
      if (event.data.type === 'GET_VIDEO_TOKEN') {
        const { videoId } = event.data;
        console.log('[Page] Service Worker requesting token for:', videoId);

        // Get token from sessionStorage
        const token = sessionStorage.getItem(`video_token_${videoId}`);

        if (token) {
          console.log('[Page] Token found in sessionStorage, sending to Service Worker');
          event.ports[0].postMessage({ token });
        } else {
          console.error('[Page] No token found in sessionStorage for:', videoId);
          console.log('[Page] Available sessionStorage keys:', Object.keys(sessionStorage));
          event.ports[0].postMessage({ error: 'No token available' });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', messageHandler);
    console.log('[Page] Message listener registered');

    // Check if we have a controller (Service Worker is already active)
    if (navigator.serviceWorker.controller) {
      console.log('Service Worker already controlling this page');
    } else {
      console.log('No Service Worker controller yet, registering...');
    }

    // Register Service Worker
    navigator.serviceWorker
      .register('/video-sw.js')
      .then(async (registration) => {
        console.log('Service Worker registered:', registration.scope);

        // Check if there's an update installing
        if (registration.installing || registration.waiting) {
          console.log('New Service Worker version detected, waiting for activation...');

          const handleStateChange = () => {
            if (registration.waiting) {
              // New version waiting, skip waiting and activate
              console.log('New Service Worker waiting, activating...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          };

          if (registration.installing) {
            registration.installing.addEventListener('statechange', handleStateChange);
          }
          if (registration.waiting) {
            handleStateChange();
          }

          // Wait for controller change (new SW taking over)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New Service Worker took control, reloading page...');
            window.location.reload();
          });
        }

        // Wait for it to become active
        await navigator.serviceWorker.ready;
        console.log('Service Worker is ready');

        // If this is a new registration and we don't have a controller yet,
        // the page needs to be reloaded for the SW to control it
        if (!navigator.serviceWorker.controller) {
          console.log('Service Worker registered for first time, reloading page...');
          window.location.reload();
          return;
        }

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('Service Worker activated');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });

    // Cleanup function to remove listener when component unmounts
    return () => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
      console.log('[Page] Message listener removed');
    };
  }, []);

  return null; // This component doesn't render anything
}
