import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AtSign,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  MessageCircle,
  RotateCcw,
  Smile,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { LoadingState } from "~/components/shared/LoadingState";
import { Spinner } from "~/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { useUnreadCount } from "~/contexts/UnreadCountContext";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { mutate, query, subscribe } from "~/lib/naru";
import type { Page } from "~/types/post";
import type { Route } from "./+types/notifications";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "알림" },
    { name: "description", content: "새로운 알림 확인하기" },
  ];
}

interface Notification {
  id: string;
  type: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  } | null;
  related_post: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
      username: string;
      profile_picture_url: string | null;
    };
  } | null;
  directMessage?: {
    id: string;
    content: string;
  } | null;
}

type NotificationFilter = "all" | "conversation" | "reaction";

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "conversation", label: "답글·멘션" },
  { value: "reaction", label: "반응" },
];

export default function Notifications() {
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const { refreshUnreadCounts } = useUnreadCount();
  const { instanceSlug } = useCurrentInstance();
  const NOTIFICATIONS_PER_PAGE = 20;

  // Fetch notifications with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["notifications", currentProfile?.id, filter],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!currentProfile?.id) {
        return {
          data: [] as Notification[],
          pagination: { next_cursor: null, has_more: false },
        };
      }

      return query<Page<Notification>>("notifications:list", {
        profile_id: currentProfile.id,
        limit: NOTIFICATIONS_PER_PAGE,
        ...(filter !== "all" && { filter }),
        ...(pageParam && { cursor: pageParam }),
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.has_more
        ? (lastPage.pagination.next_cursor ?? undefined)
        : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: isAuthenticated && !!instanceSlug && !!currentProfile,
  });

  const notifications = data?.pages.flatMap((page) => page.data) ?? [];

  const markAllAsRead = async () => {
    if (!currentProfile) return;

    try {
      setIsMarkingAllRead(true);
      await mutate("notifications:markAllRead", {
        profile_id: currentProfile.id,
      });
      // Refetch notifications to update read status
      refetch();
      // Refresh unread counts immediately
      refreshUnreadCounts();
    } catch (err) {
      console.error("Failed to mark all as readAt:", err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight =
        document.documentElement.clientHeight || window.innerHeight;

      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const currentProfileId = currentProfile?.id;

  // Each visit to the tab (clicking it again too: a new location key)
  // reloads the list, then marks everything read so the badge clears; a
  // visit with nothing unread makes no mutation.
  const { key: visit } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per visit; refetch and refreshUnreadCounts are stable enough not to repeat it.
  useEffect(() => {
    if (!isAuthenticated || !currentProfileId) return;
    let cancelled = false;
    (async () => {
      await refetch();
      const { count } = await query<{ count: number }>(
        "notifications:unreadCount",
        { profile_id: currentProfileId },
      );
      if (cancelled || count === 0) return;
      await mutate("notifications:markAllRead", {
        profile_id: currentProfileId,
      });
      refreshUnreadCounts();
    })().catch((err) => console.error("Failed to mark as read:", err));
    return () => {
      cancelled = true;
    };
  }, [visit, isAuthenticated, currentProfileId]);

  // Reload when the profile's notifications change (its unread count is
  // live), instead of commung's polling every 30 seconds.
  useEffect(() => {
    if (!isAuthenticated || !instanceSlug || !currentProfileId) return;
    let last: number | null = null;
    return subscribe<{ count: number }>(
      "notifications:unreadCount",
      { profile_id: currentProfileId },
      ({ count }) => {
        if (last !== null && count !== last) {
          refetch();
          refreshUnreadCounts();
        }
        last = count;
      },
    );
  }, [
    isAuthenticated,
    instanceSlug,
    currentProfileId,
    refreshUnreadCounts,
    refetch,
  ]);

  const markAsRead = async (notificationId: string) => {
    if (!currentProfile) return;

    try {
      await mutate("notifications:markRead", {
        notification_id: notificationId,
        profile_id: currentProfile.id,
      });
      // Refetch notifications to update read status
      refetch();
      // Refresh unread counts immediately
      refreshUnreadCounts();
    } catch (err) {
      console.error("Failed to mark notification as readAt:", err);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    if (!currentProfile) return;

    try {
      await mutate("notifications:markUnread", {
        notification_id: notificationId,
        profile_id: currentProfile.id,
      });
      // Refetch notifications to update read status
      refetch();
      // Refresh unread counts immediately
      refreshUnreadCounts();
    } catch (err) {
      console.error("Failed to mark notification as unread:", err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "reply":
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case "mention":
        return <AtSign className="h-4 w-4 text-mint-ink" />;
      case "reaction":
        return <Smile className="h-4 w-4 text-butter-ink" />;
      case "message":
        return <MessageCircle className="h-4 w-4 text-lilac-ink" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.related_post) {
      // For post notifications (replies, mentions), link to the post
      return `/@${notification.related_post.author.username}/${notification.related_post.id}`;
    } else if (notification.directMessage && notification.sender) {
      // For message notifications, link to the conversation
      return `/messages/${notification.sender.username}`;
    }
    return null;
  };

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR");
  };

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-marsh border border-border p-8 text-center">
            <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인이 필요합니다
            </h1>
            <p className="text-muted-foreground mb-6">
              알림을 확인하려면 로그인해주세요.
            </p>
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {isLoading && (
            <div className="flex items-center justify-center min-h-64">
              <div className="flex items-center gap-3">
                <Spinner className="h-6 w-6" />
                <span className="text-muted-foreground">
                  알림을 불러오는 중...
                </span>
              </div>
            </div>
          )}

          {isError && (
            <div className="bg-destructive/15 border border-destructive/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-destructive">
                <Bell className="h-4 w-4" />
                <span className="text-sm font-medium">
                  알림을 불러오는 중 오류가 발생했습니다
                </span>
              </div>
            </div>
          )}

          {/* Filter tabs and mark-all-read */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div
              role="tablist"
              aria-label="알림 종류"
              className="flex items-center gap-1"
            >
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={`px-3 h-8 text-sm rounded-md border transition-colors ${
                    filter === item.value
                      ? "border-primary text-primary bg-primary/10 font-semibold"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {notifications.some((n) => n.read_at === null) && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={isMarkingAllRead}
                className="inline-flex items-center gap-1.5 px-3 h-8 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                {isMarkingAllRead ? "처리 중..." : "모두 읽음"}
              </button>
            )}
          </div>

          {!isLoading && notifications.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellOff />
                </EmptyMedia>
                <EmptyTitle>새로운 알림이 없습니다</EmptyTitle>
                <EmptyDescription>
                  새로운 답글이나 멘션이 있으면 여기에 표시됩니다.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="border border-border rounded-md divide-y divide-border bg-card/60">
              {notifications.map((notification) => {
                const notificationLink = getNotificationLink(notification);
                const unread = notification.read_at === null;
                const excerpt =
                  notification.related_post?.content ??
                  notification.directMessage?.content ??
                  "";

                const row = (
                  <div
                    className={`group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/60 ${
                      unread ? "bg-primary/[0.07]" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          className={`text-sm truncate ${unread ? "font-semibold text-foreground" : "text-foreground/85"}`}
                        >
                          {notification.content}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                      {excerpt && (
                        <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                          {excerpt.replace(/\s+/g, " ")}
                        </p>
                      )}
                    </div>
                    {unread && (
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0">
                        <span className="sr-only">읽지 않음</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (unread) markAsRead(notification.id);
                        else markAsUnread(notification.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded transition-opacity"
                      title={unread ? "읽음으로 표시" : "읽지 않음으로 표시"}
                      aria-label={unread ? "읽음으로 표시" : "읽지 않음으로 표시"}
                    >
                      {unread ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );

                return (
                  <li key={notification.id}>
                    {notificationLink ? (
                      <Link
                        to={notificationLink}
                        className="block"
                        onClick={() => {
                          if (unread) markAsRead(notification.id);
                        }}
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Loading indicator for infinite scroll */}
          {isFetchingNextPage && (
            <div className="mt-6">
              <LoadingState message="더 많은 알림을 불러오는 중..." />
            </div>
          )}

          {/* End of content indicator */}
          {!hasNextPage && notifications.length > 0 && (
            <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
              <p className="text-muted-foreground text-sm">
                모든 알림을 확인했습니다
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
