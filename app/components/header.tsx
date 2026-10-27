import {
  Bell,
  Bookmark,
  Hash,
  Home,
  Megaphone,
  Menu,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { ProfileSwitcher } from "~/components/profile-switcher";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

interface HeaderProps {
  communityName: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function Header({
  communityName,
  unreadCount,
  unreadMessageCount,
}: HeaderProps) {
  const location = useLocation();
  const { currentProfile, belongsToCurrentInstance } = useAuth();
  const { isModerator } = useCurrentInstance();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getNavLinkClasses = (path: string, isMobile = false) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    const baseClasses = isMobile
      ? "flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors w-full"
      : "inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors";

    if (isActive) {
      return `${baseClasses} text-primary-foreground bg-primary hover:bg-primary/90`;
    }

    return `${baseClasses} text-muted-foreground hover:text-foreground hover:bg-accent`;
  };

  const navigationItems = [
    { to: "/", icon: Home, label: "홈", title: "홈" },
    ...(currentProfile
      ? [
          {
            to: `/@${currentProfile.username}`,
            icon: User,
            label: "프로필",
            title: "내 프로필",
          },
        ]
      : []),
    {
      to: "/notifications",
      icon: Bell,
      label: "알림",
      title: "알림",
      badge: unreadCount,
    },
    {
      to: "/messages",
      icon: MessageCircle,
      label: "메시지",
      title: "메시지",
      badge: unreadMessageCount,
    },
    {
      to: "/announcements",
      icon: Megaphone,
      label: "공지사항",
      title: "공지사항",
    },
    { to: "/bookmarks", icon: Bookmark, label: "북마크", title: "북마크" },
    { to: "/search", icon: Search, label: "검색", title: "검색" },
    { to: "/profiles", icon: UserCheck, label: "멤버", title: "멤버 목록" },
    { to: "/settings", icon: Settings, label: "설정", title: "설정" },
    ...(isModerator
      ? [{ to: "/admin", icon: ShieldCheck, label: "관리", title: "커뮤 관리" }]
      : []),
  ];

  const renderNavItem = (
    item: {
      to: string;
      icon: React.ElementType;
      label: string;
      title: string;
      badge?: number;
    },
    isMobile = false,
  ) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={getNavLinkClasses(item.to, isMobile)}
        title={item.title}
        onClick={() => isMobile && setMobileMenuOpen(false)}
      >
        <div className="relative">
          <Icon className="h-4 w-4" />
          {item.badge !== undefined && item.badge > 0 && (
            <div className="marsh-badge w-3.5 h-3.5 min-w-0 -top-1 -right-1">
              <span className="text-[8px] font-bold">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            </div>
          )}
        </div>
        <span className={isMobile ? "" : "hidden sm:inline"}>{item.label}</span>
      </Link>
    );
  };
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-4xl mx-auto px-4">
        {/* First Row - Community Info & Console Link */}
        <div className="flex items-center justify-between h-12 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <a href="/">
                  <Hash className="h-4 w-4 text-primary-foreground" />
                </a>
              </div>
              <div>
                <h1 className="font-bold text-foreground">
                  <a href="/">{communityName || "커뮤"}</a>
                </h1>
              </div>
            </div>
            <div className="h-6 w-px bg-border"></div>
            {belongsToCurrentInstance ? null : (
              <Link
                to="/apply"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                title="가입 신청"
              >
                <UserCheck className="h-4 w-4" />
                <span className="hidden lg:inline">가입 신청</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ProfileSwitcher />
          </div>
        </div>

        {/* Second Row - Navigation */}
        <div className="flex items-center justify-between md:justify-center h-12">
          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="메뉴 열기"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>메뉴</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-6">
                  {navigationItems
                    .filter(
                      (item) =>
                        item.to !== "/notifications" && item.to !== "/messages",
                    )
                    .map((item) => renderNavItem(item, true))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Mobile: Show Notifications and Messages outside drawer */}
            {navigationItems
              .filter(
                (item) =>
                  item.to === "/notifications" || item.to === "/messages",
              )
              .map((item) => renderNavItem(item, false))}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-3">
            {navigationItems.map((item) => renderNavItem(item, false))}
          </nav>
        </div>
      </div>
    </header>
  );
}
