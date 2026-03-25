import Link from 'next/link';
import { encryptVideoId } from '@/lib/encryption';

// Demo videos - in production, these would come from a database
const demoVideos = [
  { id: 'video1', title: 'Sample Video 1', thumbnail: '/api/placeholder/320/180' },
  { id: 'video2', title: 'Sample Video 2', thumbnail: '/api/placeholder/320/180' },
  { id: 'video3', title: 'Sample Video 3', thumbnail: '/api/placeholder/320/180' },
];

export default function Home() {
  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', fontSize: '32px' }}>YourTube</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {demoVideos.map((video) => {
          const encryptedId = encryptVideoId(video.id);
          return (
            <Link
              key={video.id}
              href={`/watch?v=${encryptedId}`}
              style={{
                backgroundColor: '#282828',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'transform 0.2s',
              }}
            >
              <div style={{
                width: '100%',
                paddingTop: '56.25%',
                backgroundColor: '#404040',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '48px',
                  color: '#606060'
                }}>▶</div>
              </div>
              <div style={{ padding: '12px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>{video.title}</h3>
                <p style={{ fontSize: '14px', color: '#aaaaaa' }}>Video ID: {video.id}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
