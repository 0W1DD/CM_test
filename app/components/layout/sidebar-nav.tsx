import {
  Bell,
  Bookmark,
  Home,
  LogOut,
  LayoutList,
  MessagesSquare,
  Megaphone,
  MessageCircle,
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
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

interface SidebarNavProps {
  communityName: string;
  unreadCount: number;
  unreadMessageCount: number;
  collapsed?: boolean;
}

export function SidebarNav({
  communityName,
  unreadCount,
  unreadMessageCount,
  collapsed = false,
}: SidebarNavProps) {
  const location = useLocation();
  const { currentProfile, logout } = useAuth();
  const { isModerator } = useCurrentInstance();

  const getNavLinkClasses = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    const baseClasses = collapsed
      ? "flex items-center justify-center p-3 rounded-2xl transition-all duration-200"
      : "flex items-center gap-3 px-4 py-2.5 text-base rounded-2xl transition-all duration-200 w-full";

    if (isActive) {
      return `${baseClasses} text-primary bg-primary/12 font-bold shadow-marsh`;
    }

    return `${baseClasses} text-foreground/80 hover:text-foreground hover:bg-accent/70 hover:-translate-y-px`;
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
    <aside
      className={`flex flex-col h-screen sticky top-0 ${collapsed ? "w-[72px] items-center" : "w-[280px]"} py-3 px-3`}
    >
      {/* Community Logo/Name */}
      <div
        className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} py-3 px-2`}
      >
        <Link
          to="/"
          aria-label="홈"
          className="bg-logo relative w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-marsh transition-transform duration-300 hover:rotate-[-6deg] hover:scale-105"
        >
          <MessagesSquare
            className="h-5 w-5 text-primary-foreground"
            strokeWidth={1.75}
          />
        </Link>
        {!collapsed && (
          <h1 className="font-display font-bold text-2xl text-foreground truncate tracking-tight">
            {communityName || "커뮹"}
          </h1>
        )}
      </div>

      {/* Profile Switcher */}
      <div className={`${collapsed ? "mt-2" : "mt-3 px-1"}`}>
        <ProfileSwitcher compact={collapsed} />
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
              title={item.label}
            >
              <div className="relative">
                <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="marsh-badge">
                    <span>{item.badge > 99 ? "99+" : item.badge}</span>
                  </div>
                )}
              </div>
              {!collapsed && (
                <span className="text-[15px] tracking-tight">{item.label}</span>
              )}
            </Link>
          );
        })}

        {/* Balance Pill (only renders if currency defined) */}
        <div className={`mt-4 ${collapsed ? "flex justify-center" : ""}`}>
          <BalancePill compact={collapsed} fullWidth={!collapsed} />
        </div>

        {/* Compose Button */}
        <Link to="/" className="mt-2">
          <Button
            className={`${collapsed ? "w-12 h-12 p-0" : "w-full py-3 text-[15px]"}`}
            size={collapsed ? "icon" : "lg"}
          >
            <PenSquare className={collapsed ? "h-5 w-5" : "h-5 w-5"} />
            {!collapsed && "새 글"}
          </Button>
        </Link>
      </nav>

      {/* Bottom Section */}
      <div
        className={`flex ${collapsed ? "flex-col items-center gap-2" : "items-center justify-between"} py-3`}
      >
        <ThemeToggle />
        {!collapsed && (
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
            title="로그아웃"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>로그아웃</span>
          </button>
        )}
      </div>
    </aside>
  );
}
