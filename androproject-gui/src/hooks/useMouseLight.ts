// ── useMouseLight — Dynamic lighting that follows the cursor ─────────
// Updates CSS custom properties --lightX and --lightY on document root.
// Used by cosmic CSS classes for specular highlights and rim glow.

'use client';

import { useEffect, useRef } from 'react';

export function useMouseLight(targetRef?: React.RefObject<HTMLElement | null>) {
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const cxRef = useRef(0);
  const cyRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const root = document.documentElement;

    function animate() {
      const dx = Math.abs(txRef.current - cxRef.current);
      const dy = Math.abs(tyRef.current - cyRef.current);

      if (dx > 0.001 || dy > 0.001) {
        // Lerp towards target for smooth movement
        cxRef.current += (txRef.current - cxRef.current) * 0.08;
        cyRef.current += (tyRef.current - cyRef.current) * 0.08;

        const lightX = `${(cxRef.current + 0.5) * 100}%`;
        const lightY = `${(cyRef.current + 0.5) * 100}%`;

        root.style.setProperty('--lightX', lightX);
        root.style.setProperty('--lightY', lightY);

        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = 0;
      }
    }

    function handlePointerMove(e: PointerEvent) {
      const el = targetRef?.current || document.body;
      const rect = el.getBoundingClientRect();
      txRef.current = (e.clientX - rect.left) / rect.width - 0.5;
      tyRef.current = (e.clientY - rect.top) / rect.height - 0.5;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    function handlePointerLeave() {
      txRef.current = 0;
      tyRef.current = 0;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    // Listen on document for global light, or on target element
    const listenerTarget = targetRef?.current || document;
    listenerTarget.addEventListener('pointermove', handlePointerMove as EventListener);
    listenerTarget.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      listenerTarget.removeEventListener('pointermove', handlePointerMove as EventListener);
      listenerTarget.removeEventListener('pointerleave', handlePointerLeave);
      // Reset to defaults
      root.style.setProperty('--lightX', '50%');
      root.style.setProperty('--lightY', '28%');
    };
  }, [targetRef]);
}
