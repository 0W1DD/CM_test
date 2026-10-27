// The owner's board management (commung's console communities.$slug.boards).
import { LayoutList } from "lucide-react";
import {
  AdminGate,
  BackToAdmin,
  PageHeader,
} from "~/components/community-admin-kit";
import { CommunityBoardsManager } from "~/components/community-boards-manager";
import { Card, CardContent } from "~/components/ui/card";

export function meta() {
  return [
    { title: "게시판 관리" },
    { name: "description", content: "커뮤 게시판을 관리할 수 있습니다" },
  ];
}

export default function AdminBoards() {
  return (
    <AdminGate
      allow="owner"
      icon={LayoutList}
      title="게시판 관리"
      denied="게시판 관리 권한이 없습니다. 커뮤 소유자만 게시판을 관리할 수 있습니다."
    >
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-5xl mx-auto">
          <BackToAdmin />
          <PageHeader
            eyebrow="운영"
            icon={LayoutList}
            title="게시판 관리"
            description="커뮤 내 게시판을 만들고 정리해요"
            tone="lilac"
          />
          <Card>
            <CardContent className="pt-6">
              <CommunityBoardsManager />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGate>
  );
}
