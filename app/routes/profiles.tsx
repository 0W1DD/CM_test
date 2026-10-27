import { Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import { ProfileCardSkeleton } from "~/components/skeletons/ProfileCardSkeleton";
import { useCommunityProfilesQuery } from "~/hooks/useCommunityProfiles";
import { errorMessage } from "~/lib/naru";

export function meta() {
  return [
    { title: "멤버 목록 - 커뮤" },
    { name: "description", content: "커뮤 멤버들을 확인하세요" },
  ];
}

export default function Profiles() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, error } = useCommunityProfilesQuery();

  const allProfiles = Array.isArray(data) ? data : [];

  // Filter profiles based on search query
  const filteredProfiles = allProfiles.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.bio?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="이름이나 사용자명으로 검색..."
                disabled
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl opacity-50"
              />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
            {Array.from({ length: 8 }, () => (
              <ProfileCardSkeleton key={crypto.randomUUID()} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {errorMessage(error, "멤버 목록을 불러오는 데 실패했습니다")}
          </h1>
          <Link
            to="/"
            className="text-primary hover:text-primary/90 font-medium"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="이름이나 사용자명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Profiles Grid */}
        {filteredProfiles.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-marsh border border-border p-12 text-center">
            {searchQuery ? (
              <>
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  검색 결과가 없습니다
                </h3>
                <p className="text-muted-foreground mb-4">
                  "{searchQuery}"와 일치하는 멤버를 찾을 수 없습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-primary hover:text-primary/90 font-medium"
                >
                  모든 멤버 보기
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  아직 멤버가 없습니다
                </h3>
                <p className="text-muted-foreground">
                  첫 번째 멤버가 되어보세요!
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
            {filteredProfiles.map((profile) => (
              <Link
                key={profile.id}
                to={`/@${profile.username}`}
                className="flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors group"
              >
                <ProfileAvatar
                  profilePictureUrl={profile.profile_picture_url || undefined}
                  name={profile.name}
                  username={profile.username}
                  profileId={profile.id}
                  size="md"
                  showOnlineStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {profile.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{profile.username}
                    {profile.bio ? ` · ${profile.bio}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 hidden md:inline">
                  {new Date(profile.created_at).toLocaleDateString("ko-KR")}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Results count */}
        {searchQuery && filteredProfiles.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              "{searchQuery}" 검색 결과: {filteredProfiles.length}명
            </p>
          </div>
        )}

        {/* Total profiles count */}
        {!searchQuery && allProfiles.length > 0 && (
          <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
            <p className="text-muted-foreground text-sm">
              총 {allProfiles.length}명의 멤버
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
