import { ChevronLeft, Plus, Star, Trash2, Users, Users2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CreateProfileModal } from "~/components/CreateProfileModal";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage, mutate, query } from "~/lib/naru";

export default function ProfilesManagement() {
  const {
    user,
    availableProfiles,
    isLoading: authLoading,
    refreshProfiles,
    currentProfile,
  } = useAuth();

  // Get current user's role in this community
  const {
    currentInstance: instanceData,
    isOwner,
    isModerator,
  } = useCurrentInstance();

  const isCommunityOwner = isOwner;
  const isModeratorOrOwner = isModerator;

  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(
    null,
  );

  const handleDeleteProfile = async (profileId: string) => {
    setDeletingProfileId(profileId);
    try {
      // First, get the post count for this profile
      const { post_count: postCount } = await query<{ post_count: number }>(
        "profiles:postCount",
        { profile_id: profileId },
      );

      // If profile has posts, ask for confirmation
      if (postCount > 0) {
        const confirmed = window.confirm(
          `이 프로필에는 ${postCount}개의 게시물이 있습니다. 정말 삭제하시겠습니까?`,
        );
        if (!confirmed) {
          setDeletingProfileId(null);
          return;
        }
      }

      await mutate("profiles:delete", { profile_id: profileId });
      // Refresh profiles to get the latest data
      refreshProfiles();
      toast.success("프로필이 삭제되었습니다");
    } catch (error) {
      toast.error(errorMessage(error, "프로필 삭제에 실패했습니다"));
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleSetPrimaryProfile = async (profileId: string) => {
    try {
      await mutate("profiles:setPrimary", { profile_id: profileId });
      refreshProfiles();
      toast.success("메인 프로필이 설정되었습니다");
    } catch (error) {
      toast.error(errorMessage(error, "메인 프로필 설정에 실패했습니다"));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-64">
            <div className="flex items-center gap-3">
              <Spinner className="h-6 w-6" />
              <span className="text-muted-foreground">로딩 중...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인 필요
            </h1>
            <p className="text-muted-foreground">
              설정에 접근하려면 로그인하세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has permission to access profile management
  if (!authLoading && instanceData && !isModeratorOrOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              접근 권한 없음
            </h1>
            <p className="text-muted-foreground mb-4">
              프로필 관리는 모더레이터 또는 소유자만 접근할 수 있습니다.
            </p>
            <Link to="/settings">
              <Button>설정으로 돌아가기</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>설정으로 돌아가기</span>
          </Link>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-muted px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    프로필 관리
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    여러 프로필을 생성하고 관리해보세요
                  </p>
                </div>
                {isModeratorOrOwner && (
                  <Button
                    variant="default"
                    className="flex items-center gap-2"
                    onClick={() => setShowCreateProfileModal(true)}
                  >
                    <Plus className="h-4 w-4" />새 프로필
                  </Button>
                )}
              </div>
            </div>

            {/* Profile List */}
            <div className="p-6">
              <div className="space-y-6">
                {availableProfiles.map((avatarItem) => (
                  <div key={avatarItem.id} className="space-y-4">
                    <div
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        avatarItem.id === currentProfile?.id
                          ? "border-primary/30 bg-primary/5"
                          : "border-border hover:border-border"
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <ProfileAvatar
                          profilePictureUrl={
                            avatarItem.profile_picture_url || undefined
                          }
                          name={avatarItem.name}
                          username={avatarItem.username || ""}
                          size="md"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {avatarItem.name}
                            </h3>
                            {avatarItem.is_primary && (
                              <div title="메인 프로필">
                                <Star className="h-4 w-4 text-primary fill-current" />
                              </div>
                            )}
                            {avatarItem.id === currentProfile?.id && (
                              <div
                                className="h-2 w-2 bg-primary rounded-full"
                                title="현재 프로필"
                              />
                            )}
                          </div>
                          {avatarItem.username && (
                            <p className="text-sm text-muted-foreground">
                              @{avatarItem.username}
                            </p>
                          )}
                          {avatarItem.bio && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {avatarItem.bio}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            생성일:{" "}
                            {new Date(avatarItem.created_at).toLocaleDateString(
                              "ko-KR",
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isCommunityOwner && (
                          <Link to={`/settings/profiles/${avatarItem.id}`}>
                            <Button variant="outline" size="sm">
                              <Users2 className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {!avatarItem.is_primary &&
                          avatarItem.role === "owner" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleSetPrimaryProfile(avatarItem.id)
                              }
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                        {availableProfiles.length > 1 &&
                          !avatarItem.is_primary && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProfile(avatarItem.id)}
                              disabled={deletingProfileId === avatarItem.id}
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              {deletingProfileId === avatarItem.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {availableProfiles.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users />
                    </EmptyMedia>
                    <EmptyTitle>프로필이 없습니다</EmptyTitle>
                    <EmptyDescription>
                      첫 번째 프로필을 만들어보세요!
                    </EmptyDescription>
                  </EmptyHeader>
                  {isModeratorOrOwner && (
                    <Button onClick={() => setShowCreateProfileModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      프로필 만들기
                    </Button>
                  )}
                </Empty>
              )}
            </div>
          </div>
        </div>
      </main>

      <CreateProfileModal
        isOpen={showCreateProfileModal}
        onClose={() => setShowCreateProfileModal(false)}
        onSuccess={refreshProfiles}
      />
    </div>
  );
}
