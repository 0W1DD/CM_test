import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { query } from "~/lib/naru";
import type { Page, Post } from "~/types/post";

const ITEMS_PER_PAGE = 20;

// Prefetches the pages whose first answer is the posts area's; the other
// areas' pages load on their own.
function prefetchPosts(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["posts", profileId],
    queryFn: () =>
      query<Page<Post>>("posts:list", {
        limit: ITEMS_PER_PAGE,
        profile_id: profileId,
      }),
    initialPageParam: undefined as string | undefined,
  });
}

function prefetchNotifications(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["notifications", profileId],
    queryFn: () =>
      query("notifications:list", {
        profile_id: profileId,
        limit: ITEMS_PER_PAGE,
      }),
    initialPageParam: undefined as string | undefined,
  });
}

function prefetchAnnouncements(qc: QueryClient, profileId: string) {
  qc.prefetchQuery({
    queryKey: ["announcements", profileId],
    queryFn: () =>
      query<Post[]>("posts:announcements", { profile_id: profileId }),
  });
}

function prefetchBookmarks(qc: QueryClient, profileId: string) {
  qc.prefetchInfiniteQuery({
    queryKey: ["bookmarks", profileId],
    queryFn: () =>
      query<Page<Post>>("posts:bookmarks", {
        profile_id: profileId,
        limit: ITEMS_PER_PAGE,
      }),
    initialPageParam: undefined as string | undefined,
  });
}

type PrefetchFn = (qc: QueryClient, profileId: string) => void;

const routePrefetchers: Record<string, PrefetchFn> = {
  "/": prefetchPosts,
  "/notifications": prefetchNotifications,
  "/announcements": prefetchAnnouncements,
  "/bookmarks": prefetchBookmarks,
};

const allPaths = Object.keys(routePrefetchers);

export function usePrefetchRoutes() {
  const queryClient = useQueryClient();
  const { isAuthenticated, currentProfile, belongsToCurrentInstance } =
    useAuth();
  const { instanceSlug } = useCurrentInstance();
  const prefetchedForProfile = useRef<string | null>(null);

  const profileId = currentProfile?.id;

  useEffect(() => {
    if (!isAuthenticated || !instanceSlug || !profileId) return;
    if (!belongsToCurrentInstance) return;
    if (prefetchedForProfile.current === profileId) return;
    prefetchedForProfile.current = profileId;

    // Prefetch all routes immediately
    for (const path of allPaths) {
      const prefetcher = routePrefetchers[path];
      if (prefetcher) {
        prefetcher(queryClient, profileId);
      }
    }
  }, [
    isAuthenticated,
    instanceSlug,
    profileId,
    belongsToCurrentInstance,
    queryClient,
  ]);
}
