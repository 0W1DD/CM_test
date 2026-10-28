import { type CSSProperties, useEffect, useState } from "react";

const FLAKES = 48;

interface Flake {
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
}

function makeFlakes(): Flake[] {
  return Array.from({ length: FLAKES }, () => ({
    left: Math.random() * 100,
    size: 2 + Math.random() * 5,
    duration: 9 + Math.random() * 12,
    delay: -Math.random() * 20,
    drift: (Math.random() - 0.5) * 120,
    opacity: 0.55 + Math.random() * 0.45,
  }));
}

/**
 * Snow falling over the background photo and under the page, so it shows
 * around and between the blocks without covering what is written. Made on
 * the client only (the flakes are random), and left out for those who ask
 * for less motion (see app.css).
 */
export function Snowfall() {
  const [flakes, setFlakes] = useState<Flake[]>([]);
  useEffect(() => setFlakes(makeFlakes()), []);

  return (
    <div className="snowfall" aria-hidden>
      {flakes.map((flake, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the flakes never change order.
          key={index}
          style={
            {
              left: `${flake.left}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              opacity: flake.opacity,
              animationDuration: `${flake.duration}s`,
              animationDelay: `${flake.delay}s`,
              "--drift": `${flake.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
