'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* ══════════════════════════════════════════════════════════════════
   useDeviceStream — Real-time device screen streaming.

   Strategy:
     Primary: ADB screencap polling via /api/device-image (~6fps)
     Why not MJPEG? scrcpy v4.1 has no --video-output flag on Windows.
     The MJPEG pipeline (scrcpy+ffmpeg) never produces frames.

   Reliability:
     - Adaptive backoff on errors
     - Connection heartbeat detects device reconnection
     - Never clears frameUrl once first frame arrives (no grey flash)
   ══════════════════════════════════════════════════════════════════ */

export type StreamMode = 'screenshot';

interface UseDeviceStreamResult {
  frameUrl: string | null;
  mode: StreamMode;
  fps: number;
  connected: boolean;
  error: boolean;
}

const POLL_MS = 150;
const ERROR_POLL_MS = 2000;
const FPS_WINDOW = 10;

export function useDeviceStream(
  serial: string | null,
  enabled: boolean,
): UseDeviceStreamResult {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState(false);

  const counterRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timestampsRef = useRef<number[]>([]);
  const currentPollMs = useRef(POLL_MS);
  const consecutiveErrors = useRef(0);
  const activeBlobUrlRef = useRef<string | null>(null);

  const updateFps = useCallback(() => {
    const now = performance.now();
    const ts = timestampsRef.current;
    ts.push(now);
    while (ts.length > FPS_WINDOW) ts.shift();
    if (ts.length >= 2) {
      const elapsed = (ts[ts.length - 1] - ts[0]) / 1000;
      setFps(Math.round((ts.length - 1) / Math.max(elapsed, 0.001)));
    }
  }, []);

  const poll = useCallback(() => {
    if (!serial) return;
    counterRef.current += 1;
    const url = `/api/device-image?serial=${encodeURIComponent(serial)}&t=${counterRef.current}`;

    fetch(url)
      .then(res => {
        const conn = res.headers.get('X-Connection');
        setConnected(conn !== 'disconnected');

        if (conn === 'disconnected') {
          consecutiveErrors.current++;
          setError(true);
          currentPollMs.current = Math.min(
            ERROR_POLL_MS,
            POLL_MS * Math.pow(1.5, consecutiveErrors.current),
          );
        } else {
          consecutiveErrors.current = 0;
          setError(false);
          currentPollMs.current = POLL_MS;
        }

        return res.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        if (activeBlobUrlRef.current?.startsWith('blob:')) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }
        activeBlobUrlRef.current = blobUrl;

        setFrameUrl(blobUrl);
        updateFps();

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(poll, currentPollMs.current);
      })
      .catch(() => {
        consecutiveErrors.current++;
        setError(true);
        setConnected(false);
        currentPollMs.current = Math.min(
          ERROR_POLL_MS,
          POLL_MS * Math.pow(1.5, consecutiveErrors.current),
        );
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(poll, currentPollMs.current);
      });
  }, [serial, updateFps]);

  useEffect(() => {
    if (!enabled || !serial) {
      if (activeBlobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      setFrameUrl(null);
      setError(false);
      setFps(0);
      setConnected(true);
      consecutiveErrors.current = 0;
      currentPollMs.current = POLL_MS;
      timestampsRef.current = [];
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    counterRef.current = 0;
    consecutiveErrors.current = 0;
    currentPollMs.current = POLL_MS;

    poll();
    pollRef.current = setInterval(poll, currentPollMs.current);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      timestampsRef.current = [];
    };
  }, [serial, enabled, poll]);

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  return { frameUrl, mode: 'screenshot', fps, connected, error };
}
