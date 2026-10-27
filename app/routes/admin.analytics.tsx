// Activity analytics (commung's console analytics page), for the owner and
// moderators. The timeline's stacked bars are drawn with plain elements,
// since the app has no chart library.
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { BarChart3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminGate, BackToAdmin, PageHeader } from "~/components/admin/ui";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { errorMessage, query } from "~/lib/naru";

export function meta() {
  return [{ title: "활동 분석" }];
}

const TIME_RANGES = [
  { value: 7, label: "7일" },
  { value: 14, label: "14일" },
  { value: 30, label: "30일" },
  { value: 90, label: "90일" },
] as const;

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type Series = "posts" | "directMessages" | "groupMessages";
const SERIES: { key: Series; label: string; color: string }[] = [
  { key: "posts", label: "게시글", color: "var(--chart-5)" },
  { key: "directMessages", label: "DM", color: "var(--chart-3)" },
  { key: "groupMessages", label: "그룹 DM", color: "var(--chart-2)" },
];

interface ActiveProfile {
  profile_id: string;
  profile_name: string;
  profile_username: string;
  avatar_url: string | null;
  posts_count: number;
  dms_count: number;
  group_messages_count: number;
  total_activity: number;
}

type ActivityData = {
  timeline: Record<Series, Array<{ date: string; count: number }>>;
  hourlyTimeline: Record<Series, Array<{ datetime: string; count: number }>>;
  heatmap: Record<
    Series,
    Array<{ hour: number; dayOfWeek: number; count: number }>
  >;
  totals: Record<Series, number>;
  mostActiveProfiles: ActiveProfile[];
  leastActiveProfiles: ActiveProfile[];
};

type Bar = { key: string; label: string; title: string } & Record<
  Series,
  number
>;

const hourKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}T${date.getHours()}`;

function Timeline({ bars, width }: { bars: Bar[]; width: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const max = Math.max(
    1,
    ...bars.map((b) => b.posts + b.directMessages + b.groupMessages),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the latest when bars change
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [bars]);
  const labelEvery = Math.max(1, Math.ceil(bars.length / 30));
  return (
    <div ref={scrollRef} className="w-full overflow-x-auto">
      <div
        className="flex items-end gap-1 h-[320px] pt-4"
        style={{ width: Math.max(600, bars.length * width) }}
      >
        {bars.map((bar, index) => {
          const total = bar.posts + bar.directMessages + bar.groupMessages;
          return (
            <div
              key={bar.key}
              className="flex flex-col items-center justify-end h-full flex-1 min-w-0"
              title={`${bar.title}\n${SERIES.map((s) => `${s.label}: ${bar[s.key]}`).join("\n")}`}
            >
              <div
                className="w-full flex flex-col-reverse rounded-sm overflow-hidden"
                style={{ height: `${(total / max) * 85}%` }}
              >
                {SERIES.map((s) => (
                  <div
                    key={s.key}
                    style={{
                      backgroundColor: s.color,
                      height: total ? `${(bar[s.key] / total) * 100}%` : 0,
                    }}
                  />
                ))}
              </div>
              <div className="h-[15%] text-[10px] text-muted-foreground whitespace-nowrap pt-1 -rotate-45 origin-top-left translate-x-2">
                {index % labelEvery === 0 ? bar.label : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Heatmap({
  title,
  data,
  color,
}: {
  title: string;
  data: Array<{ hour: number; dayOfWeek: number; count: number }>;
  color: string;
}) {
  const grid = Array.from({ length: 7 }, (_, day) =>
    Array.from(
      { length: 24 },
      (_, hour) =>
        data.find((e) => e.dayOfWeek === day && e.hour === hour)?.count ?? 0,
    ),
  );
  const max = Math.max(...grid.flat(), 1);
  const colorOf = (value: number) =>
    value === 0
      ? "color-mix(in oklch, var(--muted-foreground) 10%, transparent)"
      : `color-mix(in oklch, ${color} ${Math.round((0.3 + (value / max) * 0.7) * 100)}%, transparent)`;
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <div className="inline-flex">
          <div className="w-8">
            <div className="h-6 mb-2" />
            <div className="space-y-1">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="h-5 flex items-center justify-end pr-2 text-xs text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex gap-1 mb-2 h-6">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="w-5 text-[10px] text-muted-foreground text-center"
                >
                  {hour % 3 === 0 ? hour : ""}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {grid.map((row, day) => (
                <div key={DAYS_OF_WEEK[day]} className="flex gap-1">
                  {row.map((count, hour) => (
                    <div
                      key={`${DAYS_OF_WEEK[day]}-${HOURS[hour]}`}
                      className="w-5 h-5 rounded-sm border border-border/50"
                      style={{ backgroundColor: colorOf(count) }}
                      title={`${DAYS_OF_WEEK[day]} ${hour}시: ${count}개`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileList({
  title,
  profiles,
}: {
  title: string;
  profiles: ActiveProfile[];
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {profiles.length > 0 ? (
        <div className="space-y-3">
          {profiles.map((profile, index) => (
            <div
              key={profile.profile_id}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
            >
              <div className="flex-shrink-0 w-8 text-center text-sm font-semibold text-muted-foreground">
                #{index + 1}
              </div>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.profile_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                  {profile.profile_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {profile.profile_name}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  @{profile.profile_username}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-semibold">{profile.total_activity}</div>
                <div className="text-xs text-muted-foreground">
                  게시글 {profile.posts_count} · DM {profile.dms_count} · 그룹{" "}
                  {profile.group_messages_count}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">
          활동 데이터가 없습니다
        </p>
      )}
    </div>
  );
}

function Analytics() {
  const [days, setDays] = useState(30);
  const [view, setView] = useState<"daily" | "hourly">("daily");
  const { data, isLoading, error } = useQuery({
    queryKey: ["community-activity", days],
    queryFn: () => query<ActivityData>("analytics:activity", { days }),
  });

  const daily: Bar[] = (() => {
    if (!data) return [];
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    return eachDayOfInterval({ start, end }).map((date) => {
      const key = format(date, "yyyy-MM-dd");
      const count = (series: Series) =>
        data.timeline[series].find((p) => p.date === key)?.count ?? 0;
      return {
        key,
        label: format(date, "M/d", { locale: ko }),
        title: format(date, "yyyy년 M월 d일", { locale: ko }),
        posts: count("posts"),
        directMessages: count("directMessages"),
        groupMessages: count("groupMessages"),
      };
    });
  })();

  const hourly: Bar[] = (() => {
    if (!data) return [];
    const maps = Object.fromEntries(
      SERIES.map((s) => [
        s.key,
        new Map(
          data.hourlyTimeline[s.key].map((p) => [
            hourKey(parseISO(p.datetime)),
            p.count,
          ]),
        ),
      ]),
    ) as Record<Series, Map<string, number>>;
    const end = new Date();
    end.setMinutes(0, 0, 0);
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    const out: Bar[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += 3600000) {
      const date = new Date(t);
      const key = hourKey(date);
      out.push({
        key,
        label: format(date, "M/d H시", { locale: ko }),
        title: format(date, "M월 d일 H시", { locale: ko }),
        posts: maps.posts.get(key) ?? 0,
        directMessages: maps.directMessages.get(key) ?? 0,
        groupMessages: maps.groupMessages.get(key) ?? 0,
      });
    }
    return out;
  })();

  if (isLoading)
    return (
      <LoadingState message="로딩 중..." asCard={false} className="py-16" />
    );
  if (error || !data)
    return (
      <p className="text-destructive text-center">
        {errorMessage(error, "활동 데이터를 불러올 수 없습니다")}
      </p>
    );

  return (
    <div className="space-y-8">
      <div className="flex gap-2">
        {TIME_RANGES.map((range) => (
          <Button
            key={range.value}
            variant={days === range.value ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["총 게시글", data.totals.posts],
          ["총 DM", data.totals.directMessages],
          ["총 그룹 DM", data.totals.groupMessages],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">활동 타임라인</h2>
          <div className="flex gap-2">
            <Button
              variant={view === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("daily")}
            >
              일별
            </Button>
            <Button
              variant={view === "hourly" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("hourly")}
            >
              시간별
            </Button>
          </div>
        </div>
        {view === "daily" ? (
          <Timeline bars={daily} width={40} />
        ) : (
          <Timeline bars={hourly} width={12} />
        )}
        <div className="flex items-center justify-center gap-6 mt-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-sm">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Heatmap
          title="게시글 활동 히트맵"
          data={data.heatmap.posts}
          color="var(--chart-5)"
        />
        <Heatmap
          title="DM 활동 히트맵"
          data={data.heatmap.directMessages}
          color="var(--chart-3)"
        />
        <Heatmap
          title="그룹 DM 활동 히트맵"
          data={data.heatmap.groupMessages}
          color="var(--chart-2)"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProfileList
          title="가장 활발한 프로필"
          profiles={data.mostActiveProfiles}
        />
        <ProfileList
          title="가장 조용한 프로필"
          profiles={data.leastActiveProfiles}
        />
      </div>
    </div>
  );
}

export default function CommunityAnalytics() {
  return (
    <AdminGate need="staff">
      <div className="w-full py-8 px-4 sm:px-6 space-y-6">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={BarChart3}
          title="활동 분석"
          description="커뮤니티의 게시글 및 DM 활동 통계 (한국 시간 기준)"
          tone="mint"
        />
        <Analytics />
      </div>
    </AdminGate>
  );
}
