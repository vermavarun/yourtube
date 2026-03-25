# YourTube - Video Streaming Platform

A YouTube-like video platform with Next.js frontend and .NET backend, featuring encrypted video IDs and efficient range-based streaming for large files (up to 2GB+).

## Architecture

```
┌─────────────────┐
│   Next.js UI    │  - Video player interface
│   (Port 3000)   │  - Encrypted video IDs
└────────┬────────┘
         │
         │ Encrypted ID
         ▼
┌─────────────────┐
│  Next.js Proxy  │  - Decrypts video IDs
│   API Routes    │  - Authenticates to .NET API
└────────┬────────┘  - Forwards range requests
         │
         │ Shared Secret + Video ID
         ▼
┌─────────────────┐
│   .NET API      │  - Validates authentication
│  (Port 5000)    │  - Serves video in chunks
└─────────────────┘  - Range request support
```

## Features

✅ **Encrypted Video IDs**: URLs use encrypted IDs to prevent direct access
✅ **Token-Based Authentication**: Time-limited JWT tokens (5 min) prevent URL sharing
✅ **Range Request Support**: Efficient streaming of large files (2GB+)
✅ **Protected Downloads**: Context menu disabled, download option hidden
✅ **API Authentication**: Shared secret between proxy and .NET API
✅ **Video Player**: HTML5 video player with controlled features

- **Node.js** 18+ and npm
- **.NET 8.0 SDK**
- Video files (MP4 format recommended)

## Setup Instructions

### 1. Frontend Setup (Next.js)

```bash
cd ui
npm install
```

Create/update `ui/.env.local`:
```env
# Generate a 32-character secret key for encryption
ENCRYPTION_SECRET=your-32-char-secret-key-here-12345

# .NET API endpoint
DOTNET_API_URL=http://localhost:5000

# Must match the .NET API shared secret
API_SHARED_SECRET=my-super-secret-key-2024
```

### 2. Backend Setup (.NET)

```bash
cd api
dotnet restore
```

Update `api/appsettings.Development.json`:
```json
{
  "ApiSettings": {
    "SharedSecret": "my-super-secret-key-2024",
    "VideoStoragePath": "./videos"
  }
}
```

### 3. Add Video Files

Place your video files in `api/videos/`:
```bash
api/videos/
├── video1.mp4
├── video2.mp4
└── video3.mp4
```

The video ID should match the filename (without extension).

## Running the Application

### Terminal 1 - .NET API
```bash
cd api
dotnet run
# Runs on http://localhost:5000
```

### Terminal 2 - Next.js Frontend
```bash
cd ui
npm run dev
# Runs on http://localhost:3000
```

## Usage

1. Open http://localhost:3000 in your browser
2. Click on any video thumbnail
3. Video will play with encrypted URL like: `/watch?v=U2FsdGVkX1...`
4. The player supports:
   - Play/Pause
   - Seeking
   - Volume control
   - Fullscreen
   - Efficient streaming of large files

## How It Works

### 1. Video ID Encryption
```typescript
// Frontend generates encrypted URL
const encryptedId = encryptVideoId('video1');
// URL: /watch?v=U2FsdGVkX1...
```

### 2. Token Generation
```typescript
// When video page loads, generate a time-limited JWT token
POST /api/token
{ videoId: "U2FsdGVkX1..." }
// Returns: { token: "eyJhbGciOiJIUzI1NiIs..." }
// Token valid for 5 minutes
```

### 3. Authenticated Video Request
```typescript
// Video player uses token in header (not URL)
const response = await fetch(`/api/video/${encryptedId}`, {
  headers: { 'X-Video-Token': token }
});
// Creates blob URL (no token visible in HTML)
video.src = URL.createObjectURL(await response.blob());
```

### 4. .NET API Validation
```csharp
// Validates shared secret from proxy
if (apiSecret != _sharedSecret) {
    return Unauthorized();
}

// Serves video with range support
// Handles requests like: Range: bytes=0-1048575
```

### 5. Range Request Flow
```
Client Request:  Range: bytes=0-1048575
                        ↓
Next.js Proxy:   Forwards range header
                        ↓
.NET API:        Returns bytes 0-1048575
                 Status: 206 Partial Content
                 Content-Range: bytes 0-1048575/104857600
```

## Security Features

1. **Encrypted URLs**: Video IDs are encrypted using AES-256
2. **Time-Limited JWT Tokens**: Each video session requires a token valid for only 5 minutes
3. **Header-Only Authentication**: Token sent via HTTP headers, never visible in HTML
4. **Referer Validation**: Blocks direct URL access from different origins
5. **No URL Leakage**: Video uses blob URLs, no token-containing URLs in HTML source
6. **Protected Context Menu**: Right-click disabled and download option hidden
7. **No Direct API Access**: .NET API requires shared secret header from proxy
8. **Double Validation**: Video ID verified in both URL and header
9. **Path Traversal Protection**: Sanitizes video IDs to prevent directory attacks

### Security Layers

```
User → Watch Page → JWT Token (memory only) → Fetch API (Header) → Proxy (Referer + Token check) → .NET API → Video Blob
```

**This means:**
- ❌ Can't inspect HTML to find video URL (uses blob URLs)
- ❌ Can't copy token from URL (sent in headers only)
- ❌ Can't open video in new tab (referer check fails)
- ❌ Can't share direct video URL (token in memory only)
- ❌ Can't right-click to download video
- ❌ Can't access .NET API directly
- ❌ Can't guess video IDs (encrypted)
- ✅ Only authorized requests from the video player work

## Testing with Large Files

To test with a large video file:

```bash
# macOS/Linux - Create a test file
dd if=/dev/zero of=api/videos/video1.mp4 bs=1m count=2048  # 2GB file

# Or copy your own video
cp ~/Movies/my-large-video.mp4 api/videos/video1.mp4
```

The range request implementation efficiently handles files of any size.

## API Endpoints

### Next.js Proxy

- `POST /api/token` - Generates a time-limited JWT token for video access
- `GET /api/video/[encrypted-id]` - Proxies video request to .NET API
  - Header required: `X-Video-Token` - JWT token from /api/token
  - Header required: `Referer` - Must be from /watch page
  - Validates token and referer before forwarding request
- `GET /api/video/{videoId}` - Serves video with range support
  - Headers required: `X-API-Secret`, `X-Video-Id`
  - Supports: `Range` header for partial content requests

- Ensure dependencies are installed: `cd ui && npm install`

### "Access token required" error
- Token may have expired (valid for 5 minutes)
- Refresh the page to generate a new token
- Check browser console for token generation errors

### Direct video URL doesn't work in new tab
- **This is expected!** The token is embedded in the URL and expires after 5 minutes
- This prevents sharing direct video links
- Videos can only be accessed through the watch page

### Context menu still shows
- Some browsers may override CSS/JS dsent via HTTP headers and requests must come from /watch page
- Referer validation blocks access from different origins
- Videos can only be accessed through the watch page with proper authentication

### Video not playing
- Check that video file exists in `api/videos/`
- Verify file extension is `.mp4`
- Check browser console for errors

### Direct API access blocked
- This is expected! Videos must be accessed through Next.js proxy
- Verify `API_SHARED_SECRET` matches in both `.env.local` and `appsettings.json`

### Range requests not working
- Check browser Network tab for 206 responses
- Verify .NET API returns `Accept-Ranges: bytes` header
- Test with: `curl -r 0-1000 http://localhost:3000/api/video/[encrypted-id]`

## Production Deployment

### Environment Variables

**Next.js**:
- `ENCRYPTION_SECRET` - Strong 32+ character key
- `DOTNET_API_URL` - Production .NET API URL
- `API_SHARED_SECRET` - Shared secret (keep secure!)

**.NET**:
- `ApiSettings:SharedSecret` - Must match proxy secret
- `ApiSettings:VideoStoragePath` - Path to video files (consider Azure Blob Storage)

### Recommendations

1. Use environment variables, not hardcoded secrets
2. Store videos in object storage (Azure Blob, AWS S3)
3. Add database for video metadata
4. Implement user authentication
5. Add CDN for video delivery
6. Implement video transcoding for multiple qualities
7. Add analytics and monitoring

## License

MIT

## Author

Built with ❤️ for efficient video streaming
