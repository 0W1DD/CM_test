import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, LogOut, UserMinus } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { errorMessage, mutate, query } from "~/lib/naru";

/** A block, named by the profile it was made from (`blocks:list`). */
interface BlockedUser {
  id: string;
  login_name: string;
  name: string;
  profile_picture_url: string | null;
  blocked_at: string;
}

const BLOCKED_USERS_KEY = ["blocked-users"] as const;

export default function AccountSettings() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: blockedUsers, isLoading: blocksLoading } = useQuery({
    queryKey: BLOCKED_USERS_KEY,
    queryFn: () => query<BlockedUser[]>("blocks:list"),
    enabled: !!user,
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => mutate("blocks:delete", { id }),
    onSuccess: () => {
      toast.success("사용자 차단이 해제되었습니다");
      queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_KEY });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "차단 해제에 실패했습니다"));
    },
  });

  const handleSignOut = async () => {
    try {
      await logout();
      // Navigate to home page after logout
      window.location.href = "/";
    } catch {
      toast.error("로그아웃에 실패했습니다");
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
            <div className="bg-muted px-6 py-8">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">계정</h2>
                  <p className="text-muted-foreground">계정 관리</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Naru account */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Naru 계정
                </h4>
                <p className="text-sm text-muted-foreground">
                  이 커뮤에는 Naru 계정으로 로그인합니다. 이메일, 비밀번호와
                  계정 삭제는 Naru에서 관리해요.
                </p>
              </div>

              {/* Blocked users */}
              <div className="space-y-3 border-t border-border pt-6">
                <h4 className="text-sm font-semibold text-foreground">
                  차단한 사용자
                </h4>
                <p className="text-sm text-muted-foreground">
                  차단한 사용자의 게시글과 댓글은 게시판에서 보이지 않습니다.
                </p>
                {blocksLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4" />
                    차단한 사용자를 불러오는 중...
                  </div>
                ) : !blockedUsers?.length ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <UserMinus className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">차단한 사용자가 없습니다</p>
                    <p className="text-sm mt-1">
                      사용자 프로필에서 차단할 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((blocked) => (
                      <div
                        key={blocked.id}
                        className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProfileAvatar
                            profilePictureUrl={
                              blocked.profile_picture_url || undefined
                            }
                            name={blocked.name || blocked.login_name}
                            username={blocked.login_name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {blocked.name || blocked.login_name}
                              {blocked.login_name && (
                                <span className="ml-1 text-sm font-normal text-muted-foreground">
                                  @{blocked.login_name}
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(
                                new Date(blocked.blocked_at),
                                "yyyy년 MM월 dd일",
                                { locale: ko },
                              )}
                              에 차단
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unblockMutation.mutate(blocked.id)}
                          disabled={unblockMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          차단 해제
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sign Out Section */}
              <div className="space-y-3 border-t border-border pt-6">
                <h4 className="text-sm font-semibold text-foreground">
                  로그아웃
                </h4>
                <p className="text-sm text-muted-foreground">
                  현재 세션에서 로그아웃합니다.
                </p>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full h-12 text-base font-medium border-destructive text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
