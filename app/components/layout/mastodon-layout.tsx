import { type ReactNode, useRef } from "react";
import { usePageTransition } from "~/hooks/usePageTransition";
import { useScrollDirection } from "~/hooks/useScrollDirection";
import { ClockCalendar } from "./clock-calendar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { SidebarNav } from "./sidebar-nav";

interface MastodonLayoutProps {
  children: ReactNode;
  isAuthenticated: boolean;
  isLoading: boolean;
  communityName: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function MastodonLayout({
  children,
  isAuthenticated,
  isLoading,
  communityName,
  unreadCount,
  unreadMessageCount,
}: MastodonLayoutProps) {
  const headerHidden = useScrollDirection();
  const mainRef = useRef<HTMLElement>(null);
  usePageTransition(mainRef);

  // Members get the app's navigation; visitors and applicants a plain page.
  const showAuthenticatedLayout = isAuthenticated && !isLoading;

  return (
    <div className="min-h-screen">
      {/* Mobile Header */}
      {showAuthenticatedLayout && (
        <header
          className={`sticky top-0 z-40 bg-card border-b-[1.5px] border-[var(--frame)] px-4 h-14 flex items-center gap-3 md:hidden transition-transform duration-300 ${headerHidden ? "-translate-y-full" : "translate-y-0"}`}
        >
          <MobileNavDrawer
            communityName={communityName}
            unreadCount={unreadCount}
            unreadMessageCount={unreadMessageCount}
          />
          <h1 className="community-title font-display font-bold text-xl tracking-tight truncate min-w-0">
            {communityName || "\u00A0"}
          </h1>
        </header>
      )}

      {/* Responsive grid when authenticated, plain container otherwise */}
      <div
        className={
          showAuthenticatedLayout
            ? "md:grid md:grid-cols-[76px_1fr] lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_230px] md:gap-5 max-w-[1000px] xl:max-w-[1270px] mx-auto md:px-5"
            : ""
        }
      >
        {/* Sidebar: hidden on mobile, sticky on tablet+ */}
        {showAuthenticatedLayout && (
          <div className="framed hidden md:block sticky top-6 self-start my-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
            {/* Tablet: collapsed sidebar */}
            <div className="lg:hidden">
              <SidebarNav
                communityName={communityName}
                unreadCount={unreadCount}
                unreadMessageCount={unreadMessageCount}
                collapsed
              />
            </div>
            {/* Desktop: full sidebar */}
            <div className="hidden lg:block">
              <SidebarNav
                communityName={communityName}
                unreadCount={unreadCount}
                unreadMessageCount={unreadMessageCount}
              />
            </div>
          </div>
        )}

        {/* Main Content - always at same tree position */}
        <main
          ref={mainRef}
          className={
            showAuthenticatedLayout
              ? "app-main min-w-0 min-h-screen pb-24 md:pb-0 md:min-h-[calc(100vh-3rem)] md:my-6 bg-background md:framed"
              : "app-main min-h-screen bg-background"
          }
        >
          {children}
        </main>

        {/* Wide screens: clock and calendar on the right */}
        {showAuthenticatedLayout && (
          <aside className="hidden xl:block sticky top-6 self-start my-6">
            <ClockCalendar />
          </aside>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {showAuthenticatedLayout && (
        <MobileBottomNav
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        />
      )}
    </div>
  );
}
