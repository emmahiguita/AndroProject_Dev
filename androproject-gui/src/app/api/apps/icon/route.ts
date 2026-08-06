import { NextResponse } from 'next/server';

// In-memory cache to store Google Play Store icon URLs per package name
const iconCache: Record<string, string> = {
  'com.android.chrome': 'https://play-lh.googleusercontent.com/KwUq3n78OCee9jiC6aWP3QZa5A1j5KWls7Cg08HBPHVC1qFQA6GPB52WGLYuxHTg2co=w240-h240-rw',
  'com.google.android.youtube': 'https://play-lh.googleusercontent.com/lMo3ZORbbUBnrmziB3QCJj3nhuKjMTZUb3sRfrha1sgf77UdxgS4CONa3UDj9wJZkoA=w240-h240-rw',
  'com.whatsapp': 'https://play-lh.googleusercontent.com/bYtqbOcTYOlgc6gqZ2rwb8ZAH43w6H25wJuIMQH9_1qy2W4WCVSatGd2QBiAKmA3yQ=w240-h240-rw',
  'com.instagram.android': 'https://play-lh.googleusercontent.com/c2sPnja-w3sFcxtcnwd1GWyIEgQFBmCXAft3mTK8s5jz4Oi5XY55ElW7RqaN5Pf4sA=w240-h240-rw',
  'com.facebook.katana': 'https://play-lh.googleusercontent.com/ccWneaYgnqyZ3hCwPM4Tb5205Qx9EDnzxDOd18u13e2hWSy1w5WRqHs4hoj6sAHZnsA=w240-h240-rw',
  'com.netflix.mediaclient': 'https://play-lh.googleusercontent.com/TBRvdWyofoJGDClc8Ygxh4SPgZAo_wzCcgcxrk5bh4J5W8Ih38qUyC-Fyxg15_25mg=w240-h240-rw',
  'com.spotify.music': 'https://play-lh.googleusercontent.com/P2Vxa2GLvj23GI4vUBHNeeJUUk4aEPyPgEJC5f6430ZscIGjI54eCO9WX70V1n64ODg=w240-h240-rw',
  'com.microsoft.copilot': 'https://play-lh.googleusercontent.com/y4E-cR_2F_1tq-B401yB6W-n5QZ0_rR5kZ0134Q5kY01yA=w240-h240-rw'
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageName = searchParams.get('package');

    if (!packageName) {
      return new Response('Missing package parameter', { status: 400 });
    }

    // 1. Check in-memory cache
    if (iconCache[packageName]) {
      return NextResponse.redirect(iconCache[packageName]);
    }

    // 2. Attempt to scrape Google Play Store for the app icon using og:image meta tag
    const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3500); // 3.5 seconds timeout

    const res = await fetch(playStoreUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 86400 } // Cache results for 1 day
    });
    
    clearTimeout(id);

    if (res.ok) {
      const html = await res.text();
      // Look for the standard Open Graph social image tag
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || 
                           html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
      
      if (ogImageMatch && ogImageMatch[1]) {
        const imageUrl = ogImageMatch[1];
        iconCache[packageName] = imageUrl;
        return NextResponse.redirect(imageUrl);
      }
    }
  } catch {
    // Silent fail to return fallback
  }

  // 3. If the app is not in Play Store or request failed, return 404
  // The frontend will catch the error and render a beautiful fallback icon
  return new Response('Icon not found', { status: 404 });
}
