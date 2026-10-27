import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  MessageCircle,
  User,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PostCard } from "~/components/post-card";
import { ReplyContext } from "~/components/reply-context";
import { ProfileAvatar } from "~/components/profile-avatar";
import { ProfileInventory } from "~/components/profile-inventory";
import { LoadingState } from "~/components/shared/LoadingState";
import { Spinner } from "~/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { query, reasonOf } from "~/lib/naru";
import { getGradientForUser } from "~/lib/gradient-utils";
import { getReadOnlyMarkdownInstance } from "~/lib/markdown-utils";
import type { Page, Post } from "~/types/post";
import type { Profile } from "~/types/profile";

export default function ProfileProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, currentProfile } = useAuth();

  const { isOwner: isCommunityOwner } = useCurrentInstance();
  const POSTS_PER_PAGE = 10;
  const md = getReadOnlyMarkdownInstance();

  // Only allow usernames that start with @
  useEffect(() => {
    if (username && !username.startsWith("@")) {
      // Redirect to 404 or home for non-@ URLs
      navigate("/", { replace: true });
      return;
    }
  }, [username, navigate]);

  // Handle @ prefix and validate username format
  const actualUsername = username?.startsWith("@")
    ? username.slice(1)
    : undefined;

  // Fetch profile
  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["profile", actualUsername],
    queryFn: async (): Promise<Profile> => {
      if (!actualUsername) {
        throw new Error("Username is required");
      }

      try {
        return await query<Profile>("profiles:get", {
          username: actualUsername,
          ...(currentProfile?.id && { profile_id: currentProfile.id }),
        });
      } catch (error) {
        throw new Error(
          reasonOf(error) === "not_found"
            ? "사용자를 찾을 수 없습니다"
            : "사용자 정보를 불러오는 데 실패했습니다",
        );
      }
    },
    enabled: !!actualUsername,
  });

  // Fetch posts with infinite query
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPostsLoading,
    isError: isPostsError,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey: ["profile-posts", actualUsername, currentProfile?.id],
    queryFn: async ({
      pageParam,
    }: {
      pageParam: string | undefined;
    }): Promise<Page<Post>> => {
      if (!actualUsername) {
        return { data: [], pagination: { next_cursor: null, has_more: false } };
      }
      return query<Page<Post>>("posts:byProfile", {
        username: actualUsername,
        limit: POSTS_PER_PAGE,
        ...(pageParam && { cursor: pageParam }),
        ...(currentProfile?.id && { profile_id: currentProfile.id }),
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more
        ? (lastPage.pagination.next_cursor ?? undefined)
        : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!actualUsername,
  });

  const posts = postsData?.pages.flatMap((page) => page.data) ?? [];

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    // After a failed page, wait for the reader to ask again instead of
    // retrying on every scroll event.
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

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

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {profileError instanceof Error
              ? profileError.message
              : "사용자를 찾을 수 없습니다"}
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
              // Back to wherever the profile was opened from (the member
              // list, a post), home only when it was opened directly.
              onClick={() =>
                window.history.state?.idx > 0 ? navigate(-1) : navigate("/")
              }
              className="p-2 rounded-full hover:bg-accent transition-colors"
              title="뒤로 가기"
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="h-4 w-px bg-border"></div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {profile.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                @{profile.username}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <div className="bg-card rounded-2xl shadow-marsh border border-border overflow-hidden">
            {/* Profile Header */}
            <div
              className={`bg-gradient-to-r ${getGradientForUser(
                profile.username,
                profile.name,
              )} px-6 py-8`}
            >
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  profilePictureUrl={profile.profile_picture_url || undefined}
                  name={profile.name}
                  username={profile.username}
                  size="xl"
                  className="bg-white/20 backdrop-blur"
                />
                <div className="text-white">
                  <h2 className="text-2xl font-bold">{profile.name}</h2>
                  <p className="text-white/90 text-lg">@{profile.username}</p>
                  {profile.bio && (
                    <div
                      className="prose prose-sm dark:prose-invert text-white/95 mt-2 leading-relaxed max-w-md prose-headings:text-white prose-a:text-white/90 prose-a:hover:text-white prose-strong:text-white prose-code:text-white/90"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
                      dangerouslySetInnerHTML={{
                        __html: md.render(profile.bio),
                      }}
                    />
                  )}
                  <div className="flex items-center gap-2 mt-3 text-white/90">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {new Date(profile.created_at).toLocaleDateString("ko-KR")}
                      에 가입
                    </span>
                  </div>
                  {user &&
                    !user.profiles.some((own) => own.id === profile.id) && (
                      <div className="mt-4">
                        <Link
                          to={`/messages/${profile.username}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-card text-primary rounded-lg hover:bg-primary/15 hover:text-primary transition-all duration-200 text-sm font-medium shadow-marsh"
                        >
                          <MessageCircle className="h-4 w-4" />
                          메시지 보내기
                        </Link>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Posts Stats */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  게시물 {profile.post_count ?? 0}개
                </span>
              </div>
            </div>
          </div>

          {/* Inventory Section (only renders if non-empty) */}
          <ProfileInventory username={profile.username} />

          {/* Posts Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">게시물</h3>

            {isPostsLoading ? (
              <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
                <Spinner className="h-6 w-6 mx-auto mb-4" />
                <p className="text-muted-foreground">게시물을 불러오는 중...</p>
              </div>
            ) : isPostsError && posts.length === 0 ? (
              <Empty className="bg-card rounded-2xl shadow-sm border border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircle />
                  </EmptyMedia>
                  <EmptyTitle>오류가 발생했습니다</EmptyTitle>
                  <EmptyDescription>
                    게시물을 불러오는 데 실패했습니다
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : posts.length === 0 ? (
              <Empty className="bg-card rounded-2xl shadow-sm border border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircle />
                  </EmptyMedia>
                  <EmptyTitle>아직 게시물이 없습니다</EmptyTitle>
                  <EmptyDescription>
                    {profile.name}님이 작성한 게시물이 없습니다.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className="space-y-4">
                  {posts.map((post) => {
                    return (
                      <div key={post.id}>
                        <ReplyContext parent={post.parent_summary} />
                        <PostCard
                          post={post as unknown as Post}
                          currentProfileId={currentProfile?.id}
                          isCommunityOwner={isCommunityOwner}
                          isProfileView={true}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Loading indicator for infinite scroll */}
                {isFetchingNextPage && (
                  <LoadingState message="더 많은 게시물을 불러오는 중..." />
                )}

                {/* A failed page keeps what was loaded and offers a retry */}
                {isFetchNextPageError && !isFetchingNextPage && (
                  <div className="border border-destructive/40 rounded-md p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      이전 게시물을 불러오지 못했습니다.
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-medium rounded-md border border-primary text-primary hover:bg-primary/10"
                    >
                      다시 불러오기
                    </button>
                  </div>
                )}

                {/* End of content indicator */}
                {!hasNextPage && posts.length > 0 && (
                  <div className="bg-background rounded-2xl border border-border p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      모든 게시물을 확인했습니다
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
