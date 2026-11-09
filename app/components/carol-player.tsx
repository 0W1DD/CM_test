// Christmas songs from a YouTube playlist, in YouTube's own player. The
// player is one small window for the whole site (CarolDock, mounted once
// in root.tsx), so it keeps playing from page to page; the button under
// the check-in and the events page's music tab only open it. It loads only
// once opened, and opening it puts the fireplace out so the two do not
// play over each other. Folded, the player stays loaded (and playing) out
// of sight; closed, it stops.
import { ChevronDown, ChevronUp, Music, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { quietFire } from "~/components/campfire";
import { Button } from "~/components/ui/button";

const PLAYLIST = "PLzLmKWYW3AHd1uGgcDg98om9Bx48AtQEG";
const SRC = `https://www.youtube-nocookie.com/embed/videoseries?list=${PLAYLIST}`;

let state = { open: false, folded: false };
const listeners = new Set<() => void>();
function set(next: typeof state) {
  state = next;
  for (const listener of listeners) listener();
}
const closed = { open: false, folded: false };

function useCarols() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => closed,
  );
}

/** Opens (or unfolds) the player window. */
export function openCarols() {
  if (!state.open) quietFire();
  set({ open: true, folded: false });
}

/** The window itself: once for the whole site, in root.tsx. */
export function CarolDock() {
  const { open, folded } = useCarols();
  if (!open) return null;
  return (
    <div className={`carol-dock ${folded ? "is-folded" : ""}`}>
      <div className="carol-dock-head">
        <Music className="h-4 w-4" />
        <span className="font-semibold">크리스마스 캐럴</span>
        <button
          type="button"
          className="ml-auto"
          onClick={() => set({ open: true, folded: !folded })}
          aria-label={folded ? "펼치기" : "접기"}
          title={folded ? "펼치기" : "접기 (계속 재생됩니다)"}
        >
          {folded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => set({ open: false, folded: false })}
          aria-label="닫기"
          title="닫기 (재생이 멈춥니다)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="carol-dock-body">
        <iframe
          src={SRC}
          title="크리스마스 캐럴 재생목록"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

/** Under the check-in: opens the window. */
export function CarolRail() {
  return (
    <button
      type="button"
      onClick={openCarols}
      className="framed mt-4 flex w-full items-center gap-1.5 p-4 text-sm font-semibold text-foreground hover:text-primary"
    >
      <Music className="h-4 w-4 text-primary" />
      크리스마스 캐럴 듣기
    </button>
  );
}

/** The events page's music tab. */
export function CarolTab() {
  return (
    <section className="framed bg-card p-5 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Music className="h-5 w-5 text-primary" />
        크리스마스 캐럴
      </h2>
      <p className="text-sm text-muted-foreground">
        유튜브 재생목록입니다. 작은 창으로 열려서 다른 페이지로 옮겨도 계속
        나옵니다. 접으면 숨긴 채로 계속 재생되고, 닫으면 멈춥니다.
      </p>
      <Button onClick={openCarols}>
        <Music className="h-4 w-4" />
        캐럴 틀기
      </Button>
    </section>
  );
}
