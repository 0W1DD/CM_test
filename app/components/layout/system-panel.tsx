import { Bookmark, Settings, ShieldCheck, User, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BalancePill } from "~/components/balance-pill";
import { OnlineUsers } from "~/components/online-users";
import { ProfileAvatar } from "~/components/profile-avatar";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

/** The time now, ticking each second, as HH:MM:SS. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The desktop's right column: who is acting, the community's clock and how
 * long until it ends, who is online, and shortcuts.
 */
export function SystemPanel() {
  const { currentProfile } = useAuth();
  const { currentInstance, instanceName, isModerator } = useCurrentInstance();
  const now = useClock();

  const endsAt = currentInstance?.ends_at
    ? new Date(currentInstance.ends_at)
    : null;
  const indefinite = !endsAt || endsAt.getFullYear() >= 2099;
  const daysLeft = endsAt
    ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000))
    : null;
  const ended = endsAt ? now > endsAt : false;

  const links = [
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
    <aside className="space-y-4" aria-label="시스템 패널">
      {currentProfile && (
        <section className="cyber-panel p-4">
          <p className="cyber-kicker mb-3">// OPERATOR</p>
          <div className="flex items-center gap-3">
            <ProfileAvatar
              profilePictureUrl={currentProfile.profile_picture_url}
              name={currentProfile.name}
              username={currentProfile.username}
              profileId={currentProfile.id}
              size="lg"
              showOnlineStatus
            />
            <div className="min-w-0">
              <p className="font-bold truncate">{currentProfile.name}</p>
              <p className="font-mono text-xs text-muted-foreground truncate">
                @{currentProfile.username}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <BalancePill fullWidth />
          </div>
        </section>
      )}

      <section className="cyber-panel p-4">
        <p className="cyber-kicker mb-2">// SYSTEM CLOCK</p>
        <p className="cyber-clock" aria-live="off">
          {pad(now.getHours())}
          <span className="cyber-blink">:</span>
          {pad(now.getMinutes())}
          <span className="cyber-blink">:</span>
          {pad(now.getSeconds())}
        </p>
        <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground truncate">
            {instanceName || "커뮤"}
          </span>
          <span className="font-mono text-sm text-[var(--neon-pink)] whitespace-nowrap">
            {indefinite
              ? "∞ 무기한"
              : ended
                ? "종료됨"
                : `종료까지 D-${daysLeft}`}
          </span>
        </div>
      </section>

      <div className="cyber-online">
        <OnlineUsers />
      </div>

      <nav className="cyber-panel p-2" aria-label="바로가기">
        <p className="cyber-kicker px-2 pt-2 pb-1">// QUICK ACCESS</p>
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="cyber-quick">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
              <span className="ml-auto font-mono text-xs opacity-50">→</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
