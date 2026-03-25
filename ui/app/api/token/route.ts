import { NextRequest, NextResponse } from 'next/server';
import { generateVideoToken } from '@/lib/token';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID required' },
        { status: 400 }
      );
    }

    // Generate a short-lived token for this video
    const token = await generateVideoToken(videoId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
