import { ArrowLeft, Megaphone } from "lucide-react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PostCard } from "~/components/post-card";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { query } from "~/lib/naru";
import type { Post } from "~/types/post";

export default function Announcements() {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const currentProfileId = currentProfile?.id;

  const {
    data: announcements = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["announcements", currentProfileId],
    queryFn: async () => {
      return query<Post[]>("posts:announcements", {
        ...(currentProfileId && { profile_id: currentProfileId }),
      });
    },
  });

  const handleAnnouncementDelete = () => {
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  return (
    <div>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-64">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              {error.message}
            </h1>
            <Link
              to="/"
              className="text-primary hover:text-primary/90 font-medium"
            >
              홈으로 돌아가기
            </Link>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              아직 공지사항이 없습니다
            </h3>
            <p className="text-muted-foreground mb-4">
              커뮤 운영자가 공지사항을 게시하면 여기에 표시됩니다.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/90 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map((announcement) => (
              <PostCard
                key={announcement.id}
                post={announcement}
                currentProfileId={currentProfileId}
                onDelete={handleAnnouncementDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
