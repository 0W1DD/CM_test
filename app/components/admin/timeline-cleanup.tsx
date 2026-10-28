import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eraser } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/hooks/useAuth";
import { errorMessage, mutate, query } from "~/lib/naru";

const today = () => {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

/**
 * The owner's timeline clean-up: pick a day, count what goes (posts written
 * before that day and every reply under them, announcements kept unless
 * unticked), then confirm. Deleted posts leave the timeline and search.
 */
export function TimelineCleanup() {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(today);
  const [keepAnnouncements, setKeepAnnouncements] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  // Local midnight of the chosen day: posts before it go.
  const before = () => new Date(`${day}T00:00:00`).toISOString();
  const reset = () => setCount(null);

  const countPosts = async () => {
    setCounting(true);
    try {
      const result = await query<{ count: number }>("posts:purgeCount", {
        before: before(),
        keep_announcements: keepAnnouncements,
      });
      setCount(result.count);
    } catch (error) {
      toast.error(errorMessage(error, "세지 못했습니다"));
    } finally {
      setCounting(false);
    }
  };

  const purge = useMutation({
    mutationFn: async () => {
      if (!currentProfile) throw new Error("프로필을 선택하세요");
      try {
        return await mutate<{ deleted: number }>("posts:adminPurge", {
          profile_id: currentProfile.id,
          before: before(),
          keep_announcements: keepAnnouncements,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "지우지 못했습니다"));
      }
    },
    onSuccess: (result) => {
      toast.success(`게시물 ${result.deleted}개를 지웠습니다`);
      setCount(null);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-destructive rounded-lg flex items-center justify-center">
          <Eraser className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">타임라인 정리</h2>
          <p className="text-sm text-muted-foreground">
            고른 날짜 이전에 쓴 글을 그 아래 답글까지 한꺼번에 지웁니다.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="date"
            value={day}
            max={today()}
            onChange={(e) => {
              setDay(e.target.value);
              reset();
            }}
            className="border border-border bg-background px-2 h-9 text-sm"
          />
          이전 글
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={keepAnnouncements}
            onChange={(e) => {
              setKeepAnnouncements(e.target.checked);
              reset();
            }}
          />
          공지사항은 남기기
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!day || counting}
          onClick={countPosts}
        >
          {counting ? "세는 중..." : "지울 글 세어 보기"}
        </Button>
      </div>
      {count !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-foreground">
            {count === 0
              ? "지울 글이 없습니다."
              : `${day} 이전 글 ${count}개(답글 포함)가 지워집니다. 되돌릴 수 없어요.`}
          </p>
          {count > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={purge.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `정말 게시물 ${count}개를 지울까요? 지운 글은 되돌릴 수 없습니다.`,
                  )
                )
                  purge.mutate();
              }}
            >
              {purge.isPending ? "지우는 중..." : `${count}개 지우기`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
