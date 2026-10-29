import { Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { AnnouncementTicker } from "~/components/announcement-ticker";
import { FrontGate } from "~/components/front-gate";
import { LoginButton } from "~/components/LoginButton";
import { MessageSender } from "~/components/message-sender";
import { PostList, type PostListRef } from "~/components/post-list";
import {
  ScheduledPostsList,
  type ScheduledPostsListRef,
} from "~/components/scheduled-posts-list";
import { EmptyState } from "~/components/shared/EmptyState";
import { LoadingState } from "~/components/shared/LoadingState";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { subscribe } from "~/lib/naru";

export default function Home() {
  const postListRef = useRef<PostListRef>(null);
  const scheduledPostsRef = useRef<ScheduledPostsListRef>(null);
  const location = useLocation();
  const {
    isLoading,
    isAuthenticated,
    belongsToCurrentInstance,
    consoleUrl,
    currentProfile,
  } = useAuth();
  const { currentInstance } = useCurrentInstance();
  const isBrowsing = new URLSearchParams(location.search).get("browse") === "1";
  const readOnly = !isAuthenticated || !belongsToCurrentInstance;
  const browseButton = (
    <Link
      to="/?browse=1"
      className="text-sm font-medium text-primary hover:underline"
    >
      둘러보기
    </Link>
  );
  const loginActions = (
    <div className="flex flex-col items-center gap-4">
      <LoginButton />
      {browseButton}
    </div>
  );

  const handlePostSuccess = () => {
    postListRef.current?.refresh();
    scheduledPostsRef.current?.refresh();
  };

  // Refetch posts when navigating to the page or switching profiles
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to refetch when profile changes
  useEffect(() => {
    if (isAuthenticated && belongsToCurrentInstance) {
      postListRef.current?.refresh();
    }
  }, [isAuthenticated, belongsToCurrentInstance, currentProfile?.id]);

  // Refetch posts when navigating back from deleted post
  useEffect(() => {
    if (location.state?.refetch) {
      postListRef.current?.refresh();
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Reload the timeline when it changes (a new post, a reply, a deletion),
  // instead of commung's polling every minute while the header showed.
  useEffect(() => {
    if (!isAuthenticated || !belongsToCurrentInstance) return;
    let last: string | null = null;
    return subscribe<{
      top_id: string | null;
      top_bumped_at: string | null;
      last_id: string | null;
      count: number;
    }>("posts:latest", null, (head) => {
      const key = JSON.stringify(head);
      if (last !== null && key !== last) {
        postListRef.current?.refresh();
        scheduledPostsRef.current?.refresh();
      }
      last = key;
    });
  }, [isAuthenticated, belongsToCurrentInstance]);

  if (isLoading) return <LoadingState />;

  if (!isAuthenticated && !isBrowsing) {
    return (
      <div className="flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-md mx-auto px-4">
          <FrontGate
            action={loginActions}
            fallback={
              <EmptyState
                icon={Users}
                title="로그인이 필요합니다"
                description="이 커뮤에 참여하려면 로그인해주세요."
                actions={loginActions}
              />
            }
          />
        </div>
      </div>
    );
  }

  if (!belongsToCurrentInstance && !isBrowsing) {
    const applyButton = (
      <div className="flex flex-col items-center gap-4">
        <a
          href={consoleUrl}
          className="inline-flex items-center justify-center px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-full shadow-marsh hover:shadow-marsh-lg hover:-translate-y-px transition-all"
        >
          가입 신청하기
        </a>
        {browseButton}
      </div>
    );

    return (
      <div className="flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-md mx-auto px-4">
          <FrontGate
            action={applyButton}
            fallback={
              <EmptyState
                icon={Users}
                title="가입 신청이 필요합니다"
                description="이 커뮤에 가입하려면 신청이 필요합니다."
                actions={applyButton}
              />
            }
          />
        </div>
      </div>
    );
  }

  return (
    <main
      className={`home-timeline py-4 ${readOnly ? "mx-auto max-w-2xl" : ""}`}
    >
      {readOnly && (
        <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="font-semibold">둘러보는 중이에요</p>
            <p className="text-sm text-muted-foreground">
              글과 댓글을 읽을 수 있어요. 글쓰기와 반응은 가입 후 이용해주세요.
            </p>
          </div>
          {isAuthenticated ? (
            <Link
              to={consoleUrl}
              className="text-sm font-medium text-primary hover:underline"
            >
              가입 신청하기
            </Link>
          ) : (
            <LoginButton />
          )}
        </div>
      )}
      <AnnouncementTicker />
      <div className="space-y-0">
        {/* Message Composer */}
        {!readOnly && (
          <div className="timeline-item border-b border-border/70">
            <MessageSender
              key={currentProfile?.id || "no-profile"}
              onPostSuccess={handlePostSuccess}
            />
          </div>
        )}

        {/* Scheduled Posts */}
        {!readOnly && <ScheduledPostsList ref={scheduledPostsRef} />}

        {/* Posts Feed */}
        <div>
          <PostList ref={postListRef} readOnly={readOnly} />
        </div>
      </div>
    </main>
  );
}
