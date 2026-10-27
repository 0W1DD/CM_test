import {
  Bell,
  Bookmark,
  Home,
  LayoutList,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Moon,
  PenSquare,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  User,
  Sun,
  UserCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useLocation } from "react-router";
import { BalancePill } from "~/components/balance-pill";
import { ProfileSwitcher } from "~/components/profile-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

interface CyberHudProps {
  communityName: string;
  unreadCount: number;
  unreadMessageCount: number;
}

/** Whether `path` is the page being shown (home only for "/"). */
function useIsActive() {
  const { pathname } = useLocation();
  return (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);
}

/**
 * The desktop's top bar: the community's name, the main menu across it, and
 * the acting profile, balance and a new post on the right. The rest of the
 * menu sits under "MENU".
 */
export function CyberHud({
  communityName,
  unreadCount,
  unreadMessageCount,
}: CyberHudProps) {
  const isActive = useIsActive();
  const { currentProfile, logout } = useAuth();
  const { isModerator } = useCurrentInstance();
  const name = communityName || "COMMUNG";
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";

  const main = [
    { to: "/", icon: Home, label: "홈", code: "01" },
    { to: "/notifications", icon: Bell, label: "알림", code: "02", badge: unreadCount },
    {
      to: "/messages",
      icon: MessageCircle,
      label: "메시지",
      code: "03",
      badge: unreadMessageCount,
    },
    { to: "/announcements", icon: Megaphone, label: "공지", code: "04" },
    { to: "/boards", icon: LayoutList, label: "게시판", code: "05" },
    { to: "/shop", icon: ShoppingBag, label: "상점", code: "06" },
    { to: "/search", icon: Search, label: "검색", code: "07" },
  ];

  const more = [
    { to: "/bookmarks", icon: Bookmark, label: "북마크" },
    { to: "/profiles", icon: UserCheck, label: "멤버" },
    ...(currentProfile
      ? [{ to: `/@${currentProfile.username}`, icon: User, label: "내 프로필" }]
      : []),
    { to: "/settings", icon: Settings, label: "설정" },
    ...(isModerator
      ? [{ to: "/admin", icon: ShieldCheck, label: "커뮤 관리" }]
      : []),
  ];

  return (
    <header className="cyber-hud sticky top-0 z-40 hidden md:block">
      <div className="max-w-[1320px] mx-auto h-16 px-5 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 min-w-0 shrink-0 group">
          <span className="cyber-logo" aria-hidden="true">
            <span />
          </span>
          <span className="flex flex-col min-w-0 leading-none">
            <span className="cyber-kicker">// NODE ONLINE</span>
            <span
              className="cyber-glitch font-display font-black text-lg tracking-wide truncate max-w-[220px]"
              data-text={name}
            >
              {name}
            </span>
          </span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className="flex items-stretch h-full flex-1 min-w-0 overflow-x-auto no-scrollbar"
        >
          {main.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`cyber-tab ${active ? "is-active" : ""}`}
                title={item.label}
              >
                <span className="cyber-tab-code">{item.code}</span>
                <span className="relative">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="cyber-badge">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden xl:block">
            <BalancePill />
          </div>
          <ProfileSwitcher compact />
          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="cyber-button-ghost !px-3"
            aria-label={dark ? "밝은 화면으로" : "어두운 화면으로"}
            title={dark ? "밝은 화면으로" : "어두운 화면으로"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="cyber-button-ghost" aria-label="전체 메뉴">
                <Menu className="h-4 w-4" />
                <span className="hidden lg:inline">MENU</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {more.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/" className="cyber-button">
            <PenSquare className="h-4 w-4" />
            <span className="hidden lg:inline">새 글</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
