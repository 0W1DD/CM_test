import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Camera,
  ChevronLeft,
  Eye,
  EyeOff,
  FileText,
  RotateCcw,
  Save,
  Upload,
  User,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { SESSION_KEY } from "~/hooks/useSession";
import { errorMessage, mutate } from "~/lib/naru";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_FILE_SIZE,
  uploadImage,
} from "~/lib/upload-image";
import { getGradientForUser } from "~/lib/gradient-utils";

import type { Profile } from "~/types/profile";

export default function ProfileSettings() {
  const { user, isLoading: authLoading, currentProfile } = useAuth();
  const queryClient = useQueryClient();

  // Generate unique IDs for form elements
  const profileNameId = useId();
  const profileUsernameId = useId();
  const profileBioId = useId();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newBio, setNewBio] = useState("");
  const [onlineStatusVisible, setOnlineStatusVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] =
    useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState<
    string | null
  >(null);
  const [usernameError, setUsernameError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username validation function
  const validateUsername = useCallback(
    (username: string | undefined): string => {
      if (!username) {
        return "사용자명을 입력해주세요";
      }
      const trimmed = username.trim();

      if (!trimmed) {
        return "사용자명을 입력해주세요";
      }

      if (trimmed.length > 50) {
        return "사용자명은 50자를 초과할 수 없습니다";
      }

      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return "사용자명은 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다";
      }

      return "";
    },
    [],
  );

  useEffect(() => {
    if (!authLoading && currentProfile) {
      setProfile(currentProfile);
      setNewName(currentProfile.name || "");
      setNewUsername(currentProfile.username || "");
      setNewBio(currentProfile.bio || "");
      setOnlineStatusVisible(currentProfile.online_status_visible ?? true);
      setProfilePicturePreview(currentProfile.profile_picture_url || null);
      // Validate initial username
      const error = validateUsername(currentProfile.username);
      setUsernameError(error);
      setIsLoading(false);
    }
  }, [currentProfile, authLoading, validateUsername]);

  // Handle username change with validation
  const handleUsernameChange = (value: string) => {
    setNewUsername(value);
    const error = validateUsername(value);
    setUsernameError(error);
  };

  const handleProfilePictureChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      toast.error("이미지 크기는 25MB 이하여야 합니다");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setProfilePicturePreview(result);
      }
    };
    reader.readAsDataURL(file);

    // Upload image
    setIsUploadingProfilePicture(true);
    try {
      if (!currentProfile) {
        throw new Error("No current profile");
      }

      // Upload to Naru Media, then make it the profile's picture.
      const image = await uploadImage(file);
      const uploadData = await mutate<{ url: string }>("profiles:setPicture", {
        profile_id: currentProfile.id,
        image_id: image.id,
      });
      // The profile picture is now set directly
      setProfilePicturePreview(uploadData.url);
      setProfile((prev) =>
        prev ? { ...prev, profile_picture_url: uploadData.url } : prev,
      );
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success("프로필 사진이 업로드되었습니다");
    } catch (error) {
      toast.error(errorMessage(error, "프로필 사진 업로드에 실패했습니다"));
      setProfilePicturePreview(profile?.profile_picture_url || null);
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !newName.trim() || !newUsername.trim() || !currentProfile)
      return;

    setIsSaving(true);
    try {
      const updatedProfile = await mutate<Profile>("profiles:update", {
        profile_id: currentProfile.id,
        name: newName.trim(),
        username: newUsername.trim(),
        bio: newBio.trim() || null,
      });
      // Merge with existing profile to preserve missing properties
      const fullUpdatedProfile = { ...profile, ...updatedProfile };
      setProfile(fullUpdatedProfile);
      setProfilePicturePreview(updatedProfile.profile_picture_url || null);

      // The session holds the member's profiles.
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });

      toast.success("프로필이 성공적으로 업데이트되었습니다!");
    } catch (error) {
      toast.error(errorMessage(error, "프로필 업데이트에 실패했습니다"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (profile) {
      setNewName(profile.name || "");
      setNewUsername(profile.username || "");
      setNewBio(profile.bio || "");
      setOnlineStatusVisible(profile.online_status_visible ?? true);
      setProfilePicturePreview(profile.profile_picture_url || null);
      setUsernameError(""); // Clear username validation error
    }
  };

  const handleOnlineStatusToggle = async (visible: boolean) => {
    if (!currentProfile) return;

    setOnlineStatusVisible(visible);

    try {
      await mutate("profiles:updateOnlineStatusSettings", {
        profile_id: currentProfile.id,
        visible,
      });
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success(
        visible ? "온라인 상태가 표시됩니다" : "온라인 상태가 숨겨집니다",
      );
    } catch {
      // Revert on error
      setOnlineStatusVisible(!visible);
      toast.error("온라인 상태 설정 변경에 실패했습니다");
    }
  };

  if (authLoading || isLoading) {
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-3">오류</h1>
            <p className="text-muted-foreground">
              사용자 정보를 불러오는 데 실패했습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasChanges =
    newName.trim() !== (profile?.name || "") ||
    newUsername.trim() !== (profile?.username || "") ||
    newBio.trim() !== (profile?.bio || "") ||
    profilePicturePreview !== (profile?.profile_picture_url || null);

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
            {/* Profile Header */}
            <div
              className={`bg-gradient-to-r ${
                profile
                  ? getGradientForUser(profile.username, profile.name)
                  : "from-[var(--blossom)] to-[var(--lilac)]"
              } px-6 py-8`}
            >
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  profilePictureUrl={profilePicturePreview || undefined}
                  name={profile?.name || "사용자"}
                  username={profile?.username}
                  size="xl"
                  className="bg-white/20 backdrop-blur"
                />
                <div className="text-white">
                  <h2 className="text-xl font-bold">프로필 설정</h2>
                  <p className="text-white/90">
                    커뮤에서 표시될 정보를 수정하세요
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Profile Picture */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  프로필 사진
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <ProfileAvatar
                      profilePictureUrl={profilePicturePreview || undefined}
                      name={profile?.name || "사용자"}
                      username={profile?.username}
                      size="xl"
                      className="border-2 border-border"
                    />
                    {isUploadingProfilePicture && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <Spinner className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingProfilePicture || isSaving}
                      className="text-sm"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      사진 업로드
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, GIF, WebP (최대 25MB)
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-3">
                <label
                  htmlFor={profileNameId}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  표시 이름
                </label>
                <Input
                  id={profileNameId}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="표시 이름을 입력하세요"
                  className="w-full h-12 text-base"
                />
                <p className="text-sm text-muted-foreground">
                  게시물에 표시될 이름입니다. 실명이나 닉네임을 사용할 수
                  있습니다.
                </p>
              </div>

              {/* Username */}
              <div className="space-y-3">
                <label
                  htmlFor={profileUsernameId}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  사용자명
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground text-base">@</span>
                  </div>
                  <Input
                    id={profileUsernameId}
                    type="text"
                    value={newUsername}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="사용자명을 입력하세요"
                    className={`w-full h-12 pl-8 text-base ${
                      usernameError
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : ""
                    }`}
                  />
                </div>
                {usernameError && (
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {usernameError}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  멘션(@)과 함께 사용되는 고유한 식별자입니다. 영문, 숫자,
                  언더스코어만 사용 가능합니다.
                </p>
              </div>

              {/* Bio */}
              <div className="space-y-3">
                <label
                  htmlFor={profileBioId}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  소개
                </label>
                <Textarea
                  id={profileBioId}
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="자신을 소개해보세요..."
                  className="w-full min-h-[100px] text-base resize-none"
                  maxLength={500}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>자신을 간단히 소개해보세요.</span>
                  <span
                    className={newBio.length > 450 ? "text-destructive" : ""}
                  >
                    {newBio.length}/500
                  </span>
                </div>
              </div>

              {/* Online Status Visibility */}
              {/* <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {onlineStatusVisible ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  온라인 상태
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      온라인 상태 표시
                    </p>
                    <p className="text-sm text-muted-foreground">
                      다른 사용자에게 내 온라인 상태를 표시합니다
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onlineStatusVisible}
                    onClick={() =>
                      handleOnlineStatusToggle(!onlineStatusVisible)
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      onlineStatusVisible ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        onlineStatusVisible ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div> */}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={
                    !hasChanges ||
                    isSaving ||
                    !newName.trim() ||
                    !newUsername.trim() ||
                    !!usernameError
                  }
                  className="flex-1 h-12 text-base font-medium"
                >
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      저장 중...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      변경사항 저장
                    </div>
                  )}
                </Button>

                {hasChanges && (
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isSaving}
                    className="flex-1 sm:flex-none h-12 text-base font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      재설정
                    </div>
                  </Button>
                )}
              </div>

              {/* Current Values Display */}
              {profile && (
                <div className="bg-background rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium text-foreground">
                    현재 정보
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div className="flex items-center gap-2">
                      <Camera className="h-3 w-3" />
                      <span>프로필 사진:</span>
                      <div className="flex items-center gap-2">
                        {profile.profile_picture_url ? (
                          <>
                            <img
                              src={profile.profile_picture_url}
                              alt="현재 프로필 사진"
                              className="w-6 h-6 rounded-full object-cover border"
                            />
                            <span className="text-mint-ink font-medium">
                              설정됨
                            </span>
                          </>
                        ) : (
                          <>
                            <ProfileAvatar
                              profilePictureUrl={undefined}
                              name={profile.name}
                              username={profile.username}
                              size="sm"
                              className="bg-muted"
                            />
                            <span className="text-muted-foreground">
                              설정되지 않음
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>
                        표시 이름: <strong>{profile.name}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AtSign className="h-3 w-3" />
                      <span>
                        사용자명: <strong>@{profile.username}</strong>
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <FileText className="h-3 w-3 mt-0.5" />
                      <span>
                        소개: <strong>{profile.bio || "설정되지 않음"}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
