import { useInfiniteQuery } from "@tanstack/react-query";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { query } from "~/lib/naru";
import type { Page, Post } from "~/types/post";
import { PostCard } from "./post-card";
import { ReplyContext } from "./reply-context";
import { EmptyState } from "./shared/EmptyState";
import { LoadingState } from "./shared/LoadingState";
import { PostCardSkeleton } from "./skeletons/PostCardSkeleton";

export interface PostListRef {
  refresh: () => void;
}

export const PostList = forwardRef<PostListRef>((_props, ref) => {
  const { currentProfile } = useAuth();
  const { isOwner: isCommunityOwner, isModerator } = useCurrentInstance();
  const POSTS_PER_PAGE = 20;
  const [_newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [_deletingPostIds, setDeletingPostIds] = useState<Set<string>>(
    new Set(),
  );
  const previousPostIdsRef = useRef<Set<string>>(new Set());

  // Fetch posts with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["posts", currentProfile?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      return query<Page<Post>>("posts:list", {
        limit: POSTS_PER_PAGE,
        ...(pageParam && { cursor: pageParam }),
        ...(currentProfile?.id && { profile_id: currentProfile.id }),
      });
    },
    getNextPageParam: (lastPage) => {
      // Use cursor from API response
      return lastPage.pagination.has_more
        ? lastPage.pagination.next_cursor
        : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!currentProfile?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes - posts are dynamic but can be cached briefly
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for navigation back
    refetchOnMount: true, // Refetch on mount to get new posts
  });

  // Flatten all posts from all pages
  const allPosts = data?.pages.flatMap((page) => page.data) ?? [];

  // Detect new posts when data changes
  useEffect(() => {
    if (allPosts.length > 0) {
      const currentPostIds = new Set(allPosts.map((post) => post.id));
      const newIds = new Set<string>();

      // Find posts that are in current but not in previous
      for (const postId of currentPostIds) {
        if (!previousPostIdsRef.current.has(postId)) {
          newIds.add(postId);
        }
      }

      // Update new posts state
      if (newIds.size > 0) {
        setNewPostIds(newIds);
        // Clear new status after animation duration (2 seconds)
        setTimeout(() => {
          setNewPostIds(new Set());
        }, 2000);
      }

      // Update previous posts reference
      previousPostIdsRef.current = currentPostIds;
    }
  }, [allPosts]);

  // Ref for the sentinel element at the bottom of the list
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Load more when sentinel is visible and we have more pages
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        // Trigger when sentinel is 200px from viewport
        rootMargin: "200px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle post deletion with animation
  const handlePostDelete = useCallback(
    (postId: string) => {
      // Add to deleting set to trigger fade-out animation
      setDeletingPostIds((prev) => new Set(prev).add(postId));

      // Wait for animation to complete, then refetch
      setTimeout(() => {
        refetch();
        // Remove from deleting set after refetch
        setDeletingPostIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }, 300); // 300ms for fade-out animation
    },
    [refetch],
  );

  useImperativeHandle(ref, () => ({
    refresh: () => refetch(),
  }));

  if (isLoading || !currentProfile?.id) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }, () => (
          <PostCardSkeleton key={crypto.randomUUID()} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <EmptyState
          iconElement={
            <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
          }
          title="오류가 발생했습니다"
          description={
            error instanceof Error
              ? error.message
              : "게시물을 가져오는 데 실패했습니다"
          }
          actions={
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              다시 시도
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {allPosts.length === 0 ? (
        <EmptyState
          iconElement={<span className="text-2xl">📝</span>}
          title="아직 게시물이 없습니다"
          description="첫 번째 게시물을 작성해보세요!"
        />
      ) : (
        <>
          <div>
            {allPosts.map((post) => (
              <div
                key={post.id}
                className={`timeline-item ${
                  post.parent_summary ? "bg-card border-b border-border" : ""
                }`}
              >
                {/* A reply on the timeline says what it answers, and reads
                    as a post of its own rather than a nested reply. */}
                {post.parent_summary && (
                  <div className="px-2 pt-2 -mb-3">
                    <ReplyContext parent={post.parent_summary} />
                  </div>
                )}
                <PostCard
                  post={post}
                  {...(post.parent_summary
                    ? { displayDepth: 0, hideBorder: true }
                    : {})}
                  currentProfileId={currentProfile?.id}
                  onDelete={() => handlePostDelete(post.id)}
                  onRefresh={() => handlePostDelete(post.id)}
                  isCommunityOwner={isCommunityOwner}
                  isModerator={isModerator}
                />
              </div>
            ))}
          </div>

          {/* Sentinel element for Intersection Observer */}
          <div ref={sentinelRef} className="h-px" aria-hidden="true" />

          {/* Loading indicator for infinite scroll */}
          {isFetchingNextPage && (
            <LoadingState message="더 많은 게시물을 불러오는 중..." />
          )}

          {/* End of content indicator */}
          {!hasNextPage && allPosts.length > 0 && (
            <div className="bg-background border-b border-border p-6 text-center">
              <p className="text-muted-foreground text-sm">
                모든 게시물을 확인했습니다
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
});
