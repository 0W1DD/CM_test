import { Crown, Settings, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useCommunityProfiles } from "~/hooks/useCommunityProfiles";
import { useProfileSharing } from "~/hooks/useProfileSharing";
import type { Profile } from "~/types/profile";

interface ProfileShareManagerProps {
  profile: Profile;
  currentUserId: string;
  isOwner: boolean;
}

export function ProfileShareManager({
  profile,
  currentUserId: _currentUserId,
  isOwner,
}: ProfileShareManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUserGroupKey, setSelectedUserGroupKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    sharedUsers,
    loading: usersLoading,
    addUser,
    removeUser,
  } = useProfileSharing(profile.id);

  const { profiles: communityProfiles, loading: profilesLoading } =
    useCommunityProfiles();

  // Filter out already shared profiles, current profile, and only show moderator/owner profiles
  const availableProfiles = communityProfiles.filter(
    (p) =>
      (p.user_role === "owner" || p.user_role === "moderator") &&
      p.username !== profile.username &&
      !sharedUsers.some((u) =>
        u.profiles.some((up) => up.username === p.username),
      ),
  );

  // Group profiles by user_group_key
  const profilesByUser = availableProfiles.reduce(
    (acc, p) => {
      const key = p.user_group_key;
      const group = acc[key] || [];
      group.push(p);
      acc[key] = group;
      return acc;
    },
    {} as Record<string, typeof availableProfiles>,
  );

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserGroupKey.trim()) return;

    // Find the first profile for this user group
    const userProfiles = profilesByUser[selectedUserGroupKey];
    if (!userProfiles || userProfiles.length === 0) return;

    const firstProfile = userProfiles[0];
    if (!firstProfile) return;

    setIsLoading(true);
    try {
      await addUser(profile.id, firstProfile.username, "admin");
      setSelectedUserGroupKey("");
      toast.success(`${firstProfile.name} 사용자가 성공적으로 추가되었습니다`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "사용자 추가에 실패했습니다",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = async (sharedProfileId: string) => {
    try {
      await removeUser(profile.id, sharedProfileId);
      toast.success("사용자의 접근 권한이 제거되었습니다");
    } catch (_error) {
      toast.error("사용자 제거에 실패했습니다");
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            공유 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>소유자만 공유 설정을 관리할 수 있습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              공유된 액세스
            </div>
            <Button onClick={() => setIsOpen(true)} size="sm">
              <Users className="h-4 w-4 mr-2" />
              공유 관리
            </Button>
          </CardTitle>
          <CardDescription>
            이 프로필에 접근할 수 있는 사용자들을 관리하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              로딩 중...
            </div>
          ) : sharedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>공유된 사용자가 없습니다</p>
              <p className="text-sm mt-2">
                다른 사용자와 이 프로필을 공유해보세요
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                {sharedUsers.length}명의 사용자가 액세스 가능
              </div>
              <div className="grid gap-2">
                {sharedUsers.slice(0, 3).map((user, idx) => {
                  const primaryProfile = user.profiles.find(
                    (p) => p.is_primary,
                  );
                  const displayProfile = primaryProfile || user.profiles[0];

                  return (
                    <div
                      key={user.primary_profile_id || idx}
                      className="flex items-center justify-between p-3 border rounded hover:bg-background transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {displayProfile ? (
                          <>
                            {displayProfile.profile_picture_url ? (
                              <img
                                src={displayProfile.profile_picture_url}
                                alt={displayProfile.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                {displayProfile.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground truncate">
                                  {displayProfile.name}
                                </p>
                                <Badge
                                  variant={
                                    user.role === "owner"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="shrink-0"
                                >
                                  {user.role === "owner" ? "소유자" : "관리자"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.profiles.map((p, pIdx) => (
                                  <span key={p.id}>
                                    {pIdx > 0 && ", "}
                                    <span
                                      className={
                                        p.is_primary ? "font-semibold" : ""
                                      }
                                    >
                                      @{p.username}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">
                                  프로필 없음
                                </p>
                                <Badge
                                  variant={
                                    user.role === "owner"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {user.role === "owner" ? "소유자" : "관리자"}
                                </Badge>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {sharedUsers.length > 3 && (
                <div className="text-sm text-muted-foreground text-center">
                  외 {sharedUsers.length - 3}명
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              프로필 공유 관리: @{profile.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Users List */}
            <div className="space-y-4">
              <h3 className="font-semibold">접근 권한이 있는 사용자</h3>
              {usersLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  로딩 중...
                </div>
              ) : sharedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>공유된 사용자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sharedUsers.map((user, idx) => {
                    const primaryProfile = user.profiles.find(
                      (p) => p.is_primary,
                    );
                    const displayProfile = primaryProfile || user.profiles[0];

                    return (
                      <div
                        key={user.primary_profile_id || idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {displayProfile ? (
                            <>
                              {displayProfile.profile_picture_url ? (
                                <img
                                  src={displayProfile.profile_picture_url}
                                  alt={displayProfile.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                  {displayProfile.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground truncate">
                                    {displayProfile.name}
                                  </p>
                                  <Badge
                                    variant={
                                      user.role === "owner"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="shrink-0"
                                  >
                                    {user.role === "owner" ? (
                                      <div className="flex items-center gap-1">
                                        <Crown className="h-3 w-3" />
                                        소유자
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Settings className="h-3 w-3" />
                                        관리자
                                      </div>
                                    )}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.profiles.map((p, pIdx) => (
                                    <span key={p.id}>
                                      {pIdx > 0 && ", "}
                                      <span
                                        className={
                                          p.is_primary ? "font-semibold" : ""
                                        }
                                      >
                                        @{p.username}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(user.added_at).toLocaleDateString(
                                    "ko-KR",
                                  )}
                                  에 추가됨
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-muted-foreground">
                                    프로필 없음
                                  </p>
                                  <Badge
                                    variant={
                                      user.role === "owner"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {user.role === "owner" ? (
                                      <div className="flex items-center gap-1">
                                        <Crown className="h-3 w-3" />
                                        소유자
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Settings className="h-3 w-3" />
                                        관리자
                                      </div>
                                    )}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(user.added_at).toLocaleDateString(
                                    "ko-KR",
                                  )}
                                  에 추가됨
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                        {user.primary_profile_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              user.primary_profile_id
                                ? handleRemoveUser(user.primary_profile_id)
                                : undefined
                            }
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add User Form */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">새 사용자 추가</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <Label>사용자 선택</Label>
                  {profilesLoading ? (
                    <div className="text-sm text-muted-foreground py-2">
                      사용자 로딩 중...
                    </div>
                  ) : availableProfiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      공유 가능한 사용자가 없습니다. 소유자 또는 관리자 권한을
                      가진 사용자에게만 공유할 수 있습니다.
                    </div>
                  ) : (
                    <Select
                      value={selectedUserGroupKey}
                      onValueChange={setSelectedUserGroupKey}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="사용자 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(profilesByUser).map(
                          ([userGroupKey, userProfiles]) => {
                            const primaryProfile =
                              userProfiles.find((p) => p.is_primary) ||
                              userProfiles[0];
                            if (!primaryProfile) return null;

                            const profileNames = userProfiles
                              .map((p) => `@${p.username}`)
                              .join(", ");
                            return (
                              <SelectItem
                                key={userGroupKey}
                                value={userGroupKey}
                              >
                                <div className="flex items-center gap-2">
                                  {primaryProfile.profile_picture_url ? (
                                    <img
                                      src={primaryProfile.profile_picture_url}
                                      alt={primaryProfile.name}
                                      className="w-6 h-6 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                      {primaryProfile.name
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {primaryProfile.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {userProfiles.length > 1
                                        ? `${userProfiles.length}개 프로필: ${profileNames}`
                                        : profileNames}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          },
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    닫기
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isLoading ||
                      !selectedUserGroupKey.trim() ||
                      availableProfiles.length === 0
                    }
                  >
                    {isLoading ? "추가 중..." : "사용자 추가"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
