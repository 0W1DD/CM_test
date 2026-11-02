// Example screens for the first-visit tour (onboarding-tour.tsx): while the
// tour stands on a page, that page shows a few made-up entries beside its
// own, so a newcomer with no posts or items yet sees what they look like.
// Nothing here is saved; the entries go when the tour moves on.
import { useSyncExternalStore } from "react";
import type { ShopItem } from "~/hooks/useShopSummary";
import type { Post } from "~/types/post";

/** Which page's examples are showing. */
export type TourDemo = "post" | "notifications" | "shop" | "uses";

let current: TourDemo | null = null;
const listeners = new Set<() => void>();

export function setTourDemo(demo: TourDemo | null) {
  if (demo === current) return;
  current = demo;
  for (const listener of listeners) listener();
}

const subscribeDemo = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether `demo`'s examples are showing. */
export function useTourDemo(demo: TourDemo): boolean {
  return (
    useSyncExternalStore(
      subscribeDemo,
      () => current,
      () => null,
    ) === demo
  );
}

/** Example entries' IDs start so; pages make those rows inert. */
export const DEMO_ID = "tour-demo-";
export const isDemo = (id: string) => id.startsWith(DEMO_ID);

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();

const SANTA = {
  id: `${DEMO_ID}santa`,
  name: "산타",
  username: "santa",
  profile_picture_url: null,
};
const RUDOLPH = {
  id: `${DEMO_ID}rudolph`,
  name: "루돌프",
  username: "rudolph",
  profile_picture_url: null,
};

export const DEMO_POST: Post = {
  id: `${DEMO_ID}post`,
  content: "메리 크리스마스! 🎄 오늘 밤 벽난로 앞에서 핫초코 한 잔 어때요?",
  created_at: minutesAgo(5),
  updated_at: null,
  announcement: false,
  content_warning: null,
  pinned_at: null,
  author: SANTA,
  images: [],
  in_reply_to_id: null,
  depth: 0,
  root_post_id: null,
  is_bookmarked: false,
  replies: [],
  reply_count: 2,
  has_more_replies: false,
  reactions: [
    {
      emoji: "🎄",
      user: { id: RUDOLPH.id, username: "rudolph", name: "루돌프" },
    },
    {
      emoji: "☕",
      user: { id: `${DEMO_ID}elf`, username: "elf", name: "요정" },
    },
  ],
};

export const DEMO_NOTIFICATIONS = [
  {
    id: `${DEMO_ID}gift`,
    tour: "demo-notification-gift",
    type: "gift",
    content: "산타님이 보낸 핫초코 1개가 도착했습니다",
    read_at: null,
    created_at: minutesAgo(2),
    sender: SANTA,
    related_post: null,
    related_use: {
      id: `${DEMO_ID}use-transfer`,
      item_name: "핫초코",
      kind: "transfer" as const,
      qty: 1,
    },
  },
  {
    id: `${DEMO_ID}approved`,
    tour: "demo-notification-approved",
    type: "use_approved",
    content: "핫초코 사용이 승인되었습니다",
    read_at: null,
    created_at: minutesAgo(8),
    sender: RUDOLPH,
    related_post: null,
    related_use: {
      id: `${DEMO_ID}use`,
      item_name: "핫초코",
      kind: "use" as const,
      qty: 1,
    },
  },
  {
    id: `${DEMO_ID}reply`,
    tour: "demo-notification-reply",
    type: "reply",
    content: "루돌프님이 답글을 작성했습니다",
    read_at: minutesAgo(10),
    created_at: minutesAgo(15),
    sender: RUDOLPH,
    related_post: {
      id: DEMO_POST.id,
      content: "좋아요! 썰매 끌고 갈게요 🦌",
      author: RUDOLPH,
    },
    related_use: null,
  },
];

export const DEMO_SHOP_ITEM: ShopItem = {
  id: `${DEMO_ID}item`,
  name: "핫초코",
  description: "몸이 따뜻해지는 한 잔. 사용하면 사라지는 소모품입니다.",
  priceAmount: 30,
  currencyId: `${DEMO_ID}coin`,
  currencyName: "코인",
  consumable: true,
  isUnique: false,
};

/** Use log entries, as uses:list answers them. */
export function demoUses(me: { name: string; username: string } | null) {
  const self = {
    id: `${DEMO_ID}me`,
    name: me?.name ?? "나",
    username: me?.username ?? "me",
    profile_picture_url: null,
  };
  return [
    {
      id: `${DEMO_ID}use`,
      kind: "use" as const,
      profile: self,
      target: null,
      item_name: "핫초코",
      qty: 1,
      note: "벽난로 앞에서 천천히 마셨다.",
      comments: [],
      secret: false,
      hidden: false,
      consumed: true,
      status: "pending" as const,
      approved_at: null,
      created_at: minutesAgo(3),
    },
    {
      id: `${DEMO_ID}use-transfer`,
      kind: "transfer" as const,
      profile: SANTA,
      target: self,
      item_name: "핫초코",
      qty: 1,
      note: "메리 크리스마스!",
      comments: [],
      secret: false,
      hidden: false,
      consumed: false,
      status: "approved" as const,
      approved_at: minutesAgo(1),
      created_at: minutesAgo(2),
    },
  ];
}
