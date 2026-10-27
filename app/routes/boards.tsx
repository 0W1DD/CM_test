import { ArrowLeft, LayoutList, MessageSquare } from "lucide-react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { errorMessage, query } from "~/lib/naru";

interface CommunityBoard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allow_comments: boolean;
  created_at: string;
  updated_at: string;
}

export default function Boards() {
  const { isLoading: authLoading, belongsToCurrentInstance } = useAuth();

  const {
    data: boards = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      try {
        return await query<CommunityBoard[]>("boards:list");
      } catch (error) {
        throw new Error(
          errorMessage(error, "게시판을 불러오는 데 실패했습니다"),
        );
      }
    },
    enabled: belongsToCurrentInstance,
  });

  if (!belongsToCurrentInstance && !authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            커뮤 멤버만 접근할 수 있습니다
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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutList className="h-8 w-8 text-muted-foreground" />
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
      </div>
    );
  }

  return (
    <div>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <LayoutList className="h-6 w-6" />
          게시판
        </h1>

        {authLoading || isLoading ? (
          <div className="flex items-center justify-center min-h-64">
            <Spinner className="h-8 w-8" />
          </div>
        ) : boards.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              아직 게시판이 없습니다
            </h3>
            <p className="text-muted-foreground">
              커뮤 관리자가 게시판을 추가하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/boards/${board.slug}`}
                className="block bg-card rounded-xl shadow-sm border border-border p-5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {board.name}
                    </h3>
                    {board.description && (
                      <p className="text-muted-foreground mt-1">
                        {board.description}
                      </p>
                    )}
                  </div>
                  {board.allow_comments && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
