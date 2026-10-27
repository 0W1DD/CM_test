import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CornerDownRight, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PostCard } from "~/components/post-card";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { query, reasonOf } from "~/lib/naru";
import type { Page, Post } from "~/types/post";

const REPLIES_PER_PAGE = 20;

export default function PostDetail() {
  const { username, post_id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentProfile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [parentThread, setParentThread] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is community owner using data from useAuth
  const { isOwner: isCommunityOwner } = useCurrentInstance();

  // Fetch post information (without replies — those come from the separate query)
  const fetchPost = useCallback(async () => {
    if (!post_id) return;

    try {
      setIsLoading(true);
      let postData: Post;
      try {
        postData = await query<Post>("posts:get", {
          post_id,
          ...(currentProfile?.id && { profile_id: currentProfile.id }),
        });
      } catch (err) {
        setError(
          reasonOf(err) === "not_found" || reasonOf(err) === "invalid"
            ? "게시물을 찾을 수 없습니다"
            : "게시물을 불러오는 데 실패했습니다",
        );
        return;
      }

      // Validate that the username matches the post author
      const cleanUsername = username?.startsWith("@")
        ? username.slice(1)
        : username;
      if (cleanUsername && postData.author.username !== cleanUsername) {
        setError("게시물을 찾을 수 없습니다");
        return;
      }

      setPost({
        ...postData,
        depth: 0,
        replies: [],
      });

      // Set parent thread from API response
      setParentThread(
        Array.isArray(postData.parent_thread) ? postData.parent_thread : [],
      );
    } catch (_err) {
      console.error("Failed to fetch post:", _err);
      setError("게시물을 불러오는 데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [post_id, username, currentProfile?.id]);

  useEffect(() => {
    if (post_id) {
      fetchPost();
    }
  }, [post_id, fetchPost]);

  // Paginated replies via useInfiniteQuery
  const {
    data: repliesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isRepliesLoading,
  } = useInfiniteQuery({
    queryKey: ["postReplies", post_id, currentProfile?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      return query<Page<Post>>("posts:replies", {
        post_id: post_id ?? "",
        limit: REPLIES_PER_PAGE,
        ...(pageParam && { cursor: pageParam }),
        ...(currentProfile?.id && { profile_id: currentProfile.id }),
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.has_more
        ? (lastPage.pagination.next_cursor ?? undefined)
        : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!post_id && !isLoading && !error,
  });

  // Auto-fetch all reply pages so every reply is visible
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allReplies = repliesData?.pages.flatMap((page) => page.data) ?? [];
  const totalReplyCount = repliesData?.pages[0]?.pagination.total_count ?? 0;

  // Compute display depths: only indent when a parent branches (has multiple children)
  const displayDepthMap = useMemo(() => {
    const map = new Map<string, number>();
    if (allReplies.length === 0 || !post_id) return map;

    // Count children per parent
    const childCount = new Map<string, number>();
    for (const reply of allReplies) {
      const parentId = reply.in_reply_to_id;
      if (parentId) {
        childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1);
      }
    }

    // Process in order (sort_path guarantees parents before children)
    for (const reply of allReplies) {
      const parentId = reply.in_reply_to_id;
      if (parentId === post_id) {
        // Direct reply to main post — always depth 1
        map.set(reply.id, 1);
      } else {
        const parentDisplayDepth = map.get(parentId ?? "") ?? 1;
        const siblings = childCount.get(parentId ?? "") ?? 1;
        // Only increase depth if parent has multiple children (branching)
        map.set(
          reply.id,
          siblings > 1 ? parentDisplayDepth + 1 : parentDisplayDepth,
        );
      }
    }
    return map;
  }, [allReplies, post_id]);

  const handleMainPostDelete = () => {
    navigate("/", { state: { refetch: true } });
  };

  const handleRefresh = useCallback(() => {
    fetchPost();
    queryClient.invalidateQueries({ queryKey: ["postReplies", post_id] });
  }, [fetchPost, queryClient, post_id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">게시물을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error || "게시물을 찾을 수 없습니다"}
          </h1>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-primary hover:text-primary/90 font-medium"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                window.history.state?.idx > 0 ? navigate(-1) : navigate("/")
              }
              className="p-2 rounded-full hover:bg-accent transition-colors"
              title="뒤로 가기"
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-xl font-bold text-foreground">게시물</h1>
              <p className="text-sm text-muted-foreground">
                {post.author.name}님의 게시물
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Parent thread - show if this is a reply */}
          {parentThread.length > 0 && (
            <div className="mb-4 space-y-4">
              <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <CornerDownRight className="h-4 w-4" />
                <span>답글 스레드 ({parentThread.length}개의 상위 게시물)</span>
              </div>
              <div className="space-y-4">
                {parentThread.map((parentPost) => (
                  <PostCard
                    key={parentPost.id}
                    post={{
                      ...parentPost,
                      replies: [],
                    }}
                    currentProfileId={currentProfile?.id}
                    onDelete={handleRefresh}
                    onRefresh={handleRefresh}
                    isCommunityOwner={isCommunityOwner}
                  />
                ))}
              </div>
            </div>
          )}

          <PostCard
            post={{
              ...post,
              replies: [],
            }}
            currentProfileId={currentProfile?.id}
            onDelete={handleMainPostDelete}
            onRefresh={handleRefresh}
            isCommunityOwner={isCommunityOwner}
          />

          {/* Detailed Reactions section */}
          {post.reactions && post.reactions.length > 0 && (
            <div className="mt-6 bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                반응 ({post.reactions.length})
              </h3>
              <div className="space-y-3">
                {(() => {
                  // Group reactions by emoji type
                  const reactionGroups = post.reactions.reduce<
                    Record<
                      string,
                      Array<{ id: string; username: string; name: string }>
                    >
                  >((acc, reaction) => {
                    if (!acc[reaction.emoji]) {
                      acc[reaction.emoji] = [];
                    }
                    if (reaction.user) {
                      const group = acc[reaction.emoji];
                      if (group) {
                        group.push(reaction.user);
                      }
                    }
                    return acc;
                  }, {});

                  return Object.entries(reactionGroups).map(
                    ([emoji, users]) => (
                      <div key={emoji} className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-background rounded-full">
                          <span className="text-xl">{emoji}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground mb-1">
                            {users.length}명이 반응했습니다
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {users.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                className="inline-flex items-center px-2 py-1 bg-primary/15 text-primary text-sm rounded-full hover:bg-primary/25 transition-colors cursor-pointer"
                                onClick={() => navigate(`/@${user.username}`)}
                              >
                                {user.name} (@{user.username})
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ),
                  );
                })()}
              </div>
            </div>
          )}

          {/* Replies section */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              답글 ({totalReplyCount})
            </h3>

            {isRepliesLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : allReplies.length === 0 ? (
              <div className="bg-card rounded-2xl shadow-marsh border border-border p-8 text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">
                  아직 답글이 없습니다
                </h4>
                <p className="text-muted-foreground">
                  첫 번째 답글을 작성해보세요!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {allReplies.map((reply) => (
                  <PostCard
                    key={reply.id}
                    post={{
                      ...reply,
                      author: {
                        ...reply.author,
                        profile_picture_url:
                          reply.author.profile_picture_url || null,
                      },
                      content_warning: reply.content_warning || null,
                      in_reply_to_id: reply.in_reply_to_id || null,
                      root_post_id: reply.root_post_id || null,
                      images: reply.images || [],
                      is_bookmarked: reply.is_bookmarked || false,
                      reactions: reply.reactions || [],
                      depth: 0,
                      replies: [],
                    }}
                    displayDepth={displayDepthMap.get(reply.id) ?? 1}
                    currentProfileId={currentProfile?.id}
                    onDelete={handleRefresh}
                    onRefresh={handleRefresh}
                    isCommunityOwner={isCommunityOwner}
                  />
                ))}

                {isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
