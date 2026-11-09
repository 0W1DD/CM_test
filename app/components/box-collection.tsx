// The Christmas random box's collection (도감, naru/queries/boxes.ts): a
// short list by the calendar on wide screens, the whole book on the events
// page, and the card that shows what a box gave.
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Gift } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { useAuth } from "~/hooks/useAuth";
import { query } from "~/lib/naru";

export interface BoxCollection {
  total: number;
  collected: number;
  recent: { entry: string; count: number; last_at: string }[];
  categories: { name: string; entries: { entry: string; count: number }[] }[];
}

export interface BoxDraw {
  entry: string;
  category: string;
  is_new: boolean;
  collected: number;
}

export const boxCollectionKey = (profileId: string | undefined) => [
  "box-collection",
  profileId,
];

/** The acting profile's collection (or `profileId`'s). */
export function useBoxCollection(profileId?: string) {
  const { currentProfile } = useAuth();
  const id = profileId ?? currentProfile?.id;
  return useQuery({
    queryKey: boxCollectionKey(id),
    queryFn: () => query<BoxCollection>("boxes:collection", { profile_id: id }),
    enabled: !!id,
  });
}

/** Under the calendar: how far the book is, and the latest finds. */
export function BoxCollectionRail() {
  const { data } = useBoxCollection();
  if (!data) return null;
  return (
    <div className="framed mt-4 p-4 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <BookOpen className="h-4 w-4 text-primary" />
        크리스마스 도감
        <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
          {data.collected} / {data.total}
        </span>
      </p>
      {data.recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          상점에서 랜덤박스를 사서 열면 여기에 모입니다.
        </p>
      ) : (
        <ul className="max-h-40 overflow-y-auto space-y-0.5 text-sm">
          {data.recent.map((r) => (
            <li key={r.entry} className="flex items-center gap-2">
              <span className="truncate">{r.entry}</span>
              {r.count > 1 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  ×{r.count}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/events#collection"
        className="block text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        도감 전체 보기
      </Link>
    </div>
  );
}

/** The whole book by category; what is not found yet shows as ？？？. */
export function BoxCollectionBook() {
  const { data } = useBoxCollection();
  if (!data) return null;
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: the rail's link aims at /events#collection; the book is on that page once.
    <section id="collection" className="framed p-5 space-y-3">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <BookOpen className="h-5 w-5 text-primary" />
        크리스마스 도감
        <span className="ml-auto text-sm font-normal text-muted-foreground tabular-nums">
          {data.collected} / {data.total}
        </span>
      </h2>
      <p className="text-sm text-muted-foreground">
        상점에서 랜덤박스를 사서 열면 나온 물건이 도감에 모입니다. 아직 모으지
        않은 물건이 남아 있는 동안은 같은 물건이 다시 나오지 않습니다.
      </p>
      <div className="space-y-2">
        {data.categories.map((c) => {
          const got = c.entries.filter((e) => e.count > 0).length;
          return (
            <details key={c.name} className="border border-border">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
                {c.name}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {got} / {c.entries.length}
                </span>
              </summary>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-3 text-sm sm:grid-cols-3">
                {c.entries.map((e) => (
                  <li
                    key={e.entry}
                    className={
                      e.count > 0 ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {e.count > 0 ? e.entry : "？？？"}
                    {e.count > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ×{e.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}

/** What an opened box gave. */
export function BoxRevealDialog({
  draw,
  total,
  onClose,
}: {
  draw: BoxDraw | null;
  total?: number;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!draw} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm text-center">
        {draw && (
          <div className="gift-rise space-y-3 py-2">
            <Gift className="mx-auto h-10 w-10 text-primary" />
            <DialogDescription>
              {draw.category}
              {draw.is_new ? " · 새로 도감에 등록!" : " · 이미 가진 물건"}
            </DialogDescription>
            <DialogTitle className="text-2xl">{draw.entry}</DialogTitle>
            <p className="text-sm text-muted-foreground tabular-nums">
              도감 {draw.collected}
              {total ? ` / ${total}` : ""}
            </p>
            <Button onClick={onClose}>확인</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
