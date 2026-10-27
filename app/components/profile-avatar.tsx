import { User } from "lucide-react";
import { useProfileOnlineStatus } from "~/hooks/useOnlineStatus";
import { getGradientForUser } from "~/lib/gradient-utils";
import { cn } from "~/lib/utils";

interface ProfileAvatarProps {
  profilePictureUrl?: string | null;
  name: string;
  username?: string;
  profileId?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showOnlineStatus?: boolean;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-20 h-20",
};

const iconSizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-10 w-10",
};

const onlineIndicatorSizeClasses = {
  sm: "w-2 h-2 border",
  md: "w-2.5 h-2.5 border",
  lg: "w-3 h-3 border-2",
  xl: "w-4 h-4 border-2",
};

export function ProfileAvatar({
  profilePictureUrl,
  name,
  username,
  profileId,
  size = "lg",
  className,
  showOnlineStatus = false,
}: ProfileAvatarProps) {
  const gradient = getGradientForUser(username, name);
  const baseClasses = `bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center overflow-hidden`;
  const sizeClass = sizeClasses[size];
  const iconSizeClass = iconSizeClasses[size];
  const onlineIndicatorSizeClass = onlineIndicatorSizeClasses[size];

  // const isOnline = useProfileOnlineStatus(
  //   showOnlineStatus ? profileId : undefined,
  // );
  const isOnline = false;

  return (
    <div className="relative inline-block">
      <div className={cn(baseClasses, sizeClass, className)}>
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={`${name}의 프로필 사진`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <User className={cn(iconSizeClass, "text-white")} />
        )}
      </div>
      {showOnlineStatus && isOnline && (
        <div
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-online border-2 border-background",
            onlineIndicatorSizeClass,
          )}
          title="온라인"
        />
      )}
    </div>
  );
}
