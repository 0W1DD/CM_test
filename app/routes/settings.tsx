import {
  FileText,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    isModerator,
    isOwner,
    isLoading: instanceLoading,
  } = useCurrentInstance();

  if (authLoading || instanceLoading) {
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

  const allSettingsSections = [
    {
      title: "프로필 설정",
      description: "표시 이름, 사용자명, 소개, 프로필 사진 편집",
      icon: User,
      href: "/settings/profile",
    },
    {
      title: "멀티 프로필 관리",
      description: "여러 프로필을 생성하고 관리",
      icon: Users,
      href: "/settings/profiles",
      requiresModeratorOrOwner: true,
    },
    {
      title: "커뮤 테마 색상",
      description: "커뮤 기본 색상을 선택하여 전체 팔레트를 생성",
      icon: Palette,
      href: "/settings/community",
      requiresOwner: true,
    },
    {
      title: "커뮤 관리",
      description: "가입 신청, 멤버, 커뮤 설정과 운영 도구",
      icon: ShieldCheck,
      href: "/admin",
      requiresModeratorOrOwner: true,
    },
    {
      title: "계정",
      description: "로그아웃",
      icon: FileText,
      href: "/settings/account",
    },
  ];

  // Filter settings based on user role
  const settingsSections = allSettingsSections.filter((section) => {
    if (section.requiresOwner && !isOwner) return false;
    if (section.requiresModeratorOrOwner && !isModerator) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">설정</h1>
            </div>
            <p className="text-muted-foreground">
              계정 및 프로필 설정을 관리하세요
            </p>
          </div>

          {/* Settings Sections Grid */}
          <div className="grid gap-4">
            {settingsSections.map((section) => (
              <Link
                key={section.href}
                to={section.href}
                className="block group"
              >
                <div className="bg-card rounded-2xl shadow-sm border border-border p-6 transition-all hover:shadow-md hover:border-primary/30">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <section.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-muted-foreground ml-16">
                    {section.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
