import {
  type MouseEvent,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { useSparkleCursor } from "~/components/sparkle-cursor";

/** Calm public-domain (or CC0) recordings on Wikimedia Commons. */
/**
 * The music the fire plays. `credit` is shown under the title while it
 * plays, for the recordings whose licence asks for one (Creative Commons
 * BY and BY-SA): who recorded it, and the licence.
 */
const TRACKS: {
  title: string;
  src: string;
  /** How much louder it plays than the rest (a quieter recording). */
  boost?: number;
  credit?: string;
}[] = [
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
  // Christmas pieces, each recording in the public domain on Wikimedia
  // Commons (the U.S. Army Band's is a work of the U.S. government).
  {
    title: "차이콥스키 · 꽃의 왈츠",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e4/P.I._Tchaikovsky%27s_Waltz_of_the_Flowers_Performed_by_The_U.S._Army_Band%2C_c._2019.mp3",
  },
  // Recordings that ask for credit, from Wikimedia Commons.
  {
    title: "차이콥스키 · 사탕 요정의 춤",
    src: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Tchaikovsky_-_Dance_of_the_Sugar_Plum_Fairy_-_The_Nutcracker.ogg",
    boost: 2, // recorded some 7 dB quieter than the rest
    credit: "Free Classical Music on YouTube · CC BY 3.0",
  },
  {
    title: "헨델 · 메시아 중 목가",
    src: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Handel_-_messiah_-_13_pifa.ogg",
    credit: "MIT Concert Choir, W. Cutter · CC BY-SA 2.0",
  },
  {
    title: "바흐 · 예수, 인간 소망의 기쁨",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/51/Jesu%2C_Joy_of_Man%27s_Desiring_%28ISRC_USUAN1100189%29.mp3",
    credit: "Kevin MacLeod (incompetech.com) · CC BY 3.0",
  },
  {
    title: "비발디 · 사계 중 겨울 2악장",
    src: "https://upload.wikimedia.org/wikipedia/commons/b/b1/11_-_Vivaldi_Winter_mvt_2_Largo_-_John_Harrison_violin.ogg",
    credit: "John Harrison (JohnHarrisonViolin.com) · CC BY-SA 4.0",
  },
];

// How loud each plays, 0 to 1, as the sliders by the fire set them; kept
// in this browser. The fire's sound at its loudest is FIRE_MAX.
const FIRE_MAX = 0.6;
const LEVELS_KEY = "commung-campfire-levels";
let levels = { fire: 0.35, music: 0.7 };
try {
  const saved = JSON.parse(localStorage.getItem(LEVELS_KEY) ?? "null");
  if (typeof saved?.fire === "number" && typeof saved?.music === "number")
    levels = { fire: saved.fire, music: saved.music };
} catch {}

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
  master.gain.linearRampToValueAtTime(
    levels.fire * FIRE_MAX,
    ctx.currentTime + 2,
  );
  master.connect(ctx.destination);
  fireGain = master;

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
    if (fireGain === master) fireGain = null;
  };
}

/** The pixel fireplace: a mantel over stone, logs in the hearth, and two
 * frames of flame (or a few embers when it is out). */
function FireArt({ lit, size = 56 }: { lit: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
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
let fireGain: GainNode | null = null;
// The volume sliders: opened by holding the fire down (phones) or by its
// right click (computers), closed by a tap anywhere else.
let levelsOpen = false;
const listeners = new Set<() => void>();
let snapshot = { lit, track, levelsOpen, ...levels };

function publish() {
  snapshot = { lit, track, levelsOpen, ...levels };
  document.documentElement.classList.toggle("fire-lit", lit);
  for (const listener of listeners) listener();
}

function playTrack(index: number) {
  if (!audio) return;
  track = index;
  audio.src = TRACKS[index]?.src ?? "";
  audio.volume = musicVolume();
  audio.play().catch(() => {});
}

const musicVolume = () =>
  Math.min(1, levels.music * (TRACKS[track]?.boost ?? 1));

/** Sets how loud the fire or the music plays, now and from now on. */
function setLevel(kind: "fire" | "music", value: number) {
  levels = { ...levels, [kind]: value };
  try {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(levels));
  } catch {}
  if (kind === "music" && audio) audio.volume = musicVolume();
  if (kind === "fire" && fireGain && audioCtx) {
    fireGain.gain.cancelScheduledValues(audioCtx.currentTime);
    fireGain.gain.setTargetAtTime(value * FIRE_MAX, audioCtx.currentTime, 0.05);
  }
  publish();
}

function setLevelsOpen(open: boolean) {
  if (levelsOpen === open) return;
  levelsOpen = open;
  publish();
}

/**
 * What the fire's button needs besides its click: holding it down (half a
 * second) or right-clicking it opens the sliders, and the click that ends a
 * hold does not also light or put out the fire.
 */
function useFireButton() {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  return {
    onClick: () => {
      if (held.current) held.current = false;
      else toggleFire();
    },
    onPointerDown: () => {
      held.current = false;
      cancel();
      hold.current = setTimeout(() => {
        held.current = true;
        setLevelsOpen(true);
      }, 500);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      cancel();
      setLevelsOpen(true);
    },
  };
}

/**
 * The fire and music sliders, while open; a press anywhere outside them
 * closes them. `className` places them (the corner, or under the top bar).
 */
function FireLevelsPanel({ className }: { className: string }) {
  const { levelsOpen: open } = useFire();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      // Inside either panel (the corner's or the top bar's, one of them
      // hidden by the layout) is not outside.
      if (!(e.target as Element).closest?.(".campfire-levels-panel"))
        setLevelsOpen(false);
    };
    // Next tick, so the press that opened them does not close them.
    const id = setTimeout(() =>
      document.addEventListener("pointerdown", close),
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className={`campfire-levels-panel ${className}`}>
      <FireLevels />
    </div>
  );
}

/** The switch for the sparkles that follow the pointer (computers only). */
function SparkleToggle() {
  const { on, setOn } = useSparkleCursor();
  return (
    <label className="campfire-level campfire-sparkle-toggle">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      반짝이 커서
    </label>
  );
}

/** The two volume sliders. */
function FireLevels() {
  const { fire, music } = useFire();
  const row = (kind: "fire" | "music", label: string, value: number) => (
    <label className="campfire-level">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => setLevel(kind, Number(e.target.value))}
        aria-label={`${label} 소리 크기`}
      />
    </label>
  );
  return (
    <div className="campfire-levels">
      {row("fire", "불", fire)}
      {row("music", "음악", music)}
      <SparkleToggle />
    </div>
  );
}

/** Puts the fire out if it burns (another player is about to play). */
export function quietFire() {
  if (lit) toggleFire();
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
const unlit = { lit: false, track: 0, levelsOpen: false, fire: 0, music: 0 };

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
 * phones with the top bar, CampfireHeaderButton stands in for it.
 */
export function Campfire() {
  const { lit, track } = useFire();
  return (
    <>
      <div className="cozy-filter" aria-hidden />
      <div className="campfire" data-tour="campfire">
        {lit && (
          <div className="campfire-track">
            ♪ {TRACKS[track]?.title}
            {TRACKS[track]?.credit && (
              <small className="campfire-credit">{TRACKS[track]?.credit}</small>
            )}
          </div>
        )}
        <FireLevelsPanel className="campfire-levels-corner" />
        <button
          type="button"
          {...useFireButton()}
          className="campfire-button"
          aria-pressed={lit}
          title={
            lit
              ? "벽난로 끄기 (우클릭: 소리 크기)"
              : "벽난로 피우기 (소리가 나요)"
          }
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

/**
 * The same fire, small, inside the phone's top bar, so it comes and goes
 * with the bar; the corner fireplace hides while this is on the page.
 */
export function CampfireHeaderButton() {
  const { lit } = useFire();
  const gestures = useFireButton();
  return (
    <>
      <FireLevelsPanel className="campfire-levels-top" />
      <button
        type="button"
        data-campfire-header
        data-tour="campfire"
        {...gestures}
        className="campfire-header-button ml-auto shrink-0 flex items-center gap-1 text-xs font-semibold text-foreground"
        aria-pressed={lit}
        title={lit ? "벽난로 끄기" : "벽난로 피우기 (소리가 나요)"}
      >
        <FireArt lit={lit} size={32} />
        {lit ? "불 끄기" : "불 피우기"}
      </button>
    </>
  );
}
