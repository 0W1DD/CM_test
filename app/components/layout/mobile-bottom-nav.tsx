import { Bell, Home, LayoutGrid, Megaphone, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router";

interface MobileBottomNavProps {
  unreadCount: number;
  unreadMessageCount: number;
}

export function MobileBottomNav({
  unreadCount,
  unreadMessageCount,
}: MobileBottomNavProps) {
  const location = useLocation();

  const isActivePath = (path: string) =>
    location.pathname === path ||
    (path === "/" && location.pathname === "/") ||
    (path !== "/" && location.pathname.startsWith(path));

  const navItems = [
    { to: "/", icon: Home, label: "홈" },
    { to: "/boards", icon: LayoutGrid, label: "게시판" },
    { to: "/announcements", icon: Megaphone, label: "공지" },
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
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
      <div className="mx-auto flex items-center justify-around h-14 max-w-[480px] rounded-full bg-card/85 backdrop-blur-xl border border-border/80 shadow-marsh-lg px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={`relative flex items-center justify-center flex-1 h-11 mx-0.5 rounded-full transition-all duration-200 ${
                active
                  ? "text-primary bg-primary/12 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <div className="relative">
                <Icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={active ? 2.4 : 2}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.12 : 1}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="marsh-badge">
                    <span>{item.badge > 99 ? "99+" : item.badge}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
