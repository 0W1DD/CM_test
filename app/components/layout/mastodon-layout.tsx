import type { ReactNode } from "react";
import { useScrollDirection } from "~/hooks/useScrollDirection";
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

      {/* Responsive grid when authenticated, plain container otherwise */}
      <div
        className={
          showAuthenticatedLayout
            ? "md:grid md:grid-cols-[72px_1fr] lg:grid-cols-[280px_1fr] max-w-[960px] mx-auto"
            : ""
        }
      >
        {/* Sidebar: hidden on mobile, sticky on tablet+ */}
        {showAuthenticatedLayout && (
          <div className="hidden md:block sticky top-0 h-screen overflow-y-auto">
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
          className={
            showAuthenticatedLayout
              ? "min-w-0 min-h-screen md:border-x md:border-border/70 md:bg-card/40 md:backdrop-blur-sm pb-24 md:pb-0"
              : "min-h-screen"
          }
        >
          {children}
        </main>
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
