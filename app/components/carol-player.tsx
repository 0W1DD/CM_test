// Christmas songs from a YouTube playlist, in YouTube's own player: under
// the check-in on wide screens (folded until opened), and in the events
// page's music tab. The player loads only once opened, and opening it puts
// the fireplace out so the two do not play over each other.
import { ChevronDown, Music } from "lucide-react";
import { useState } from "react";
import { quietFire } from "~/components/campfire";

const PLAYLIST = "PLzLmKWYW3AHd1uGgcDg98om9Bx48AtQEG";
const SRC = `https://www.youtube-nocookie.com/embed/videoseries?list=${PLAYLIST}`;

/** The player itself, 16:9. */
export function CarolPlayer() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={SRC}
        title="크리스마스 캐럴 재생목록"
        className="absolute inset-0 h-full w-full"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

/** Under the check-in: a card that opens into the player. */
export function CarolRail() {
  const [open, setOpen] = useState(false);
  return (
    <div className="framed mt-4 p-4 space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) quietFire();
          setOpen(!open);
        }}
        className="flex w-full items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        <Music className="h-4 w-4 text-primary" />
        크리스마스 캐럴
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <CarolPlayer />}
    </div>
  );
}
