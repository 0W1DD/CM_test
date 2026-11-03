import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, Gift, PartyPopper } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useEventsStatus } from "~/lib/events";
import { errorMessage, mutate } from "~/lib/naru";

/** The morning check-in button, for the rail and the events page. */
export function CheckInButton({ className = "" }: { className?: string }) {
  const { data, profileId, refresh } = useEventsStatus();
  const checkIn = useMutation({
    mutationFn: async () => {
      try {
        return await mutate<{ coins: number; currency: string }>(
          "events:checkIn",
          { profile_id: profileId },
        );
      } catch (error) {
        throw new Error(errorMessage(error, "출석체크하지 못했습니다"));
      }
    },
    onSuccess: (result) => {
      toast.success(
        `출석 완료! ${result.currency} ${result.coins}개를 받았습니다`,
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return null;
  const { check_in: c, currency } = data;
  return (
    <Button
      className={`w-full h-auto min-h-9 whitespace-normal py-2 ${className}`}
      disabled={c.checked_in || !c.open || !currency || checkIn.isPending}
      onClick={() => checkIn.mutate()}
    >
      <CalendarCheck className="h-4 w-4" />
      {c.checked_in
        ? "오늘 출석 완료"
        : !c.open
          ? "출석은 오전에만 (0~12시)"
          : checkIn.isPending
            ? "출석하는 중..."
            : `출석체크 (+${c.coins} ${currency ?? "코인"})`}
    </Button>
  );
}

/** Signs up for this week's gift exchange, or says it is done. */
export function GiftSignupButton() {
  const { data, profileId, refresh } = useEventsStatus();
  const signup = useMutation({
    mutationFn: async () => {
      try {
        await mutate("events:giftSignup", { profile_id: profileId });
      } catch (error) {
        throw new Error(errorMessage(error, "신청하지 못했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("참여 신청 되었습니다.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return null;
  const { gift } = data;
  if (gift.signed_up)
    return (
      <p className="text-sm font-semibold text-primary">
        참여 신청 되었습니다.
      </p>
    );
  if (gift.phase !== "signup")
    return (
      <p className="text-sm text-muted-foreground">
        이번 주 신청은 마감되었습니다.
      </p>
    );
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={signup.isPending}
      onClick={() => signup.mutate()}
    >
      {signup.isPending ? "신청하는 중..." : "신청"}
    </Button>
  );
}

/**
 * Under the calendar: the morning check-in, and the events taking sign-ups
 * now (the weekly gift exchange), with a word when a gift has arrived.
 */
export function EventsRail() {
  const { data } = useEventsStatus();
  if (!data) return null;
  const { gift, received } = data;
  return (
    <div className="framed mt-4 p-4 space-y-4">
      <CheckInButton />
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-sm font-semibold text-foreground">이벤트 신청</p>
        <p className="text-xs text-muted-foreground">
          현재 신청 받고 있는 이벤트입니다.
        </p>
        <div className="space-y-2 border border-border p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Gift className="h-4 w-4 text-primary" />
            주간 선물 교환식
          </p>
          <p className="text-xs text-muted-foreground">
            신청 {gift.participants}명 · 참여하면 {data.gift_coins}{" "}
            {data.currency ?? "코인"}
          </p>
          <GiftSignupButton />
          {gift.signed_up && (
            <Link
              to="/events"
              className="block text-sm font-medium text-primary hover:underline"
            >
              {gift.recipient
                ? `${gift.recipient.name}에게 선물 보내기 →`
                : "선물 작성하기 →"}
            </Link>
          )}
        </div>
        {received.open && received.count > 0 && (
          <Link
            to="/events"
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <PartyPopper className="h-4 w-4" />
            선물이 도착했어요! 열어보기
          </Link>
        )}
        <Link
          to="/events"
          className="block text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          이벤트 자세히 보기
        </Link>
      </div>
    </div>
  );
}
