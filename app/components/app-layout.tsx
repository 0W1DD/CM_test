import { useCallback, useEffect, useRef, useState } from "react";
import { MastodonLayout } from "~/components/layout";
import { NavigationProgress } from "~/components/NavigationProgress";
import { UnreadCountProvider } from "~/contexts/UnreadCountContext";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useActivityHeartbeat } from "~/hooks/useOnlineStatus";
import { usePrefetchRoutes } from "~/hooks/usePrefetchRoutes";
import { subscribe } from "~/lib/naru";

interface AppLayoutProps {
  children: React.ReactNode;
}

/** A live unread count (`{ count }`) for the acting profile, or 0. */
function useLiveCount(
  name: string,
  profileId: string | undefined,
  version: number,
) {
  const [count, setCount] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-subscribes on demand
  useEffect(() => {
    setCount(0);
    if (!profileId) return;
    return subscribe<{ count: number } | null>(
      name,
      { profile_id: profileId },
      (result) => setCount(result?.count ?? 0),
      () => {},
    );
  }, [name, profileId, version]);
  return count;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [version, setVersion] = useState(0);
  const {
    belongsToCurrentInstance,
    isLoading: authLoading,
    currentProfile,
  } = useAuth();
  const { instanceName } = useCurrentInstance();
  usePrefetchRoutes();
  const headerRef = useRef<HTMLDivElement>(null);

  // Members only: the acting profile's activity and unread counts, which
  // live queries keep current instead of polling.
  const profileId = belongsToCurrentInstance ? currentProfile?.id : undefined;
  useActivityHeartbeat(profileId);
  const unreadCount = useLiveCount(
    "notifications:unreadCount",
    profileId,
    version,
  );
  const unreadMessageCount = useLiveCount(
    "messages:unreadCount",
    profileId,
    version,
  );
  // Asking again re-subscribes, for pages that still ask after a change.
  const refreshUnreadCounts = useCallback(() => setVersion((v) => v + 1), []);

  // Track header visibility using Intersection Observer
  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeaderVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0 },
    );

    observer.observe(headerElement);
    return () => observer.disconnect();
  }, []);

  return (
    <UnreadCountProvider
      refreshUnreadCounts={refreshUnreadCounts}
      isHeaderVisible={isHeaderVisible}
    >
      <NavigationProgress />
      <div ref={headerRef}>
        <MastodonLayout
          isAuthenticated={belongsToCurrentInstance}
          isLoading={authLoading}
          communityName={instanceName}
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        >
          {children}
        </MastodonLayout>
      </div>
    </UnreadCountProvider>
  );
}
