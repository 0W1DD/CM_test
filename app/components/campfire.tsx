import { useEffect, useRef, useState } from "react";

/** Calm public-domain (or CC0) recordings on Wikimedia Commons. */
const TRACKS = [
  {
    title: "사티 · 짐노페디 1번",
    src: "https://upload.wikimedia.org/wikipedia/commons/9/90/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg",
  },
  {
    title: "쇼팽 · 녹턴 Op.9 No.2",
    src: "https://upload.wikimedia.org/wikipedia/commons/0/04/Chopin_Nocturne_No._2_in_E_Flat_Major%2C_Op._9.ogg",
  },
  {
    title: "바흐 · G선상의 아리아",
    src: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Air_%28Bach%29.ogg",
  },
];

const MUSIC_VOLUME = 0.3;
const FIRE_VOLUME = 0.5;

/** Seconds of noise, white or (brown) low-rumbling. */
function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  return buffer;
}

/** One pop of a burning log: a few milliseconds of fast-fading noise. */
function crackleBuffer(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4;
  return buffer;
}

/**
 * The fire's sound, made on the spot: a low rumble, a soft hiss, and pops
 * at random moments. Returns a function that fades it out and stops it.
 */
function startFire(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(FIRE_VOLUME, ctx.currentTime + 2);
  master.connect(ctx.destination);

  const rumble = ctx.createBufferSource();
  rumble.buffer = noiseBuffer(ctx, 4, true);
  rumble.loop = true;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 500;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.6;
  rumble.connect(low).connect(rumbleGain).connect(master);
  rumble.start();

  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, 2, false);
  hiss.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2500;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.015;
  hiss.connect(band).connect(hissGain).connect(master);
  hiss.start();

  const pop = crackleBuffer(ctx);
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 1200;
  high.connect(master);
  let timer: ReturnType<typeof setTimeout>;
  const crackle = () => {
    // Pops come alone or in little bursts.
    const count = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 3) : 1;
    for (let i = 0; i < count; i++) {
      const source = ctx.createBufferSource();
      source.buffer = pop;
      source.playbackRate.value = 0.5 + Math.random() * 1.2;
      const gain = ctx.createGain();
      gain.gain.value = 0.1 + Math.random() * 0.4;
      source.connect(gain).connect(high);
      source.start(ctx.currentTime + i * (0.02 + Math.random() * 0.08));
    }
    timer = setTimeout(crackle, 80 + Math.random() * 700);
  };
  crackle();

  return () => {
    clearTimeout(timer);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => {
      rumble.stop();
      hiss.stop();
      master.disconnect();
    }, 1100);
  };
}

/** The pixel fire: logs, and two frames of flame (or embers when out). */
function FireArt({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="48"
      height="48"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {lit ? (
        <>
          <g className="campfire-frame-a">
            <rect x="6" y="4" width="3" height="8" fill="#d9381e" />
            <rect x="5" y="7" width="6" height="5" fill="#d9381e" />
            <rect x="4" y="9" width="8" height="3" fill="#d9381e" />
            <rect x="7" y="2" width="1" height="2" fill="#d9381e" />
            <rect x="6" y="7" width="4" height="5" fill="#f28a1d" />
            <rect x="7" y="5" width="1" height="2" fill="#f28a1d" />
            <rect x="7" y="9" width="2" height="3" fill="#ffd75e" />
          </g>
          <g className="campfire-frame-b">
            <rect x="7" y="4" width="3" height="8" fill="#d9381e" />
            <rect x="5" y="6" width="6" height="6" fill="#d9381e" />
            <rect x="4" y="9" width="8" height="3" fill="#d9381e" />
            <rect x="9" y="2" width="1" height="2" fill="#d9381e" />
            <rect x="4" y="7" width="1" height="2" fill="#d9381e" />
            <rect x="6" y="7" width="4" height="5" fill="#f28a1d" />
            <rect x="8" y="5" width="1" height="2" fill="#f28a1d" />
            <rect x="7" y="10" width="2" height="2" fill="#ffd75e" />
          </g>
        </>
      ) : (
        <>
          <rect x="6" y="11" width="4" height="1" fill="#8a2a10" />
          <rect x="7" y="11" width="1" height="1" fill="#d9381e" />
          <rect x="9" y="11" width="1" height="1" fill="#f28a1d" />
        </>
      )}
      <rect x="2" y="12" width="12" height="2" fill="#7a4423" />
      <rect x="3" y="14" width="10" height="1" fill="#4a2812" />
      <rect x="2" y="12" width="1" height="2" fill="#c08850" />
      <rect x="13" y="12" width="1" height="2" fill="#c08850" />
    </svg>
  );
}

/**
 * A little campfire in the corner. Pressed, it catches: the fire crackles,
 * calm classical music plays, and the warm light over the page grows and
 * flickers. Pressed again, it all fades out. Nothing plays on its own.
 */
export function Campfire() {
  const [lit, setLit] = useState(false);
  const [track, setTrack] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopFireRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("fire-lit", lit);
  }, [lit]);

  useEffect(
    () => () => {
      stopFireRef.current?.();
      audioRef.current?.pause();
      ctxRef.current?.close();
    },
    [],
  );

  const playTrack = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    setTrack(index);
    audio.src = TRACKS[index]?.src ?? "";
    audio.volume = MUSIC_VOLUME;
    audio.play().catch(() => {});
  };

  const toggle = () => {
    if (lit) {
      stopFireRef.current?.();
      stopFireRef.current = null;
      audioRef.current?.pause();
      setLit(false);
      return;
    }
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    ctx.resume();
    stopFireRef.current = startFire(ctx);
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      // Next piece when one ends or cannot be played, giving up once every
      // piece has failed in a row.
      let failures = 0;
      audio.addEventListener("playing", () => {
        failures = 0;
      });
      const next = () =>
        setTrack((current) => {
          const following = (current + 1) % TRACKS.length;
          audio.src = TRACKS[following]?.src ?? "";
          audio.play().catch(() => {});
          return following;
        });
      audio.addEventListener("ended", next);
      audio.addEventListener("error", () => {
        failures += 1;
        if (failures < TRACKS.length) next();
      });
      audioRef.current = audio;
      playTrack(Math.floor(Math.random() * TRACKS.length));
    } else audioRef.current.play().catch(() => {});
    setLit(true);
  };

  return (
    <>
      <div className="cozy-filter" aria-hidden />
      <div className="campfire">
        {lit && (
          <span className="campfire-track">♪ {TRACKS[track]?.title}</span>
        )}
        <button
          type="button"
          onClick={toggle}
          className="campfire-button"
          aria-pressed={lit}
          aria-label={lit ? "모닥불 끄기" : "모닥불 피우기"}
          title={lit ? "모닥불 끄기" : "모닥불 피우기 (소리가 나요)"}
        >
          <FireArt lit={lit} />
        </button>
      </div>
    </>
  );
}
