import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/hooks/useAuth";
import { errorMessage, mutate, query } from "~/lib/naru";

type Target = "timeline" | "uses";
type Scope = "all" | "posts" | "replies";
type Status = "all" | "approved" | "pending";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "글과 답글 모두" },
  { value: "posts", label: "원글만 (아래 답글까지)" },
  { value: "replies", label: "답글만" },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "모든 기록" },
  { value: "approved", label: "승인된 기록만" },
  { value: "pending", label: "승인 대기만" },
];

/** A datetime-local value as ISO, or undefined when empty. */
const isoOf = (local: string) =>
  local ? new Date(local).toISOString() : undefined;

const field =
  "border border-border bg-background px-2 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

/**
 * The staff's clean-up: the timeline (posts, replies or both, anyone's or
 * one person's, all of it or a stretch of time, announcement threads kept
 * unless unticked) or the use log. Count what goes, then confirm.
 */
export function TimelineCleanup() {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Target>("timeline");
  const [allTime, setAllTime] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [username, setUsername] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [keepAnnouncements, setKeepAnnouncements] = useState(true);
  const [status, setStatus] = useState<Status>("all");
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  // Opened from the use log's link: scroll here, on the use log.
  const { hash } = useLocation();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hash !== "#cleanup") return;
    setTarget("uses");
    box.current?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  const reset = () => setCount(null);
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      reset();
    };

  const args = () => ({
    ...(!allTime && { after: isoOf(from), before: isoOf(to) }),
    ...(username.trim() && { username: username.trim() }),
    ...(target === "timeline"
      ? { scope, keep_announcements: keepAnnouncements }
      : status !== "all" && { status }),
  });

  const noun = target === "timeline" ? "게시물" : "사용 기록";

  const countThem = async () => {
    setCounting(true);
    try {
      const result = await query<{ count: number }>(
        target === "timeline" ? "posts:purgeCount" : "uses:purgeCount",
        args(),
      );
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
        return target === "timeline"
          ? await mutate<{ deleted: number }>("posts:adminPurge", {
              profile_id: currentProfile.id,
              ...args(),
            })
          : await mutate<{ deleted: number }>("uses:purge", args());
      } catch (error) {
        throw new Error(errorMessage(error, "지우지 못했습니다"));
      }
    },
    onSuccess: (result) => {
      toast.success(`${noun} ${result.deleted}개를 지웠습니다`);
      setCount(null);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      ref={box}
      className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-4 scroll-mt-20"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-destructive rounded-lg flex items-center justify-center">
          <Eraser className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">한꺼번에 지우기</h2>
          <p className="text-sm text-muted-foreground">
            조건을 골라 타임라인 글이나 사용 로그를 한꺼번에 지웁니다.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="지울 곳" className="flex gap-1">
        {(
          [
            ["timeline", "타임라인"],
            ["uses", "사용 로그"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={target === value}
            onClick={() => change(setTarget)(value)}
            className={`px-3 h-8 text-sm rounded-md border transition-colors ${
              target === value
                ? "border-primary text-primary bg-primary/10 font-semibold"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 text-sm">
        <fieldset className="space-y-2">
          <legend className="font-semibold text-foreground mb-1">기간</legend>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="cleanup-period"
                checked={allTime}
                onChange={() => change(setAllTime)(true)}
              />
              지금까지 전부
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="cleanup-period"
                checked={!allTime}
                onChange={() => change(setAllTime)(false)}
              />
              기간 정하기
            </label>
          </div>
          {!allTime && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => change(setFrom)(e.target.value)}
                className={field}
                aria-label="시작"
              />
              <span className="text-muted-foreground">부터</span>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => change(setTo)(e.target.value)}
                className={field}
                aria-label="끝"
              />
              <span className="text-muted-foreground">
                까지 (비워 두면 처음부터 / 지금까지)
              </span>
            </div>
          )}
        </fieldset>

        <label className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">누구의</span>
          <input
            value={username}
            onChange={(e) => change(setUsername)(e.target.value)}
            placeholder="@아이디 (비워 두면 모두)"
            className={`${field} w-56`}
          />
        </label>

        {target === "timeline" ? (
          <>
            <label className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">무엇을</span>
              <select
                value={scope}
                onChange={(e) => change(setScope)(e.target.value as Scope)}
                className={field}
              >
                {SCOPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-muted-foreground">
              <input
                type="checkbox"
                checked={keepAnnouncements}
                onChange={(e) => change(setKeepAnnouncements)(e.target.checked)}
              />
              공지사항과 그 아래 답글은 남기기
            </label>
            <p className="text-xs text-muted-foreground">
              지우는 글 아래에 달린 답글은 언제 썼든 함께 지워집니다.
            </p>
          </>
        ) : (
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">무엇을</span>
            <select
              value={status}
              onChange={(e) => change(setStatus)(e.target.value as Status)}
              className={field}
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              기록과 댓글만 지워지고, 사용한 아이템은 돌아오지 않습니다.
            </span>
          </label>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={counting}
          onClick={countThem}
        >
          {counting ? "세는 중..." : `지울 ${noun} 세어 보기`}
        </Button>
      </div>

      {count !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-foreground">
            {count === 0
              ? `지울 ${noun}이 없습니다.`
              : `${noun} ${count}개가 지워집니다. 되돌릴 수 없어요.`}
          </p>
          {count > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={purge.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `정말 ${noun} ${count}개를 지울까요? 되돌릴 수 없습니다.`,
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
