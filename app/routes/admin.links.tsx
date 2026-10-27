// The community's links (commung's console links page and links manager).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit2,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AdminGate, BackToAdmin, PageHeader } from "~/components/admin/ui";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "링크 관리" },
    { name: "description", content: "커뮤 링크를 관리할 수 있습니다" },
  ];
}

interface CommunityLink {
  id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
}

const LINKS_KEY = ["community-links"] as const;

function LinksManager() {
  const queryClient = useQueryClient();
  const newTitleId = useId();
  const newUrlId = useId();
  const { data: links = [], isLoading } = useQuery({
    queryKey: LINKS_KEY,
    queryFn: () => query<CommunityLink[]>("community:links"),
  });
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [editLink, setEditLink] = useState({ title: "", url: "" });

  const run = async (
    action: () => Promise<unknown>,
    success: string,
    failure: string,
  ) => {
    try {
      await action();
      toast.success(success);
      queryClient.invalidateQueries({ queryKey: LINKS_KEY });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, failure));
      return false;
    }
  };

  const createLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim())
      return toast.error("제목과 URL을 모두 입력해주세요");
    if (
      await run(
        () => mutate("community:createLink", newLink),
        "링크가 추가되었습니다",
        "링크 추가에 실패했습니다",
      )
    ) {
      setNewLink({ title: "", url: "" });
      setIsCreating(false);
    }
  };

  const updateLink = async (linkId: string) => {
    if (!editLink.title.trim() || !editLink.url.trim())
      return toast.error("제목과 URL을 모두 입력해주세요");
    if (
      await run(
        () => mutate("community:updateLink", { link_id: linkId, ...editLink }),
        "링크가 수정되었습니다",
        "링크 수정에 실패했습니다",
      )
    )
      setEditingId(null);
  };

  const header = (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            커뮤 링크
          </CardTitle>
          <CardDescription>
            커뮤에 표시될 유용한 링크를 관리하세요
          </CardDescription>
        </div>
        {!isLoading && (
          <Button onClick={() => setIsCreating(true)} size="sm">
            <Plus className="h-4 w-4" />
            링크 추가
          </Button>
        )}
      </div>
    </CardHeader>
  );

  if (isLoading)
    return (
      <Card>
        {header}
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">새 링크 추가</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={newTitleId}>링크 제목</Label>
                <Input
                  id={newTitleId}
                  placeholder="링크 제목 (예: 공식 웹사이트)"
                  value={newLink.title}
                  onChange={(e) =>
                    setNewLink({ ...newLink, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={newUrlId}>URL</Label>
                <Input
                  id={newUrlId}
                  type="url"
                  placeholder="URL (예: https://example.com)"
                  value={newLink.url}
                  onChange={(e) =>
                    setNewLink({ ...newLink, url: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createLink} className="flex-1">
                  <Save className="h-4 w-4" />
                  저장
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewLink({ title: "", url: "" });
                  }}
                  className="flex-1"
                >
                  <X className="h-4 w-4" />
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {links.length === 0 && !isCreating ? (
          <div className="text-center py-8">
            <LinkIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-foreground mb-2">
              아직 링크가 없습니다
            </h4>
            <p className="text-muted-foreground mb-4">
              첫 번째 커뮤 링크를 추가해보세요
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              링크 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4">
                  {editingId === link.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-title-${link.id}`}>
                          링크 제목
                        </Label>
                        <Input
                          id={`edit-title-${link.id}`}
                          value={editLink.title}
                          onChange={(e) =>
                            setEditLink({ ...editLink, title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-url-${link.id}`}>URL</Label>
                        <Input
                          id={`edit-url-${link.id}`}
                          type="url"
                          value={editLink.url}
                          onChange={(e) =>
                            setEditLink({ ...editLink, url: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateLink(link.id)}
                          className="flex-1"
                        >
                          <Save className="h-4 w-4" />
                          저장
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="flex-1"
                        >
                          <X className="h-4 w-4" />
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          <span>{link.title}</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {link.url}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          생성일:{" "}
                          {new Date(link.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(link.id);
                            setEditLink({ title: link.title, url: link.url });
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>링크 삭제</DialogTitle>
                              <DialogDescription>
                                "{link.title}" 링크를 삭제하시겠습니까? 이
                                작업은 되돌릴 수 없습니다.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">취소</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  onClick={() =>
                                    run(
                                      () =>
                                        mutate("community:deleteLink", {
                                          link_id: link.id,
                                        }),
                                      "링크가 삭제되었습니다",
                                      "링크 삭제에 실패했습니다",
                                    )
                                  }
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  삭제
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CommunityLinks() {
  return (
    <AdminGate need="owner">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={LinkIcon}
          title="커뮤 링크"
          description="유용한 외부 링크를 등록해요"
          tone="lilac"
        />
        <LinksManager />
      </div>
    </AdminGate>
  );
}
