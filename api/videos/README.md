# Video Storage Directory

Place your video files here with the following naming convention:
- `video1.mp4`
- `video2.mp4`
- `video3.mp4`

The video ID should match the filename (without extension).

## Supported Formats
- MP4 (recommended)
- WebM
- Other formats supported by HTML5 video tag

## Notes
- Large files (up to 2GB+) are supported via range requests
- Videos are streamed in chunks for efficient delivery
- Direct access is blocked - all requests must come through the Next.js proxy
