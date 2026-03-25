# YourTube

A YouTube-like video streaming platform with encrypted URLs and efficient range-based streaming.

## Quick Start

1. **Setup .NET API**
   ```bash
   cd api
   dotnet restore
   dotnet run
   ```

2. **Setup Next.js Frontend**
   ```bash
   cd ui
   npm install
   npm run dev
   ```

3. **Add videos** to `api/videos/` folder (e.g., `video1.mp4`)

4. **Open** http://localhost:3000

## Key Features

- Encrypted video IDs for security
- Range request support for large files (2GB+)
- Authentication between proxy and API
- HTML5 video player

See [README.md](README.md) for full documentation.
