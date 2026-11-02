import { useSyncExternalStore } from "react";

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

/** The pixel fireplace: a mantel over stone, logs in the hearth, and two
 * frames of flame (or a few embers when it is out). */
function FireArt({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="56"
      height="56"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="0" y="1" width="16" height="1" fill="#8a5030" />
      <rect x="0" y="2" width="16" height="1" fill="#6b3a1e" />
      <rect x="1" y="3" width="14" height="12" fill="#8c8176" />
      <rect x="5" y="4" width="4" height="1" fill="#74695f" />
      <rect x="2" y="5" width="2" height="1" fill="#74695f" />
      <rect x="12" y="5" width="2" height="1" fill="#74695f" />
      <rect x="1" y="8" width="2" height="1" fill="#74695f" />
      <rect x="13" y="9" width="2" height="1" fill="#74695f" />
      <rect x="2" y="11" width="2" height="1" fill="#74695f" />
      <rect x="12" y="12" width="2" height="1" fill="#74695f" />
      <rect x="4" y="6" width="8" height="9" fill="#1d1410" />
      <rect x="4" y="6" width="1" height="1" fill="#8c8176" />
      <rect x="11" y="6" width="1" height="1" fill="#8c8176" />
      {lit ? (
        <>
          <g className="campfire-frame-a">
            <rect x="6" y="8" width="4" height="5" fill="#d9381e" />
            <rect x="5" y="10" width="6" height="3" fill="#d9381e" />
            <rect x="7" y="7" width="1" height="1" fill="#d9381e" />
            <rect x="6" y="10" width="4" height="3" fill="#f28a1d" />
            <rect x="7" y="9" width="1" height="1" fill="#f28a1d" />
            <rect x="7" y="11" width="2" height="2" fill="#ffd75e" />
          </g>
          <g className="campfire-frame-b">
            <rect x="6" y="8" width="4" height="5" fill="#d9381e" />
            <rect x="5" y="9" width="6" height="4" fill="#d9381e" />
            <rect x="8" y="7" width="1" height="1" fill="#d9381e" />
            <rect x="6" y="10" width="4" height="3" fill="#f28a1d" />
            <rect x="8" y="9" width="1" height="1" fill="#f28a1d" />
            <rect x="7" y="12" width="2" height="1" fill="#ffd75e" />
            <rect x="8" y="11" width="1" height="1" fill="#ffd75e" />
          </g>
        </>
      ) : (
        <>
          <rect x="6" y="12" width="4" height="1" fill="#8a2a10" />
          <rect x="6" y="12" width="1" height="1" fill="#d9381e" />
          <rect x="8" y="12" width="1" height="1" fill="#f28a1d" />
        </>
      )}
      <rect x="5" y="13" width="6" height="1" fill="#7a4423" />
      <rect x="5" y="14" width="6" height="1" fill="#4a2812" />
      <rect x="5" y="13" width="1" height="1" fill="#c08850" />
      <rect x="10" y="13" width="1" height="1" fill="#c08850" />
      <rect x="0" y="15" width="16" height="1" fill="#5a5048" />
    </svg>
  );
}

// The fire is one for the whole page: its state lives here, outside React.
let lit = false;
let track = 0;
let audioCtx: AudioContext | null = null;
let stopFire: (() => void) | null = null;
let audio: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
let snapshot = { lit, track };

function publish() {
  snapshot = { lit, track };
  document.documentElement.classList.toggle("fire-lit", lit);
  for (const listener of listeners) listener();
}

function playTrack(index: number) {
  if (!audio) return;
  track = index;
  audio.src = TRACKS[index]?.src ?? "";
  audio.volume = MUSIC_VOLUME;
  audio.play().catch(() => {});
}

function toggleFire() {
  if (lit) {
    stopFire?.();
    stopFire = null;
    audio?.pause();
    lit = false;
    publish();
    return;
  }
  if (!audioCtx) audioCtx = new AudioContext();
  audioCtx.resume();
  stopFire = startFire(audioCtx);
  if (!audio) {
    const player = new Audio();
    player.crossOrigin = "anonymous";
    audio = player;
    // Next piece when one ends or cannot be played, giving up once every
    // piece has failed in a row.
    let failures = 0;
    player.addEventListener("playing", () => {
      failures = 0;
    });
    const next = () => {
      playTrack((track + 1) % TRACKS.length);
      publish();
    };
    player.addEventListener("ended", next);
    player.addEventListener("error", () => {
      failures += 1;
      if (failures < TRACKS.length) next();
    });
    playTrack(Math.floor(Math.random() * TRACKS.length));
  } else audio.play().catch(() => {});
  lit = true;
  publish();
}

const subscribeFire = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const unlit = { lit: false, track: 0 };

function useFire() {
  return useSyncExternalStore(
    subscribeFire,
    () => snapshot,
    () => unlit,
  );
}

/**
 * A little fireplace in the corner. Pressed, it catches: the fire crackles,
 * calm classical music plays, and the warm light over the page grows and
 * flickers. Pressed again, it all fades out. Nothing plays on its own. On
 * phones it sits small at the right of the top bar instead (app.css).
 */
export function Campfire() {
  const { lit, track } = useFire();
  return (
    <>
      <div className="cozy-filter" aria-hidden />
      <div className="campfire">
        {lit && (
          <span className="campfire-track">♪ {TRACKS[track]?.title}</span>
        )}
        <button
          type="button"
          onClick={toggleFire}
          className="campfire-button"
          aria-pressed={lit}
          title={lit ? "벽난로 끄기" : "벽난로 피우기 (소리가 나요)"}
        >
          <FireArt lit={lit} />
          <span className="campfire-label">
            {lit ? "불 끄기" : "불 피우기"}
          </span>
        </button>
      </div>
    </>
  );
}
