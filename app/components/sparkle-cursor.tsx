import { useEffect, useSyncExternalStore } from "react";

// Red, green, gold and white sparkles shaken off the pointer as it moves,
// twinkling as they fall and fading to specks of dust. Computers only (a
// fine pointer that hovers), not for those who ask for less motion, and
// off when the viewer turns it off (kept in this browser). The canvas is
// drawn only while sparkles are in the air, so a still page costs nothing.

const COLOURS = ["#E24B4A", "#97C459", "#FAC775", "#ffffff"];
const KEY = "commung-sparkle-cursor";
const EVERY_MS = 40; // at most one sparkle this often

let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== "off";
} catch {}
const listeners = new Set<() => void>();

/** Whether the sparkles are on, and the call that turns them on or off. */
export function useSparkleCursor() {
  const on = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
    () => true,
  );
  return {
    on,
    setOn: (value: boolean) => {
      enabled = value;
      try {
        localStorage.setItem(KEY, value ? "on" : "off");
      } catch {}
      for (const listener of listeners) listener();
    },
  };
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  colour: string;
  twinkle: number;
}

export function SparkleCursor() {
  const { on } = useSparkleCursor();
  useEffect(() => {
    if (!on) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.className = "sparkle-cursor";
    canvas.setAttribute("aria-hidden", "true");
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const fit = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    let sparkles: Sparkle[] = [];
    let frame = 0;
    let last = 0;

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparkles = sparkles.filter((s) => s.life > 0);
      for (const s of sparkles) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.98;
        s.twinkle += 0.3;
        s.life -= 0.014;
        ctx.globalAlpha = Math.max(s.life, 0);
        ctx.strokeStyle = s.colour;
        ctx.fillStyle = s.colour;
        if (s.life > 0.45) {
          // A twinkling cross, then (below) a speck of dust.
          const r = s.size * (0.6 + 0.4 * Math.abs(Math.sin(s.twinkle)));
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(s.x - r, s.y);
          ctx.lineTo(s.x + r, s.y);
          ctx.moveTo(s.x, s.y - r);
          ctx.lineTo(s.x, s.y + r);
          ctx.stroke();
          ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
        } else ctx.fillRect(s.x - 0.8, s.y - 0.8, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      frame = sparkles.length ? requestAnimationFrame(draw) : 0;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - last < EVERY_MS) return;
      last = now;
      sparkles.push({
        x: e.clientX,
        y: e.clientY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.4 + Math.random() * 0.8,
        life: 1,
        size: 4 + Math.random() * 3,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)] ?? "#fff",
        twinkle: Math.random() * 6,
      });
      if (!frame) frame = requestAnimationFrame(draw);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, [on]);
  return null;
}
