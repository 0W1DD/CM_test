import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { GiftContent } from "~/components/gift-content";
import { type EventsStatus, useEventsStatus } from "~/lib/events";

/** How a gift arrives; the staff can try each on the events page. */
export type ArrivalStyle = "lottie" | "card" | "box" | "letter" | "ornament";

export const ARRIVAL_STYLES: { value: ArrivalStyle; label: string }[] = [
  { value: "lottie", label: "로티 상자" },
  { value: "card", label: "카드" },
  { value: "box", label: "선물상자" },
  { value: "letter", label: "편지" },
  { value: "ornament", label: "오너먼트" },
];

/** The one members see. */
export const ARRIVAL_STYLE: ArrivalStyle = "lottie";

/** Set once a profile has seen a week's gifts arrive, in this browser. */
const seenKey = (profileId: string, week: string) =>
  `commung-gift-seen-${profileId}-${week}`;

function seen(profileId: string, week: string) {
  try {
    return localStorage.getItem(seenKey(profileId, week)) === "1";
  } catch {
    return true;
  }
}

/**
 * The first visit after the week's gifts open (Monday 08:00): the page
 * darkens and the gift arrives (ARRIVAL_STYLE); pressed, it opens with
 * confetti onto the gifts themselves. Once a week per profile in this
 * browser; after that the gifts are on the events page.
 */
export function GiftArrival() {
  const { data, profileId } = useEventsStatus();
  const [show, setShow] = useState(false);
  const received = data?.received;
  const gifts = received?.open ? received.gifts : [];

  useEffect(() => {
    if (!profileId || !received || !gifts.length) return;
    if (seen(profileId, received.week)) return;
    // Not over the first-visit tour; after the page has settled.
    const timer = setTimeout(() => {
      if (!document.querySelector(".tour-root")) setShow(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [profileId, received, gifts.length]);

  if (!show || !gifts.length) return null;
  return (
    <GiftArrivalOverlay
      gifts={gifts}
      onClose={() => {
        setShow(false);
        if (profileId && received)
          try {
            localStorage.setItem(seenKey(profileId, received.week), "1");
          } catch {}
      }}
    />
  );
}

const CONFETTI_COLOURS = [
  "#f2c94c",
  "#c8102e",
  "#2a5c46",
  "#fbf7ea",
  "#e85d75",
  "#7fc8a9",
];

/** A burst of confetti over the page each time `burst` goes up. */
function Confetti({ burst }: { burst: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!burst || !el || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);
    const pieces = Array.from({ length: 180 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 60,
      y: h * 0.4,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 5,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      colour:
        CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)] ??
        "#f2c94c",
      round: Math.random() < 0.35,
    }));
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const fade = Math.max(0, 1 - (now - start - 2200) / 800);
      for (const p of pieces) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.colour;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (now - start < 3000) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [burst]);
  return (
    <canvas
      ref={canvas}
      className="pointer-events-none fixed inset-0 z-[86] h-full w-full"
      aria-hidden
    />
  );
}

/** The gifts themselves, on a Christmas card. */
function GiftCard({
  gifts,
  onClose,
  className = "",
}: {
  gifts: EventsStatus["received"]["gifts"];
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      className={`bg-announce rounded-2xl border-l-4 shadow-marsh-lg ${className}`}
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 pb-5 pt-6">
        {gifts.map((gift, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: one card per giver
            key={i}
            className="space-y-2"
          >
            <p className="font-semibold">
              🎁 {gift.giver?.name ?? "알 수 없음"}님이 보낸 선물
            </p>
            <GiftContent content={gift.content} images={gift.images} />
          </div>
        ))}
        <p className="text-xs text-[var(--muted-foreground)]">
          선물은{" "}
          <Link to="/events" onClick={onClose} className="underline">
            이벤트
          </Link>{" "}
          탭에서 다시 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}

/**
 * The Lottie gift box ("Gift box" by Phuong Nguyen on LottieFiles, Lottie
 * Simple License): still on its first frame until `playing`, then it opens
 * once, stars and ribbons flying, and calls `onBurst` on the frame they
 * burst out (BURST_FRAME), for the confetti to go with them. The player and
 * the animation load only when a gift arrives.
 */
function LottieBox({
  playing,
  onBurst,
}: {
  playing: boolean;
  onBurst: () => void;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const animation = useRef<{ play: () => void; destroy: () => void } | null>(
    null,
  );
  const wantPlay = useRef(playing);
  wantPlay.current = playing;
  const burst = useRef(onBurst);
  burst.current = onBurst;
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("lottie-web/build/player/lottie_light"),
      import("~/assets/gift-box.lottie.json"),
    ]).then(([{ default: lottie }, { default: animationData }]) => {
      if (cancelled || !box.current) return;
      const anim = lottie.loadAnimation({
        container: box.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData,
        // The box sits small in the middle of a wide frame: fill a squarer
        // one, cropping the empty sides.
        rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
      });
      anim.goToAndStop(0, true);
      let burstDone = false;
      anim.addEventListener("enterFrame", (event) => {
        if (burstDone || event.currentTime < BURST_FRAME) return;
        burstDone = true;
        burst.current();
      });
      animation.current = anim;
      if (wantPlay.current) anim.play();
    });
    return () => {
      cancelled = true;
      animation.current?.destroy();
    };
  }, []);
  useEffect(() => {
    if (playing) animation.current?.play();
  }, [playing]);
  return <span ref={box} className="lottie-box" aria-hidden />;
}

/** The Lottie box's frame where the stars and ribbons burst out (25 a second). */
const BURST_FRAME = 37;

/** "선물이 도착했습니다." and the hint to press, under each closed gift. */
function ArrivedLine() {
  return (
    <span className="arrived-line mt-6 flex flex-col items-center gap-2 text-center text-white">
      <span className="text-2xl font-bold">선물이 도착했습니다.</span>
      <span className="rounded-full bg-[#f2c94c] px-3 py-1 text-sm font-semibold text-[#1f4a37]">
        눌러서 열어보기
      </span>
    </span>
  );
}

type Phase = "closed" | "opening" | "open";

/**
 * The darkened page and the gift arriving in `style`: pressed, it opens
 * (a moment of its own animation, with confetti) onto the gift card.
 */
export function GiftArrivalOverlay({
  gifts,
  onClose: close,
  style = ARRIVAL_STYLE,
}: {
  gifts: EventsStatus["received"]["gifts"];
  onClose: () => void;
  style?: ArrivalStyle;
}) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // The confetti and then the gift card, once.
  const burstDone = useRef(false);
  const burstThenOpen = (wait: number) => {
    if (burstDone.current) return;
    burstDone.current = true;
    setBurst((b) => b + 1);
    setTimeout(() => setPhase("open"), wait);
  };

  const open = () => {
    if (phase !== "closed") return;
    setPhase("opening");
    // The Lottie box bursts on its own frame (LottieBox's onBurst), or
    // after a while if it never loaded; the others at once, then their
    // own opening plays out before the gift card shows.
    if (style === "lottie") setTimeout(() => burstThenOpen(0), 3500);
    else burstThenOpen(style === "card" ? 0 : 650);
  };

  let stage: ReactNode;
  if (style === "card")
    stage = (
      <div className="gift-drop gift-flip">
        <div
          className={`gift-flip-inner ${phase !== "closed" ? "is-flipped" : ""}`}
        >
          <button
            type="button"
            onClick={open}
            className="gift-face bg-announce flex flex-col items-center justify-center gap-3 rounded-2xl border-l-4 px-6 py-12 text-center shadow-marsh-lg"
            aria-hidden={phase !== "closed"}
            tabIndex={phase !== "closed" ? -1 : 0}
          >
            <span className="gift-bounce text-6xl" aria-hidden>
              🎁
            </span>
            <span className="text-2xl font-bold">선물이 도착했습니다.</span>
            <span className="announce-badge rounded-full px-3 py-1 text-sm font-semibold">
              눌러서 열어보기
            </span>
          </button>
          <div className="gift-face gift-back" aria-hidden={phase === "closed"}>
            <GiftCard gifts={gifts} onClose={close} />
          </div>
        </div>
      </div>
    );
  else if (phase === "open")
    stage = <GiftCard gifts={gifts} onClose={close} className="gift-rise" />;
  else
    stage = (
      <button
        type="button"
        onClick={open}
        className={`gift-stage gift-stage-${style} ${phase === "opening" ? "is-opening" : ""} flex w-full flex-col items-center`}
      >
        {style === "lottie" && (
          <LottieBox
            playing={phase === "opening"}
            onBurst={() => burstThenOpen(600)}
          />
        )}
        {style === "box" && (
          <span className="gift-box" aria-hidden>
            <span className="gift-box-lid">
              <span className="gift-box-bow">🎀</span>
            </span>
            <span className="gift-box-body" />
          </span>
        )}
        {style === "letter" && (
          <span className="envelope" aria-hidden>
            <span className="envelope-letter">
              <span>To. 당신</span>
            </span>
            <span className="envelope-body" />
            <span className="envelope-flap" />
            <span className="envelope-seal">🎄</span>
          </span>
        )}
        {style === "ornament" && (
          <span className="ornament" aria-hidden>
            <span className="ornament-string" />
            <span className="ornament-cap" />
            <span className="ornament-ball">
              <span className="ornament-band" />
            </span>
          </span>
        )}
        <ArrivedLine />
      </button>
    );

  return (
    <div
      className="gift-arrival fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/90 px-4 py-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="선물이 도착했습니다"
    >
      <Confetti burst={burst} />
      <div className="w-full max-w-md">
        {stage}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25"
          >
            <X className="h-4 w-4" />
            {phase === "closed" ? "나중에 볼게요" : "닫기"}
          </button>
        </div>
      </div>
    </div>
  );
}
