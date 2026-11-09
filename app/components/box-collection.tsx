// The Christmas random box's book (도감, naru/queries/boxes.ts), shared by
// the whole community: a notebook with a tab per category, each page
// scrolling, a red dot on what was registered since this browser last
// looked, and the card that shows what an opened box gave.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage, mutate, query } from "~/lib/naru";

export interface BoxBook {
  total: number;
  registered: number;
  latest_at: string | null;
  categories: {
    name: string;
    total: number;
    entries: {
      entry: string;
      registered_at: string;
      by: { name: string; username: string | null } | null;
    }[];
  }[];
}

export interface BoxDraw {
  entry: string;
  category: string;
  item_id: string;
  registered: boolean;
}

const BOOK_KEY = ["box-book"];
const SEEN_KEY = "commung-box-book-seen";
const OPEN_KEY = "commung-box-book-open";

export function useBoxBook() {
  return useQuery({
    queryKey: BOOK_KEY,
    queryFn: () => query<BoxBook>("boxes:collection"),
  });
}

/** When this browser last looked at each category's page. */
function loadSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const hasNew = (
  category: BoxBook["categories"][number],
  seen: Record<string, string>,
) => {
  const since = seen[category.name] ?? "";
  return category.entries.some((e) => e.registered_at > since);
};

/** Registers an item the acting profile holds in the book. */
export function useRegisterBox(onDone?: () => void) {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!currentProfile) throw new Error("프로필을 선택하세요");
      try {
        return await mutate<{
          entry: string;
          coins: number;
          currency: string | null;
        }>("boxes:register", {
          profile_id: currentProfile.id,
          item_id: itemId,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "도감에 등록하지 못했습니다"));
      }
    },
    onSuccess: (result) => {
      toast.success(
        result.coins
          ? `${result.entry}을(를) 도감에 처음 등록했습니다! ${result.currency} ${result.coins}개를 받았습니다.`
          : `${result.entry}을(를) 도감에 등록했습니다.`,
      );
      queryClient.invalidateQueries({ queryKey: ["events-status"] });
      queryClient.invalidateQueries({ queryKey: BOOK_KEY });
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * The notebook: category tabs along the top (a red dot on those with
 * something new), the open page's entries on ruled lines, scrolling inside.
 * `tall` for the events page; `folding` (under the calendar) starts shut,
 * its title opening and closing it, as this browser last left it. The
 * staff get a reset at the foot.
 */
export function BoxNotebook({
  tall = false,
  folding = false,
  tour,
}: {
  tall?: boolean;
  folding?: boolean;
  tour?: string;
}) {
  const { data } = useBoxBook();
  const [open, setOpen] = useState(() => {
    if (!folding) return true;
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {}
  };
  // The tabs scroll sideways with the wheel, their scrollbar hidden.
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabs.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || !e.deltaY) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });
  const { isModerator } = useCurrentInstance();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [seen, setSeen] = useState(loadSeen);
  const page = data?.categories[tab];

  // The open page counts as seen, a moment after it shows.
  useEffect(() => {
    if (!open || !page || !hasNew(page, seen)) return;
    const id = setTimeout(() => {
      const next = { ...loadSeen(), [page.name]: new Date().toISOString() };
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {}
      setSeen(next);
    }, 1500);
    return () => clearTimeout(id);
  }, [open, page, seen]);

  const reset = useMutation({
    mutationFn: async () => {
      try {
        return await mutate<{ removed: number }>("boxes:reset");
      } catch (error) {
        throw new Error(errorMessage(error, "도감을 초기화하지 못했습니다"));
      }
    },
    onSuccess: (r) => {
      toast.success(`도감을 비웠습니다 (${r.removed}개).`);
      queryClient.invalidateQueries({ queryKey: BOOK_KEY });
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || !page) return null;
  const anyNew = data.categories.some((c) => hasNew(c, seen));
  return (
    <div className="box-notebook" data-tour={tour}>
      <button
        type="button"
        className="box-notebook-head w-full text-left"
        onClick={folding ? toggle : undefined}
        aria-expanded={open}
        disabled={!folding}
      >
        <span className="relative font-semibold">
          크리스마스 도감
          {anyNew && <span className="box-dot -right-2.5 top-0" />}
        </span>
        <span className="ml-auto tabular-nums text-xs">
          {data.registered} / {data.total}
        </span>
        {folding && (
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && (
        <>
          <div className="box-notebook-tabs" role="tablist" ref={tabs}>
            {data.categories.map((c, i) => (
              <button
                key={c.name}
                type="button"
                role="tab"
                aria-selected={i === tab}
                onClick={() => setTab(i)}
                className={`box-notebook-tab ${i === tab ? "is-open" : ""}`}
              >
                {c.name}
                {hasNew(c, seen) && (
                  <span className="box-dot -right-1 -top-1" />
                )}
              </button>
            ))}
          </div>
          <div
            className={`box-notebook-page ${tall ? "h-96" : "h-40"}`}
            role="tabpanel"
          >
            <p className="box-notebook-line text-xs opacity-70">
              {page.name} · {page.entries.length} / {page.total}
            </p>
            {page.entries.length === 0 ? (
              <p className="box-notebook-line opacity-70">
                아직 등록된 물건이 없습니다.
              </p>
            ) : (
              page.entries.map((e) => (
                <p key={e.entry} className="box-notebook-line flex gap-2">
                  <span className="truncate">{e.entry}</span>
                  {e.by && (
                    <span className="ml-auto shrink-0 text-xs opacity-60">
                      {e.by.name}
                    </span>
                  )}
                </p>
              ))
            )}
          </div>
          {isModerator && (
            <div className="box-notebook-foot">
              <button
                type="button"
                disabled={reset.isPending}
                onClick={() => {
                  if (
                    confirm(
                      "도감을 모두 비울까요? 회원들이 가진 물건은 그대로 남습니다.",
                    )
                  )
                    reset.mutate();
                }}
              >
                도감 초기화 (운영진)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The book, on the events page. */
export function BoxCollectionBook() {
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: links aim at /events#collection; the book is on that page once.
    <section id="collection">
      <BoxNotebook tall />
    </section>
  );
}

/** What an opened box gave, with the button that registers it. */
export function BoxRevealDialog({
  draw,
  onClose,
}: {
  draw: BoxDraw | null;
  onClose: () => void;
}) {
  const register = useRegisterBox(onClose);
  return (
    <Dialog open={!!draw} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm text-center">
        {draw && (
          <div className="gift-rise space-y-3 py-2">
            <DialogDescription>{draw.category}</DialogDescription>
            <DialogTitle className="text-2xl">{draw.entry}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              인벤토리에 들어갔습니다.
              {draw.registered
                ? " 이미 도감에 등록된 물건입니다."
                : " 아직 도감에 없는 물건이에요!"}
            </p>
            <div className="flex justify-center gap-2">
              {!draw.registered && (
                <Button
                  disabled={register.isPending}
                  onClick={() => register.mutate(draw.item_id)}
                >
                  도감에 등록
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
