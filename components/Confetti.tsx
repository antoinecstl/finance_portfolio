'use client';

import { useEffect, useRef } from 'react';

type Piece = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  color: string;
  shape: 'rect' | 'circle';
};

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Confetti({
  durationMs = 3500,
  pieces = 160,
  onDone,
}: {
  durationMs?: number;
  pieces?: number;
  onDone?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Burst from two spots (left/right top) for a nicer spread.
    const makePiece = (i: number): Piece => {
      const side = i % 2 === 0 ? -1 : 1;
      const originX = width / 2 + side * (width * 0.1);
      return {
        x: originX + (Math.random() - 0.5) * 120,
        y: -20 - Math.random() * 40,
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 8,
        vx: side * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.7 ? 'circle' : 'rect',
      };
    };

    const particles: Piece[] = Array.from({ length: pieces }, (_, i) => makePiece(i));

    const start = performance.now();
    const gravity = 0.12;
    const airDrag = 0.0025;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.vy += gravity;
        p.vx *= 1 - airDrag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        onDone?.();
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [durationMs, pieces, onDone]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 z-[100] pointer-events-none"
    />
  );
}
