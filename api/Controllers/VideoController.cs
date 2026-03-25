using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace VideoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VideoController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<VideoController> _logger;
    private readonly string _videoStoragePath;
    private readonly string _sharedSecret;

    public VideoController(IConfiguration configuration, ILogger<VideoController> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _videoStoragePath = _configuration["ApiSettings:VideoStoragePath"] ?? "./videos";
        _sharedSecret = _configuration["ApiSettings:SharedSecret"] ?? "shared-secret";
    }

    [HttpGet("{videoId}")]
    public async Task<IActionResult> GetVideo(string videoId)
    {
        try
        {
            // Validate authentication - check for shared secret
            if (!Request.Headers.TryGetValue("X-API-Secret", out var apiSecret) ||
                apiSecret != _sharedSecret)
            {
                _logger.LogWarning("Unauthorized access attempt for video: {VideoId}", videoId);
                return Unauthorized(new { error = "Direct access not allowed" });
            }

            // Validate video ID from header (double-check)
            if (!Request.Headers.TryGetValue("X-Video-Id", out var headerVideoId) ||
                headerVideoId != videoId)
            {
                _logger.LogWarning("Video ID mismatch: URL={UrlId}, Header={HeaderId}", videoId, headerVideoId);
                return BadRequest(new { error = "Invalid video ID" });
            }

            // Sanitize video ID to prevent path traversal
            var sanitizedVideoId = Path.GetFileName(videoId);
            var videoPath = Path.Combine(_videoStoragePath, $"{sanitizedVideoId}.mp4");

            if (!System.IO.File.Exists(videoPath))
            {
                _logger.LogWarning("Video not found: {VideoPath}", videoPath);
                return NotFound(new { error = "Video not found" });
            }

            var fileInfo = new FileInfo(videoPath);
            var fileLength = fileInfo.Length;

            // Check if Range header is present
            var rangeHeader = Request.Headers["Range"].ToString();

            if (string.IsNullOrEmpty(rangeHeader))
            {
                // No range request - serve entire file
                _logger.LogInformation("Serving full video: {VideoId}", videoId);
                var stream = new FileStream(videoPath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return File(stream, "video/mp4", enableRangeProcessing: true);
            }

            // Parse range header
            if (!TryParseRange(rangeHeader, fileLength, out var start, out var end))
            {
                _logger.LogWarning("Invalid range header: {RangeHeader}", rangeHeader);
                return StatusCode((int)HttpStatusCode.RequestedRangeNotSatisfiable);
            }

            var length = end - start + 1;

            _logger.LogInformation(
                "Serving video range: {VideoId}, Range: {Start}-{End}/{Total}",
                videoId, start, end, fileLength
            );

            // Open file and seek to start position
            var fileStream = new FileStream(videoPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            fileStream.Seek(start, SeekOrigin.Begin);

            // Create a limited stream for the range
            var rangeStream = new RangeStream(fileStream, length);

            // Set response headers for partial content
            Response.StatusCode = (int)HttpStatusCode.PartialContent;
            Response.Headers.Add("Accept-Ranges", "bytes");
            Response.Headers.Add("Content-Range", $"bytes {start}-{end}/{fileLength}");
            Response.ContentLength = length;
            Response.ContentType = "video/mp4";

            return File(rangeStream, "video/mp4");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error serving video: {VideoId}", videoId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    private static bool TryParseRange(string rangeHeader, long fileLength, out long start, out long end)
    {
        start = 0;
        end = fileLength - 1;

        try
        {
            // Range header format: "bytes=start-end"
            var range = rangeHeader.Replace("bytes=", "").Split('-');

            if (range.Length != 2)
                return false;

            if (!string.IsNullOrEmpty(range[0]))
                start = long.Parse(range[0]);

            if (!string.IsNullOrEmpty(range[1]))
                end = long.Parse(range[1]);

            // Validate range
            if (start > end || start < 0 || end >= fileLength)
                return false;

            return true;
        }
        catch
        {
            return false;
        }
    }
}

// Helper class to limit stream reading to a specific length
public class RangeStream : Stream
{
    private readonly Stream _baseStream;
    private readonly long _length;
    private long _position;

    public RangeStream(Stream baseStream, long length)
    {
        _baseStream = baseStream;
        _length = length;
        _position = 0;
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => _length;
    public override long Position
    {
        get => _position;
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        var remaining = _length - _position;
        if (remaining <= 0)
            return 0;

        var toRead = (int)Math.Min(count, remaining);
        var bytesRead = _baseStream.Read(buffer, offset, toRead);
        _position += bytesRead;
        return bytesRead;
    }

    public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        var remaining = _length - _position;
        if (remaining <= 0)
            return 0;

        var toRead = (int)Math.Min(count, remaining);
        var bytesRead = await _baseStream.ReadAsync(buffer.AsMemory(offset, toRead), cancellationToken);
        _position += bytesRead;
        return bytesRead;
    }

    public override void Flush() => _baseStream.Flush();
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _baseStream?.Dispose();
        }
        base.Dispose(disposing);
    }
}
