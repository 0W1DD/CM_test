import { ChevronDown, Crown, Settings, Star, Users } from "lucide-react";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuth } from "~/hooks/useAuth";
import type { Profile } from "~/types/profile";

/** A profile shared with the member rather than their own (role `admin`). */
const isShared = (profile: Profile) =>
  profile.is_owned === false || profile.role === "admin";

interface ProfileSwitcherProps {
  compact?: boolean;
}

export function ProfileSwitcher({ compact = false }: ProfileSwitcherProps) {
  const { currentProfile, availableProfiles, switchProfile, isLoading } =
    useAuth();

  if (!currentProfile || availableProfiles.length === 0) {
    if (isLoading) {
      return compact ? (
        <Skeleton className="h-10 w-10 rounded-full" />
      ) : (
        <Skeleton className="h-10 w-full rounded-full" />
      );
    }
    return null;
  }

  // Find the current profile in availableProfiles to get the most up-to-date info
  const displayProfile =
    availableProfiles.find((profile) => profile.id === currentProfile.id) ||
    currentProfile;

  const handleSwitchProfile = async (profileId: string) => {
    if (profileId !== currentProfile.id) {
      await switchProfile(profileId);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={
            compact
              ? "h-auto p-2 rounded-full"
              : "h-auto p-2 justify-start space-x-2 rounded-full"
          }
        >
          <ProfileAvatar
            profilePictureUrl={displayProfile.profile_picture_url || undefined}
            name={displayProfile.name}
            username={displayProfile.username || ""}
            size={compact ? "md" : "sm"}
          />
          {!compact && (
            <>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">
                    {displayProfile.name}
                  </div>
                  {isShared(displayProfile) && (
                    <Badge variant="secondary" className="text-xs">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {displayProfile.role === "owner" ? (
                          <Crown className="h-3 w-3" />
                        ) : (
                          <Settings className="h-3 w-3" />
                        )}
                      </div>
                    </Badge>
                  )}
                </div>
                {displayProfile.username && (
                  <div className="text-xs text-muted-foreground">
                    @{displayProfile.username}
                  </div>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {(() => {
          const ownedProfiles = availableProfiles.filter(
            (profile) => !isShared(profile),
          );
          const sharedProfiles = availableProfiles.filter(isShared);

          const getRoleIcon = (role?: string) => {
            if (role === "owner") return <Crown className="h-3 w-3" />;
            if (role === "admin") return <Settings className="h-3 w-3" />;
            return null;
          };

          return (
            <>
              {ownedProfiles.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
                    내 프로필
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ownedProfiles.map((profile) => (
                    <DropdownMenuItem
                      key={profile.id}
                      onClick={() => handleSwitchProfile(profile.id)}
                      className="p-3 cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <ProfileAvatar
                          profilePictureUrl={
                            profile.profile_picture_url || undefined
                          }
                          name={profile.name}
                          username={profile.username || ""}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            <span className="text-sm font-medium truncate">
                              {profile.name}
                            </span>
                            {profile.is_primary && (
                              <div title="메인 프로필">
                                <Star className="h-3 w-3 text-star fill-current" />
                              </div>
                            )}
                            {profile.id === currentProfile.id && (
                              <div
                                className="h-2 w-2 bg-mint rounded-full"
                                title="현재 프로필"
                              />
                            )}
                          </div>
                          {profile.username && (
                            <div className="text-xs text-muted-foreground truncate">
                              @{profile.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {sharedProfiles.length > 0 && (
                <>
                  {ownedProfiles.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    공유된 프로필
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {sharedProfiles.map((profile) => (
                    <DropdownMenuItem
                      key={profile.id}
                      onClick={() => handleSwitchProfile(profile.id)}
                      className="p-3 cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <ProfileAvatar
                          profilePictureUrl={
                            profile.profile_picture_url || undefined
                          }
                          name={profile.name}
                          username={profile.username || ""}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            <span className="text-sm font-medium truncate">
                              {profile.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              <div className="flex items-center gap-1">
                                {getRoleIcon(profile.role)}
                                {profile.role === "owner" ? "소유자" : "관리자"}
                              </div>
                            </Badge>
                            {profile.id === currentProfile.id && (
                              <div
                                className="h-2 w-2 bg-mint rounded-full"
                                title="현재 프로필"
                              />
                            )}
                          </div>
                          {profile.username && (
                            <div className="text-xs text-muted-foreground truncate">
                              @{profile.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </>
          );
        })()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
