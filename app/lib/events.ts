// The daily check-in and the weekly gift exchange (naru/queries/events.ts):
// the acting profile's state, kept fresh, and the calls that change it.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useAuth } from "~/hooks/useAuth";
import { mutate, query } from "~/lib/naru";

export interface Brief {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

export interface GiftImage {
  id: string;
  url: string;
  filename: string;
  width: number;
  height: number;
}

export interface EventsStatus {
  /** Whether the events have opened; before then nobody may take part. */
  started: boolean;
  starts_at: string;
  check_in: { day: string; checked_in: boolean; open: boolean; coins: number };
  currency: string | null;
  gift_coins: number;
  gift: {
    week: string;
    signup_ends: string;
    gifts_close: string;
    opens: string;
    phase: "signup" | "writing" | "closed";
    participants: number;
    signed_up: boolean;
    content: string | null;
    images: GiftImage[];
    submitted_at: string | null;
  };
  received: {
    week: string;
    opens: string;
    open: boolean;
    count: number;
    gifts: {
      giver: Brief | null;
      content: string | null;
      images: GiftImage[];
    }[];
  };
}

export const EVENTS_KEY = "events-status";

let lastSettled = 0;

/**
 * The acting profile's check-in and gift exchange. Opening it first runs
 * what is due on the site (a week's draw, its pay), then reads.
 */
export function useEventsStatus() {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const profileId = currentProfile?.id;
  useEffect(() => {
    // Several parts of a page read this; settle once a minute at most.
    if (!profileId || Date.now() - lastSettled < 60_000) return;
    lastSettled = Date.now();
    mutate("events:settle")
      .then(() => queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] }))
      .catch(() => {});
  }, [profileId, queryClient]);
  const status = useQuery({
    queryKey: [EVENTS_KEY, profileId],
    queryFn: () =>
      query<EventsStatus>("events:status", { profile_id: profileId }),
    enabled: !!profileId,
  });
  // After a change: this, and the coin balances shown elsewhere.
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] });
    queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
  }, [queryClient]);
  return { ...status, profileId, refresh };
}

/** "11월 9일 (월) 오전 8:00", in Korean time. */
export function kstTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The last minute before a deadline that falls on midnight: "토 오후 11:59". */
export const kstLastMinute = (iso: string) =>
  kstTime(new Date(Date.parse(iso) - 60_000).toISOString());
