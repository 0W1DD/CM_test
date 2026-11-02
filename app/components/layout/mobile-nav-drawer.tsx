import { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  Home,
  LogOut,
  LayoutList,
  Megaphone,
  Menu,
  MessageCircle,
  MessagesSquare,
  PenSquare,
  Search,
  Settings,
  ScrollText,
  ShoppingBag,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { BalancePill } from "~/components/balance-pill";
import { MENU_EVENT } from "~/components/onboarding-tour";
import { ProfileSwitcher } from "~/components/profile-switcher";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

interface MobileNavDrawerProps {
  communityName: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function MobileNavDrawer({
  communityName,
  unreadCount,
  unreadMessageCount,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  // The first-visit tour opens and closes the menu to show what is in it.
  useEffect(() => {
    const onMenu = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(MENU_EVENT, onMenu);
    return () => window.removeEventListener(MENU_EVENT, onMenu);
  }, []);
  const location = useLocation();
  const { currentProfile, logout } = useAuth();
  const { isModerator } = useCurrentInstance();

  const getNavLinkClasses = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    const baseClasses =
      "flex items-center gap-3 px-4 py-2.5 text-base rounded-2xl transition-all duration-200 w-full";

    if (isActive) {
      return `${baseClasses} text-primary bg-primary/12 font-bold shadow-marsh`;
    }

    return `${baseClasses} text-foreground/80 hover:text-foreground hover:bg-accent/70`;
  };

  const navigationItems = [
    { tour: "nav-home", to: "/", icon: Home, label: "홈" },
    {
      tour: "nav-notifications",
      to: "/notifications",
      icon: Bell,
      label: "알림",
      badge: unreadCount,
    },
    {
      tour: "nav-messages",
      to: "/messages",
      icon: MessageCircle,
      label: "메시지",
      badge: unreadMessageCount,
    },
    {
      tour: "nav-announcements",
      to: "/announcements",
      icon: Megaphone,
      label: "공지사항",
    },
    { tour: "nav-boards", to: "/boards", icon: LayoutList, label: "게시판" },
    { tour: "nav-shop", to: "/shop", icon: ShoppingBag, label: "상점" },
    { tour: "nav-uses", to: "/uses", icon: ScrollText, label: "사용 로그" },
    {
      tour: "nav-bookmarks",
      to: "/bookmarks",
      icon: Bookmark,
      label: "북마크",
    },
    { tour: "nav-search", to: "/search", icon: Search, label: "검색" },
    { tour: "nav-profiles", to: "/profiles", icon: UserCheck, label: "멤버" },
    ...(currentProfile
      ? [
          {
            tour: "nav-profile",
            to: `/@${currentProfile.username}`,
            icon: User,
            label: "프로필",
          },
        ]
      : []),
    { tour: "nav-settings", to: "/settings", icon: Settings, label: "설정" },
    ...(isModerator
      ? [
          {
            tour: "nav-admin",
            to: "/admin",
            icon: ShieldCheck,
            label: "커뮤 관리",
          },
        ]
      : []),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="menu"
        className="p-2 -ml-2 rounded-full text-foreground hover:bg-accent/60 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[290px] p-0 border-r border-border/70 bg-sidebar"
          // The tour's own buttons sit outside the menu; using them keeps it open.
          onInteractOutside={(e) => {
            if ((e.target as Element | null)?.closest?.(".tour-root"))
              e.preventDefault();
          }}
        >
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <div
            data-tour-scope="menu"
            className="flex flex-col h-full py-3 px-3"
          >
            {/* Community Logo/Name */}
            <div className="flex items-center gap-3 py-3 px-2">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                aria-label="홈"
                className="bg-logo relative w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-marsh"
              >
                <MessagesSquare
                  className="h-5 w-5 text-primary-foreground"
                  strokeWidth={1.75}
                />
              </Link>
              <h2 className="community-title font-display font-bold text-2xl leading-snug tracking-tight min-w-0">
                {communityName || "커뮹"}
              </h2>
            </div>

            {/* Profile Switcher */}
            <div data-tour="profile-switcher" className="mt-2 px-2">
              <ProfileSwitcher compact={false} />
            </div>

            {/* Balance Pill */}
            <div data-tour="balance" className="mt-2 px-2">
              <BalancePill fullWidth />
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1 mt-4 flex-1 overflow-y-auto">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-tour={item.tour}
                    className={getNavLinkClasses(item.to)}
                    onClick={() => setOpen(false)}
                  >
                    <div className="relative">
                      <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                      {item.badge !== undefined && item.badge > 0 && (
                        <div className="marsh-badge">
                          <span>{item.badge > 99 ? "99+" : item.badge}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[15px] tracking-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}

              {/* Compose Button */}
              <Link to="/" onClick={() => setOpen(false)} className="mt-4">
                <Button className="w-full py-3 text-[15px]" size="lg">
                  <PenSquare className="h-5 w-5" />새 글
                </Button>
              </Link>
            </nav>

            {/* Bottom Section */}
            <div className="flex items-center justify-between py-3">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
                title="로그아웃"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
