import { NextRequest, NextResponse } from 'next/server';
import { decryptVideoId } from '@/lib/encryption';
import { verifyVideoToken } from '@/lib/token';

const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5000';
const API_SHARED_SECRET = process.env.API_SHARED_SECRET || 'shared-secret';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const encryptedId = params.id;

    console.log('[API] Request received for video:', encryptedId);
    console.log('[API] Request headers:', {
      referer: request.headers.get('referer'),
      host: request.headers.get('host'),
      'x-video-token': request.headers.get('X-Video-Token') ? 'present' : 'missing',
      'user-agent': request.headers.get('user-agent')?.substring(0, 50)
    });

    // Security Layer 1: Check Referer header (relaxed for localhost development)
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');

    // In development, allow localhost requests
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment && (!referer || !referer.includes(`${host}/watch`))) {
      console.error('Referer check failed:', { referer, host });
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
      return NextResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    console.log('[API] Token found, validating for video:', encryptedId);

    const isValidToken = await verifyVideoToken(token, encryptedId);
    if (!isValidToken) {
      console.error('[API] Invalid token');
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    console.log('Token validated, decrypting video ID');

    const videoId = decryptVideoId(encryptedId);

    if (!videoId) {
      console.error('Failed to decrypt video ID');
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
