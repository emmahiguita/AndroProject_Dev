'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type StreamMode = 'screenshot' | 'mjpeg';

interface UseDeviceStreamResult {
  frameUrl: string | null;
  mode: StreamMode;
  fps: number;
  connected: boolean;
  error: boolean;
  refreshNow: () => void;
}

/** How often to poll (ms). Optimized to 300ms for better responsiveness */
const POLL_INTERVAL_MS = 300;
/** On error, back off to 500 ms before retrying */
const ERROR_RETRY_MS = 500;

/**
 * useDeviceStream — Zero-Lag ETag Polling Stream.
 *
 * Uses If-None-Match / 304 Not Modified to eliminate V8 GC thrashing and 6s delay.
 */
export function useDeviceStream(
  serial: string | null,
  enabled: boolean,
  scrcpyActive?: boolean,
): UseDeviceStreamResult {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [fps, setFps]           = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError]       = useState(false);

  const runningRef      = useRef(false);
  const activeBlobRef   = useRef<string | null>(null);
  const lastEtagRef     = useRef<string | null>(null);
  const frameCountRef   = useRef(0);
  const lastFpsTickRef  = useRef(Date.now());

  /** Revoke the previous blob URL to free memory */
  const revokePrev = useCallback(() => {
    const prev = activeBlobRef.current;
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    activeBlobRef.current = null;
  }, []);

  const triggerImmediateRef = useRef<(() => void) | null>(null);

  /** Force an immediate extra fetch (useful after a tap/swipe) */
  const refreshNow = useCallback(() => {
    if (!serial) return;
    lastEtagRef.current = null;
    fetch(`/api/device-image?serial=${encodeURIComponent(serial)}&force=true`, { cache: 'no-store' })
      .then(async res => {
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 500) {
            const newUrl = URL.createObjectURL(blob);
            revokePrev();
            activeBlobRef.current = newUrl;
            setFrameUrl(newUrl);
          }
        }
      })
      .catch(() => {});
  }, [serial, revokePrev]);

  useEffect(() => {
    if (!enabled || !serial || scrcpyActive) {
      runningRef.current = false;
      revokePrev();
      lastEtagRef.current = null;
      setFrameUrl(null);
      setConnected(false);
      setError(false);
      setFps(0);
      return;
    }

    runningRef.current = true;
    let aborted = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let isPolling = false;

    triggerImmediateRef.current = () => {
      if (!isPolling && runningRef.current && !aborted) {
        clearTimeout(timeoutId);
        poll();
      }
    };

    async function poll() {
      if (!runningRef.current || aborted || isPolling) return;
      
      isPolling = true;

      try {
        const headers: Record<string, string> = {};
        if (lastEtagRef.current) headers['If-None-Match'] = lastEtagRef.current;

        const url = `/api/device-image?serial=${encodeURIComponent(serial!)}`;
        const res = await fetch(url, { headers, cache: 'no-store' });

        if (!runningRef.current || aborted) {
          isPolling = false;
          return;
        }

        // 304 Not Modified: Frame has not changed, zero memory cost!
        if (res.status === 304) {
          setConnected(true);
          isPolling = false;
          const interval = 200; // Ultra-fast polling for real-time sync
          timeoutId = setTimeout(poll, interval);
          return;
        }

        const connHeader = res.headers.get('X-Connection');
        const isConn = connHeader !== 'disconnected';
        setConnected(isConn);

        if (res.ok && isConn) {
          const etag = res.headers.get('ETag');
          if (etag) lastEtagRef.current = etag;

          const blob = await res.blob();
          if (!runningRef.current || aborted) {
            isPolling = false;
            return;
          }

          if (blob.size > 500) {
            const newUrl = URL.createObjectURL(blob);
            revokePrev();
            activeBlobRef.current = newUrl;
            setFrameUrl(newUrl);
            setError(false);

            frameCountRef.current++;
            const now = Date.now();
            const elapsed = now - lastFpsTickRef.current;
            if (elapsed >= 1000) {
              setFps(Math.round((frameCountRef.current * 1000) / elapsed));
              frameCountRef.current = 0;
              lastFpsTickRef.current = now;
            }
          }

          isPolling = false;
          const interval = 150; // Ultra-fast for real-time sync
          timeoutId = setTimeout(poll, interval);
        } else {
          isPolling = false;
          setError(true);
          timeoutId = setTimeout(poll, ERROR_RETRY_MS);
        }
      } catch {
        if (!runningRef.current || aborted) {
          isPolling = false;
          return;
        }
        isPolling = false;
        setError(true);
        timeoutId = setTimeout(poll, ERROR_RETRY_MS);
      }
    }

    poll();

    return () => {
      aborted = true;
      runningRef.current = false;
      isPolling = false;
      clearTimeout(timeoutId);
    };
  }, [enabled, serial, revokePrev, scrcpyActive]);

  return {
    frameUrl,
    mode: 'screenshot',
    fps,
    connected,
    error,
    refreshNow,
  };
}
