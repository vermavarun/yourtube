import { NextRequest, NextResponse } from 'next/server';
import { decryptVideoId } from '@/lib/encryption';
import { verifyVideoToken } from '@/lib/token';

const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5000';
const API_SHARED_SECRET = process.env.API_SHARED_SECRET || 'shared-secret';

// Helper to check if request expects HTML response (browser vs video player)
function expectsHtml(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

// Custom HTML error page for direct browser access
function getErrorHtml(title: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 60px 40px;
          text-align: center;
          max-width: 500px;
          margin: 20px;
        }
        .error-code {
          font-size: 120px;
          font-weight: 700;
          color: #667eea;
          line-height: 1;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #2d3748;
        }
        p {
          font-size: 16px;
          color: #718096;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .icon {
          font-size: 80px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🔒</div>
        <div class="error-code">404</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/" class="btn">Go to Homepage</a>
      </div>
    </body>
    </html>
  `;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const encryptedId = params.id;

    // FIRST: Check if this is a direct browser access (before any other checks)
    // Direct browser access has no referer header and expects HTML
    const referer = request.headers.get('referer');
    const accept = request.headers.get('accept') || '';

    // If no referer AND requesting HTML, it's a direct browser access - block immediately
    if (!referer && accept.includes('text/html')) {
      console.log('[API] Direct browser access detected, showing error page');
      return new NextResponse(
        getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('[API] Request received for video:', encryptedId);
    console.log('[API] Request headers:', {
      referer: referer,
      host: request.headers.get('host'),
      accept: accept.substring(0, 50),
      'x-video-token': request.headers.get('X-Video-Token') ? 'present' : 'missing',
      'user-agent': request.headers.get('user-agent')?.substring(0, 50)
    });

    // Security Layer 1: Check Referer header (relaxed for localhost development)
    const host = request.headers.get('host');

    // In development, allow localhost requests
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment && (!referer || !referer.includes(`${host}/watch`))) {
      console.error('Referer check failed:', { referer, host });

      if (expectsHtml(request)) {
        return new NextResponse(
          getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }

      return NextResponse.json(
        { error: 'Direct access not allowed' },
        { status: 403 }
      );
    }

    // Security Layer 2: Verify the access token (header for SW, query for fallback)
    const url = new URL(request.url);
    const token = request.headers.get('X-Video-Token') || url.searchParams.get('t');

    if (!token) {
      console.error('[API] No token provided in header or query');
      console.error('[API] All headers:', Array.from(request.headers.entries()));

      if (expectsHtml(request)) {
        return new NextResponse(
          getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }

      return NextResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    console.log('[API] Token found, validating for video:', encryptedId);

    const isValidToken = await verifyVideoToken(token, encryptedId);
    if (!isValidToken) {
      console.error('[API] Invalid token');

      if (expectsHtml(request)) {
        return new NextResponse(
          getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }

      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    console.log('Token validated, decrypting video ID');

    const videoId = decryptVideoId(encryptedId);

    if (!videoId) {
      console.error('Failed to decrypt video ID');

      if (expectsHtml(request)) {
        return new NextResponse(
          getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }

      return NextResponse.json(
        { error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    console.log('Forwarding request to .NET API for video:', videoId);

    // Get range header from client request
    const range = request.headers.get('range');
    if (range) {
      console.log('Range request:', range);
    }

    // Prepare headers for .NET API request
    const headers: HeadersInit = {
      'X-API-Secret': API_SHARED_SECRET,
      'X-Video-Id': videoId,
    };

    if (range) {
      headers['Range'] = range;
    }

    // Forward request to .NET API
    const apiUrl = `${DOTNET_API_URL}/api/video/${videoId}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (expectsHtml(request)) {
        return new NextResponse(
          getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch video' },
        { status: response.status }
      );
    }

    // Get response headers
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    // Stream the video data
    const body = response.body;

    if (!body) {
      if (expectsHtml(request)) {
        return new NextResponse(
          getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }

      return NextResponse.json(
        { error: 'No video data' },
        { status: 500 }
      );
    }

    // Prepare response headers
    const responseHeaders: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    };

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    if (acceptRanges) {
      responseHeaders['Accept-Ranges'] = acceptRanges;
    }

    // Return appropriate status code
    const status = range && contentRange ? 206 : 200;

    return new NextResponse(body, {
      status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Video proxy error:', error);

    if (expectsHtml(request)) {
      return new NextResponse(
        getErrorHtml('Nothing Found', 'The content you are looking for does not exist or cannot be accessed directly.'),
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
