import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { GiftContent } from "~/components/gift-content";
import { type EventsStatus, useEventsStatus } from "~/lib/events";

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
 * darkens and a Christmas card drops in, "선물이 도착했습니다."; pressed,
 * it turns over to the gifts themselves. Once a week per profile in this
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

/** The darkened page and the card that drops in and turns over. */
export function GiftArrivalOverlay({
  gifts,
  onClose: close,
}: {
  gifts: EventsStatus["received"]["gifts"];
  onClose: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      className="gift-arrival fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/90 px-4 py-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="선물이 도착했습니다"
    >
      <div className="gift-drop gift-flip w-full max-w-md">
        <div className={`gift-flip-inner ${flipped ? "is-flipped" : ""}`}>
          {/* Front: the card, still closed */}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="gift-face bg-announce flex flex-col items-center justify-center gap-3 rounded-2xl border-l-4 px-6 py-12 text-center shadow-marsh-lg"
            aria-hidden={flipped}
            tabIndex={flipped ? -1 : 0}
          >
            <span className="gift-bounce text-6xl" aria-hidden>
              🎁
            </span>
            <span className="text-2xl font-bold">선물이 도착했습니다.</span>
            <span className="announce-badge rounded-full px-3 py-1 text-sm font-semibold">
              눌러서 열어보기
            </span>
          </button>

          {/* Back: the gifts */}
          <div
            className="gift-face gift-back bg-announce rounded-2xl border-l-4 shadow-marsh-lg"
            aria-hidden={!flipped}
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
                <Link to="/events" onClick={close} className="underline">
                  이벤트
                </Link>{" "}
                탭에서 다시 볼 수 있습니다.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25"
          >
            <X className="h-4 w-4" />
            {flipped ? "닫기" : "나중에 볼게요"}
          </button>
        </div>
      </div>
    </div>
  );
}
