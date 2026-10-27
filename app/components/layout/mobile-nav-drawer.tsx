import { useState } from "react";
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
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { BalancePill } from "~/components/balance-pill";
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
    { to: "/", icon: Home, label: "홈" },
    {
      to: "/notifications",
      icon: Bell,
      label: "알림",
      badge: unreadCount,
    },
    {
      to: "/messages",
      icon: MessageCircle,
      label: "메시지",
      badge: unreadMessageCount,
    },
    {
      to: "/announcements",
      icon: Megaphone,
      label: "공지사항",
    },
    { to: "/boards", icon: LayoutList, label: "게시판" },
    { to: "/bookmarks", icon: Bookmark, label: "북마크" },
    { to: "/search", icon: Search, label: "검색" },
    { to: "/profiles", icon: UserCheck, label: "멤버" },
    ...(currentProfile
      ? [
          {
            to: `/@${currentProfile.username}`,
            icon: User,
            label: "프로필",
          },
        ]
      : []),
    { to: "/settings", icon: Settings, label: "설정" },
    ...(isModerator
      ? [{ to: "/admin", icon: ShieldCheck, label: "커뮤 관리" }]
      : []),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 -ml-2 rounded-full text-foreground hover:bg-accent/60 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[290px] p-0 border-r border-border/70 bg-sidebar"
        >
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <div className="flex flex-col h-full py-3 px-3">
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
              <h2 className="font-display font-bold text-2xl text-foreground truncate tracking-tight">
                {communityName || "커뮹"}
              </h2>
            </div>

            {/* Profile Switcher */}
            <div className="mt-2 px-2">
              <ProfileSwitcher compact={false} />
            </div>

            {/* Balance Pill */}
            <div className="mt-2 px-2">
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
