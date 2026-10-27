import { ArrowLeft, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import { ProfileShareManager } from "~/components/profile-share-manager";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { getGradientForUser } from "~/lib/gradient-utils";

export default function ProfileSharingSettings() {
  const { profileId } = useParams();
  const { user, availableProfiles, isLoading: authLoading } = useAuth();

  // Only the community owner shares profiles.
  const { isOwner: isCommunityOwner } = useCurrentInstance();

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

  const profile = availableProfiles.find((a) => a.id === profileId);

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Link to="/settings/profiles">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  프로필 관리로 돌아가기
                </Button>
              </Link>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
              <h1 className="text-2xl font-bold text-foreground mb-3">
                프로필를 찾을 수 없습니다
              </h1>
              <p className="text-muted-foreground mb-4">
                요청하신 프로필이 존재하지 않거나 접근 권한이 없습니다.
              </p>
              <Link to="/settings/profiles">
                <Button>프로필 관리로 돌아가기</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link to="/settings/profiles">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                프로필 관리로 돌아가기
              </Button>
            </Link>
          </div>

          {/* Profile Info Header */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
            <div
              className={`bg-gradient-to-r ${getGradientForUser(
                profile.username || "",
                profile.name,
              )} px-6 py-8`}
            >
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  profilePictureUrl={profile.profile_picture_url || undefined}
                  name={profile.name}
                  username={profile.username}
                  size="xl"
                  className="bg-white/20 backdrop-blur"
                />
                <div className="text-white">
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    프로필 공유 설정
                  </h1>
                  <div className="mt-2">
                    <p className="text-xl font-semibold">{profile.name}</p>
                    {profile.username && (
                      <p className="text-white/90">@{profile.username}</p>
                    )}
                  </div>
                  {profile.bio && (
                    <p className="text-white/90 text-sm mt-2 max-w-md">
                      {profile.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Share Manager */}
          <ProfileShareManager
            profile={profile}
            currentUserId={user.id}
            isOwner={isCommunityOwner}
          />
        </div>
      </div>
    </div>
  );
}
