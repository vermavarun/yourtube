'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function VideoPlayer() {
  const searchParams = useSearchParams();
  const encryptedId = searchParams.get('v');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [swReady, setSwReady] = useState(false);
  const [useTokenFallback, setUseTokenFallback] = useState(false);

  // Check if Service Worker is ready
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported, using fallback');
      setUseTokenFallback(true);
      setSwReady(true);
      return;
    }

    const checkServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active && navigator.serviceWorker.controller) {
          console.log('Service Worker is ready and controlling page');
          setSwReady(true);
        } else {
          console.log('Waiting for Service Worker to control page...');
          // Wait a bit and check again
          setTimeout(checkServiceWorker, 100);
        }
      } catch (err) {
        console.error('Service Worker check failed:', err);
        setUseTokenFallback(true);
        setSwReady(true);
      }
    };

    // Set a timeout - if SW not ready in 5 seconds, fallback
    const fallbackTimeout = setTimeout(() => {
      if (!swReady) {
        console.warn('Service Worker timeout, using token in URL fallback');
        setUseTokenFallback(true);
        setSwReady(true);
      }
    }, 5000);

    checkServiceWorker();

    return () => clearTimeout(fallbackTimeout);
  }, [swReady]);

  useEffect(() => {
    if (!encryptedId) return;

    console.log('Generating token for video:', encryptedId);

    // Generate access token
    fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: encryptedId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          console.log('Token received:', data.token.substring(0, 20) + '...');

          // Store token in sessionStorage FIRST
          sessionStorage.setItem(`video_token_${encryptedId}`, data.token);

          // Verify it's stored
          const storedToken = sessionStorage.getItem(`video_token_${encryptedId}`);
          if (storedToken === data.token) {
            console.log('Token stored in sessionStorage successfully');
            // Small delay to ensure everything is ready
            setTimeout(() => {
              setToken(data.token);
            }, 100);
          } else {
            console.error('Failed to store token in sessionStorage');
            setError('Failed to initialize video');
          }
        } else {
          console.error('No token in response:', data);
          setError('Failed to get access token');
        }
      })
      .catch((err) => {
        console.error('Token fetch error:', err);
        setError('Failed to initialize video');
      });
  }, [encryptedId]);

  useEffect(() => {
    if (!videoRef.current || !token || !encryptedId || !swReady) {
      if (!swReady) {
        console.log('Waiting for Service Worker to be ready...');
      }
      return;
    }

    const video = videoRef.current;

    // Verify token is in sessionStorage before proceeding
    const storedToken = sessionStorage.getItem(`video_token_${encryptedId}`);
    if (!storedToken) {
      console.error('Token not found in sessionStorage, waiting...');
      return;
    }

    if (useTokenFallback) {
      console.log('Using token in URL (fallback mode)');
      // Fallback: Include token in URL if Service Worker not available
      video.src = `/api/video/${encryptedId}?t=${token}`;
    } else {
      console.log('Service Worker ready, using secure mode (token in header)');
      console.log('Token verified in sessionStorage');
      // Secure mode: Clean URL, Service Worker adds token in header
      video.src = `/api/video/${encryptedId}`;
    }

    video.onloadedmetadata = () => {
      console.log('Video metadata loaded, duration:', video.duration);
      setLoading(false);
    };

    video.onerror = (e) => {
      console.error('Video error:', e);
      setError('Failed to load video');
      setLoading(false);
    };

    video.onloadstart = () => {
      console.log('Video loading started');
    };

    video.oncanplay = () => {
      console.log('Video can play');
    };

  }, [token, encryptedId, swReady, useTokenFallback]);

  if (!encryptedId) {
    return <div style={{ padding: '20px' }}>No video specified</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: '#ff4444' }}>{error}</div>;
  }

  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {loading && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div>Loading video...</div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            Service Worker: {swReady ? '✓' : '⏳'} | Token: {token ? '✓' : '⏳'}
            {useTokenFallback && <div style={{ color: '#ff9800', marginTop: '5px' }}>⚠️ Fallback mode (token visible)</div>}
          </div>
        </div>
      )}
      <div style={{
        backgroundColor: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '20px',
        position: 'relative',
        display: loading ? 'none' : 'block'
      }}>
        <video
          ref={videoRef}
          controls
          controlsList="nodownload"
          disablePictureInPicture
          style={{ width: '100%', display: 'block' }}
          preload="metadata"
          onContextMenu={(e) => e.preventDefault()}
        >
          Your browser does not support the video tag.
        </video>
        {/* Overlay to prevent right-click */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '50px', // Leave space for controls
            pointerEvents: 'none'
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <div style={{
        backgroundColor: '#282828',
        padding: '20px',
        borderRadius: '12px'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Video Title</h1>
        <p style={{ color: '#aaaaaa', fontSize: '14px' }}>
          This video is being streamed using range requests for efficient delivery of large files.
        </p>
        <p style={{ color: '#606060', fontSize: '12px', marginTop: '10px' }}>
          Encrypted ID: {encryptedId.substring(0, 20)}...
        </p>
      </div>
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
      <VideoPlayer />
    </Suspense>
  );
}
