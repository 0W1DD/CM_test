import type { ReactNode } from "react";
import { useScrollDirection } from "~/hooks/useScrollDirection";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { CyberHud } from "./cyber-hud";
import { SystemPanel } from "./system-panel";

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

  // Members get the app's navigation; visitors and applicants a plain page.
  const showAuthenticatedLayout = isAuthenticated && !isLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {showAuthenticatedLayout && (
        <header
          className={`sticky top-0 z-40 bg-card/85 backdrop-blur-xl border-b border-border/70 px-4 h-14 flex items-center gap-3 md:hidden transition-transform duration-300 ${headerHidden ? "-translate-y-full" : "translate-y-0"}`}
        >
          <MobileNavDrawer
            communityName={communityName}
            unreadCount={unreadCount}
            unreadMessageCount={unreadMessageCount}
          />
          <h1 className="font-display font-bold text-xl text-foreground tracking-tight">
            {communityName || "\u00A0"}
          </h1>
        </header>
      )}

      {/* Desktop: the top bar carries the menu */}
      {showAuthenticatedLayout && (
        <CyberHud
          communityName={communityName}
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        />
      )}

      {/* The page in the middle, the system panel on wide screens */}
      <div
        className={
          showAuthenticatedLayout
            ? "max-w-[1320px] mx-auto md:px-5 md:py-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6"
            : ""
        }
      >
        <main
          className={
            showAuthenticatedLayout
              ? "cyber-main min-w-0 min-h-screen md:min-h-[calc(100vh-7rem)] max-w-[760px] w-full mx-auto xl:mx-0 xl:ml-auto pb-24 md:pb-0"
              : "min-h-screen"
          }
        >
          {children}
        </main>
        {showAuthenticatedLayout && (
          <div className="hidden xl:block">
            <div className="sticky top-[5.5rem] max-w-[320px]">
              <SystemPanel />
            </div>
          </div>
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
