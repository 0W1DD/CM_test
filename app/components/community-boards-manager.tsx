// The community's boards for the owner to add, edit and delete (commung's
// console CommunityBoardsManager).
import { Edit2, LayoutList, Plus, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
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
import { Checkbox } from "~/components/community-admin-kit";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { errorMessage, mutate, query } from "~/lib/naru";

interface CommunityBoard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allow_comments: boolean;
  created_at: string;
  updated_at: string;
}

export function CommunityBoardsManager() {
  const newNameId = useId();
  const newSlugId = useId();
  const newDescriptionId = useId();
  const newAllowCommentsId = useId();
  const [boards, setBoards] = useState<CommunityBoard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBoard, setNewBoard] = useState({
    name: "",
    slug: "",
    description: "",
    allow_comments: true,
  });
  const [editBoard, setEditBoard] = useState({
    name: "",
    slug: "",
    description: "",
    allow_comments: true,
  });

  const fetchBoards = useCallback(async () => {
    try {
      setBoards(await query<CommunityBoard[]>("boards:adminList"));
    } catch (error) {
      console.error("Failed to fetch boards:", error);
      toast.error("게시판을 불러오는 데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const createBoard = async () => {
    if (!newBoard.name.trim() || !newBoard.slug.trim()) {
      toast.error("이름과 슬러그를 모두 입력해주세요");
      return;
    }

    try {
      const createdBoard = await mutate<CommunityBoard>("boards:adminCreate", {
        name: newBoard.name,
        slug: newBoard.slug,
        description: newBoard.description || null,
        allow_comments: newBoard.allow_comments,
      });
      setBoards([...boards, createdBoard]);
      setNewBoard({
        name: "",
        slug: "",
        description: "",
        allow_comments: true,
      });
      setIsCreating(false);
      toast.success("게시판이 추가되었습니다");
    } catch (error) {
      console.error("Failed to create board:", error);
      toast.error(errorMessage(error, "게시판 추가에 실패했습니다"));
    }
  };

  const updateBoard = async (boardId: string) => {
    if (!editBoard.name.trim() || !editBoard.slug.trim()) {
      toast.error("이름과 슬러그를 모두 입력해주세요");
      return;
    }

    try {
      const updatedBoard = await mutate<CommunityBoard>("boards:adminUpdate", {
        board_id: boardId,
        name: editBoard.name,
        slug: editBoard.slug,
        description: editBoard.description || null,
        allow_comments: editBoard.allow_comments,
      });
      setBoards(
        boards.map((board) => (board.id === boardId ? updatedBoard : board)),
      );
      setEditingId(null);
      toast.success("게시판이 수정되었습니다");
    } catch (error) {
      console.error("Failed to update board:", error);
      toast.error(errorMessage(error, "게시판 수정에 실패했습니다"));
    }
  };

  const deleteBoard = async (boardId: string) => {
    try {
      await mutate("boards:adminDelete", { board_id: boardId });
      setBoards(boards.filter((board) => board.id !== boardId));
      toast.success("게시판이 삭제되었습니다");
    } catch (error) {
      console.error("Failed to delete board:", error);
      toast.error(errorMessage(error, "게시판 삭제에 실패했습니다"));
    }
  };

  const startEdit = (board: CommunityBoard) => {
    setEditingId(board.id);
    setEditBoard({
      name: board.name,
      slug: board.slug,
      description: board.description || "",
      allow_comments: board.allow_comments,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBoard({
      name: "",
      slug: "",
      description: "",
      allow_comments: true,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutList className="h-5 w-5" />
            게시판
          </CardTitle>
          <CardDescription>
            커뮤 멤버들이 사용할 게시판을 관리하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" />
              게시판
            </CardTitle>
            <CardDescription>
              커뮤 멤버들이 사용할 게시판을 관리하세요
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreating(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            게시판 추가
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Create form */}
        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">새 게시판 추가</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={newNameId}>게시판 이름</Label>
                <Input
                  id={newNameId}
                  type="text"
                  placeholder="게시판 이름 (예: 자유게시판)"
                  value={newBoard.name}
                  onChange={(e) =>
                    setNewBoard({ ...newBoard, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={newSlugId}>슬러그</Label>
                <Input
                  id={newSlugId}
                  type="text"
                  placeholder="슬러그 (예: free)"
                  value={newBoard.slug}
                  onChange={(e) =>
                    setNewBoard({
                      ...newBoard,
                      slug: e.target.value.toLowerCase(),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  영문 소문자, 숫자, 하이픈만 사용 가능합니다
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={newDescriptionId}>설명 (선택)</Label>
                <Textarea
                  id={newDescriptionId}
                  placeholder="게시판 설명"
                  value={newBoard.description}
                  onChange={(e) =>
                    setNewBoard({ ...newBoard, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={newAllowCommentsId}
                  checked={newBoard.allow_comments}
                  onCheckedChange={(checked) =>
                    setNewBoard({ ...newBoard, allow_comments: checked })
                  }
                />
                <Label htmlFor={newAllowCommentsId}>댓글 허용</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={createBoard} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  저장
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewBoard({
                      name: "",
                      slug: "",
                      description: "",
                      allow_comments: true,
                    });
                  }}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Boards list */}
        {boards.length === 0 && !isCreating ? (
          <div className="text-center py-8">
            <LayoutList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h4 className="text-lg font-medium text-foreground mb-2">
              아직 게시판이 없습니다
            </h4>
            <p className="text-muted-foreground mb-4">
              첫 번째 게시판을 추가해보세요
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              게시판 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {boards.map((board) => (
              <Card key={board.id}>
                <CardContent className="p-4">
                  {editingId === board.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-name-${board.id}`}>
                          게시판 이름
                        </Label>
                        <Input
                          id={`edit-name-${board.id}`}
                          type="text"
                          value={editBoard.name}
                          onChange={(e) =>
                            setEditBoard({ ...editBoard, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-slug-${board.id}`}>슬러그</Label>
                        <Input
                          id={`edit-slug-${board.id}`}
                          type="text"
                          value={editBoard.slug}
                          onChange={(e) =>
                            setEditBoard({
                              ...editBoard,
                              slug: e.target.value.toLowerCase(),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-description-${board.id}`}>
                          설명
                        </Label>
                        <Textarea
                          id={`edit-description-${board.id}`}
                          value={editBoard.description}
                          onChange={(e) =>
                            setEditBoard({
                              ...editBoard,
                              description: e.target.value,
                            })
                          }
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-allow-comments-${board.id}`}
                          checked={editBoard.allow_comments}
                          onCheckedChange={(checked) =>
                            setEditBoard({
                              ...editBoard,
                              allow_comments: checked,
                            })
                          }
                        />
                        <Label htmlFor={`edit-allow-comments-${board.id}`}>
                          댓글 허용
                        </Label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateBoard(board.id)}
                          className="flex-1"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </Button>
                        <Button
                          variant="outline"
                          onClick={cancelEdit}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{board.name}</span>
                          <span className="text-sm text-muted-foreground">
                            /{board.slug}
                          </span>
                          {!board.allow_comments && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              댓글 비허용
                            </span>
                          )}
                        </div>
                        {board.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {board.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          생성일:{" "}
                          {new Date(board.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(board)}
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
                              <DialogTitle>게시판 삭제</DialogTitle>
                              <DialogDescription>
                                "{board.name}" 게시판을 삭제하시겠습니까? 게시판
                                내의 모든 게시글도 함께 삭제됩니다. 이 작업은
                                되돌릴 수 없습니다.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">취소</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  onClick={() => deleteBoard(board.id)}
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
