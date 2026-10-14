import { useEffect, useRef, useState } from 'react';
import { apiFetch, MissingApiKeyError } from '../apiFetch.js';

interface Props {
  videoUrl: string;          // relative path: 'api/video/abc123'
  className?: string;
  onMissingKey?: () => void; // callback to open modal
  // When true, the blob is only fetched after the element enters the
  // viewport (IntersectionObserver). Used for thumbnails so off-screen
  // versions don't each trigger a full video download on mount.
  lazy?: boolean;
  // Optional playback attributes (defaults preserve a standard player).
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  controlsList?: string;
}

export default function SecureVideo({
  videoUrl,
  className,
  onMissingKey,
  lazy = false,
  controls = true,
  autoPlay,
  loop,
  muted,
  playsInline,
  preload,
  controlsList,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lazy load: only start fetching once in viewport.
  useEffect(() => {
    if (!lazy || shouldLoad) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, shouldLoad]);

  // Fetch blob once shouldLoad is true.
  useEffect(() => {
    if (!shouldLoad) return;
    let revoked = false;
    let currentUrl: string | null = null;

    setError(null);

    apiFetch(videoUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      })
      .catch((err) => {
        if (revoked) return;
        if (err instanceof MissingApiKeyError) {
          onMissingKey?.();
        }
        setError(err instanceof Error ? err.message : 'Failed to load video');
      });

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [shouldLoad, videoUrl, onMissingKey]);

  if (!shouldLoad) {
    return (
      <div
        ref={containerRef}
        className={className + ' flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs'}
      >
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className={className + ' flex items-center justify-center bg-zinc-900 text-red-400 text-xs p-2'}>
        {error}
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={className + ' flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs'}>
        Loading…
      </div>
    );
  }

  return (
    <video
      // React's `muted` prop alone is unreliable — set via ref too.
      ref={(el) => { if (el && muted) el.muted = true; }}
      className={className}
      src={objectUrl}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      preload={preload}
      controlsList={controlsList}
    />
  );
}
