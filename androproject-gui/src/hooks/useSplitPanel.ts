// ── useSplitPanel — drag-to-resize split ratio ──────────────
// SRP: manages a single draggable split ratio between two panels.
// No UI, no business logic — pure state + pointer handlers.

'use client';

import { useState, useRef, useCallback } from 'react';

interface UseSplitPanelOptions {
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  step?: number;
}

interface UseSplitPanelReturn {
  ratio: number;
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function useSplitPanel(options: UseSplitPanelOptions = {}): UseSplitPanelReturn {
  const { defaultRatio = 0.60, minRatio = 0.30, maxRatio = 0.80, step = 0.05 } = options;
  const [ratio, setRatio] = useState(defaultRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback((v: number) => Math.min(maxRatio, Math.max(minRatio, v)), [minRatio, maxRatio]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setRatio(clamp(x / rect.width));
  }, [isDragging, clamp]);

  const onPointerUp = useCallback(() => setIsDragging(false), []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setRatio(r => clamp(r - step));
    else if (e.key === 'ArrowRight') setRatio(r => clamp(r + step));
  }, [clamp, step]);

  return { ratio, isDragging, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown };
}
