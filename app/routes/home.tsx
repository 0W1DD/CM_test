import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { AnnouncementTicker } from "~/components/announcement-ticker";
import { FrontGate } from "~/components/front-gate";
import { LoginButton } from "~/components/LoginButton";
import { MessageSender } from "~/components/message-sender";
import { PostCard } from "~/components/post-card";
import { PostList, type PostListRef } from "~/components/post-list";
import {
  ScheduledPostsList,
  type ScheduledPostsListRef,
} from "~/components/scheduled-posts-list";
import { EmptyState } from "~/components/shared/EmptyState";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { subscribe } from "~/lib/naru";
import { DEMO_POST, useTourDemo } from "~/lib/tour-demo";

type TimelineTab = "home" | "posts";
const TAB_KEY = "timeline-tab";

function savedTab(): TimelineTab {
  try {
    return localStorage.getItem(TAB_KEY) === "posts" ? "posts" : "home";
  } catch {
    return "home";
  }
}

/** 홈: posts and replies; 게시물: only posts. Tabs on the composer's bottom edge. */
function TimelineTabs({
  value,
  onChange,
}: {
  value: TimelineTab;
  onChange: (tab: TimelineTab) => void;
}) {
  const tabs: { id: TimelineTab; label: string }[] = [
    { id: "home", label: "홈" },
    { id: "posts", label: "게시물" },
  ];
  return (
    <div
      role="tablist"
      aria-label="타임라인"
      // Down to the footer's bottom line, which the active tab covers.
      className="timeline-tabs flex shrink-0 self-end items-end gap-1"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            // The active tab: outlined in the theme colour, open at the
            // bottom into the timeline under it. The others sit on the line.
            className={`relative min-w-[3.75rem] px-3 pt-1.5 text-xs font-semibold border-b-0 transition-colors ${
              active
                ? "timeline-tab-active z-10 bg-card text-foreground"
                : "timeline-tab bg-card text-muted-foreground border border-border pb-2 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const showDemo = useTourDemo("post");
  const [tab, setTab] = useState<TimelineTab>(savedTab);
  const changeTab = (next: TimelineTab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {}
  };

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

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-md mx-auto px-4">
          <FrontGate
            action={<LoginButton />}
            fallback={
              <EmptyState
                icon={Users}
                title="로그인이 필요합니다"
                description="이 커뮤에 참여하려면 로그인해주세요."
                actions={<LoginButton />}
              />
            }
          />
        </div>
      </div>
    );
  }

  if (!belongsToCurrentInstance && !isLoading) {
    const applyButton = (
      <a
        href={consoleUrl}
        className="inline-flex items-center justify-center px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-full shadow-marsh hover:shadow-marsh-lg hover:-translate-y-px transition-all"
      >
        가입 신청하기
      </a>
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
    <main className="home-timeline py-4">
      <AnnouncementTicker />
      <div className="space-y-0">
        {/* Message Composer */}
        <div
          data-tour="composer"
          // No line of its own: the composer's footer draws one under its tabs.
          className="timeline-item"
        >
          <MessageSender
            key={currentProfile?.id || "no-profile"}
            onPostSuccess={handlePostSuccess}
            footerEnd={<TimelineTabs value={tab} onChange={changeTab} />}
          />
        </div>

        {/* The tour's example post: only to look at */}
        {showDemo && (
          <div
            data-tour-scope="demo"
            data-tour="demo-post"
            className="timeline-item bg-card border-b border-border"
            inert
          >
            <PostCard
              post={DEMO_POST}
              currentProfileId={currentProfile?.id}
              noFold
            />
          </div>
        )}

        {/* Scheduled Posts */}
        <ScheduledPostsList ref={scheduledPostsRef} />

        {/* Posts Feed */}
        <div>
          <PostList ref={postListRef} rootsOnly={tab === "posts"} />
        </div>
      </div>
    </main>
  );
}
