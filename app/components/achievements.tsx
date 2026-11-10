// Achievements (naru/modules/achievements.ts): the watcher that, after the
// acting profile does something, asks what it newly reached and shows a
// card for it, and the list on the events page's tab.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { MUTATED, mutate, query } from "~/lib/naru";

const TIER = ["Ⅰ", "Ⅱ", "Ⅲ"];

interface Reached {
  key: string;
  name: string;
  tier: number;
  coins: number;
  badge: { name: string; emoji: string } | null;
}

export interface AchievementRow {
  key: string;
  name: string;
  condition: string;
  unit: string;
  progress: number;
  tiers: {
    tier: number;
    goal: number;
    coins: number;
    reached_at: string | null;
  }[];
  badge: { name: string; emoji: string } | null;
}

/**
 * Once for the site (root.tsx): checks the acting profile when it is
 * picked, and a moment after each thing it does.
 */
export function AchievementWatcher() {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const profileId = currentProfile?.id ?? null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profileId) return;
    const run = async () => {
      let reached: Reached[];
      try {
        ({ reached } = await mutate<{ reached: Reached[] }>(
          "achievements:check",
          { profile_id: profileId },
        ));
      } catch {
        return; // not signed in, or the profile not active yet
      }
      if (!reached.length) return;
      for (const r of reached)
        toast(
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div>
              <div className="font-semibold">
                업적 달성! {r.name} {TIER[r.tier - 1]}
              </div>
              <div className="text-sm text-muted-foreground">
                {r.coins > 0 && `코인 ${r.coins}개를 받았어요.`}
                {r.badge &&
                  ` 칭호 「${r.badge.emoji} ${r.badge.name}」도 받았어요.`}
              </div>
            </div>
          </div>,
          { duration: 6000 },
        );
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
    };
    run();
    const later = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, 1500);
    };
    window.addEventListener(MUTATED, later);
    return () => {
      window.removeEventListener(MUTATED, later);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [profileId, queryClient]);
  return null;
}

/** The events page's tab: every achievement, and how far along it is. */
export function AchievementsTab() {
  const { currentProfile } = useAuth();
  const profileId = currentProfile?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["achievements", profileId],
    queryFn: () =>
      query<AchievementRow[]>("achievements:list", { profile_id: profileId }),
    enabled: !!profileId,
    staleTime: 30_000,
  });
  if (!profileId)
    return (
      <p className="text-sm text-muted-foreground">
        프로필을 고르면 업적을 볼 수 있어요.
      </p>
    );
  if (isLoading || !data)
    return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  return (
    <section className="framed bg-card p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-primary" />
          업적
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          단계마다 코인 2 · 5 · 10개를 받고, 마지막 단계에서는 칭호도 받아요.
          칭호는 내 프로필에서 눌러 이름 옆에 달 수 있어요.
        </p>
      </div>
      <ul className="space-y-3">
        {data.map((a) => {
          const done = a.tiers.filter((t) => t.reached_at).length;
          const next = a.tiers.find((t) => !t.reached_at);
          const goal = next?.goal ?? a.tiers[a.tiers.length - 1]?.goal ?? 1;
          const pct = Math.min(100, Math.round((a.progress / goal) * 100));
          return (
            <li
              key={a.key}
              className="border-[1.5px] border-[var(--frame)] bg-background p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  {a.condition}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                  {next
                    ? `${a.progress.toLocaleString()} / ${goal.toLocaleString()}${a.unit}`
                    : "모두 달성!"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {a.tiers.map((t) => (
                  <span
                    key={t.tier}
                    className={`achievement-tier ${t.reached_at ? "is-reached" : ""}`}
                    title={
                      t.reached_at
                        ? `${new Date(t.reached_at).toLocaleDateString("ko-KR")} 달성`
                        : undefined
                    }
                  >
                    {TIER[t.tier - 1]} {t.goal.toLocaleString()}
                    {a.unit} · 코인 {t.coins}
                  </span>
                ))}
                {a.badge && (
                  <span
                    className={`profile-badge ${done === 3 ? "" : "opacity-50"}`}
                    title="Ⅲ단계 칭호"
                  >
                    <span aria-hidden>{a.badge.emoji}</span>
                    <span>{a.badge.name}</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
