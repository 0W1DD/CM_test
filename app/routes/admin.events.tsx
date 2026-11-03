// The gift exchange for the staff: a week's participants, who each gives
// to (pinned by hand, or drawn), and every gift written.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminGate,
  BackToAdmin,
  formatDateTime,
  PageHeader,
} from "~/components/admin/ui";
import { GiftContent } from "~/components/gift-content";
import { LoadingState } from "~/components/shared/LoadingState";
import {
  type Brief,
  type GiftImage,
  kstLastMinute,
  kstTime,
} from "~/lib/events";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [{ title: "선물 교환식 관리" }];
}

interface Entry {
  giver: Brief | null;
  recipient: Brief | null;
  pinned: boolean;
  submitted: boolean;
  submitted_at: string | null;
  content: string | null;
  images: GiftImage[];
}

interface Week {
  week: string;
  signup_ends: string;
  gifts_close: string;
  opens: string;
  weeks: string[];
  assigned_at: string | null;
  paid_at: string | null;
  entries: Entry[];
}

function GiftExchangeAdmin() {
  const queryClient = useQueryClient();
  const [week, setWeek] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["gift-admin", week],
    queryFn: () => query<Week>("events:admin", week ? { week } : {}),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["gift-admin"] });

  const pin = useMutation({
    mutationFn: async (p: { giver: string; recipient: string | null }) => {
      try {
        await mutate("events:giftPin", {
          week: data?.week,
          profile_id: p.giver,
          recipient_id: p.recipient,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "지정하지 못했습니다"));
      }
    },
    onSuccess: (_, p) => {
      toast.success(
        p.recipient ? "받는 사람을 지정했습니다" : "지정을 풀었습니다",
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data)
    return <LoadingState message="불러오는 중..." asCard={false} />;
  // Pairs are pinned until sign-up closes; then the draw makes them final.
  const closed = Date.now() >= Date.parse(data.signup_ends);
  const participants = data.entries.flatMap((e) => (e.giver ? [e.giver] : []));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          주
          <select
            value={data.week}
            onChange={(e) => setWeek(e.target.value)}
            className="border border-border bg-background px-2 h-9 text-sm"
          >
            {data.weeks.map((w) => (
              <option key={w} value={w}>
                {w} 주
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="text-sm text-muted-foreground space-y-0.5">
        <p>
          신청 마감 {kstLastMinute(data.signup_ends)} · 선물 마감{" "}
          {kstTime(data.gifts_close)} · 열림 {kstTime(data.opens)}
        </p>
        <p>
          {closed
            ? data.assigned_at
              ? `배정 완료 (${formatDateTime(data.assigned_at)}) · 지정 잠김`
              : "신청 마감 · 첫 접속 때 자동 배정됩니다"
            : "신청 마감 전: 찌름 요청은 지금 지정하세요. 마감 때 나머지가 랜덤 배정됩니다. 받는 사람은 보내는 사람에게 공개되지 않습니다."}
          {data.paid_at && ` · 코인 지급됨 (${formatDateTime(data.paid_at)})`}
        </p>
        <p>
          신청 {data.entries.length}명 · 선물 입력{" "}
          {data.entries.filter((e) => e.submitted).length}명
        </p>
      </div>

      {data.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          이 주에는 신청자가 없습니다.
        </p>
      ) : (
        <ul className="framed divide-y divide-border">
          {data.entries.map((entry) => {
            const giverId = entry.giver?.id ?? "";
            return (
              <li key={giverId} className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {entry.giver?.name ?? "알 수 없음"}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    value={entry.recipient?.id ?? ""}
                    disabled={closed || pin.isPending}
                    onChange={(e) =>
                      pin.mutate({
                        giver: giverId,
                        recipient: e.target.value || null,
                      })
                    }
                    className="border border-border bg-background px-2 h-8 text-sm"
                  >
                    <option value="">(랜덤)</option>
                    {participants
                      .filter((p) => p.id !== giverId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (@{p.username})
                        </option>
                      ))}
                  </select>
                  {entry.pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Pin className="h-3 w-3" />
                      지정
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {entry.submitted_at
                      ? `선물 입력 ${formatDateTime(entry.submitted_at)}`
                      : "선물 미입력"}
                  </span>
                  {entry.submitted && (
                    <button
                      type="button"
                      onClick={() => setOpen(open === giverId ? null : giverId)}
                      className="text-xs text-primary hover:underline"
                    >
                      {open === giverId ? "접기" : "선물 보기"}
                    </button>
                  )}
                </div>
                {open === giverId && (
                  <div className="border-l-2 border-border pl-3">
                    <GiftContent
                      content={entry.content}
                      images={entry.images}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        신청 마감 전까지 받는 사람을 고르면 그 짝은 지정(📌)되어 랜덤 배정에서
        빠집니다. "(랜덤)"을 고르면 지정이 풀립니다. 받는 사람은 보내는 사람에게
        보이지 않습니다.
      </p>
    </div>
  );
}

export default function AdminEvents() {
  return (
    <AdminGate need="staff">
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-4">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={Gift}
          title="선물 교환식"
          description="주간 선물 교환식의 신청자, 받는 사람 지정, 입력된 선물을 봅니다."
          tone="lilac"
        />
        <GiftExchangeAdmin />
      </div>
    </AdminGate>
  );
}
