// Nickname colours (naru/queries/nameColors.ts): the colour a profile's
// name has this week, and the dialog that uses a colour pass. app.css
// draws each colour, a deeper shade on light pages and a paler one on dark.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { errorMessage, mutate, query } from "~/lib/naru";

export const NAME_COLORS = [
  ["red", "루돌프 레드"],
  ["green", "트리 그린"],
  ["gold", "골드"],
  ["blue", "눈꽃 블루"],
  ["pink", "캔디 핑크"],
  ["purple", "와인 퍼플"],
] as const;

type Colors = Record<string, { color: string; until: string }>;

export function useNameColors() {
  return useQuery({
    queryKey: ["name-colors"],
    queryFn: () => query<Colors>("nameColors:all"),
    staleTime: 5 * 60_000,
  });
}

/** The class that colours a profile's name, or "" when it has none. */
export function useNameColorClass(profileId: string) {
  const color = useNameColors().data?.[profileId]?.color;
  return color ? `name-color name-color-${color}` : "";
}

/** Using a colour pass: pick a colour, see it, apply it for a week. */
export function NameColorDialog({
  open,
  onClose,
  profileId,
  itemId,
  name,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  itemId: string;
  name: string;
}) {
  const queryClient = useQueryClient();
  const [color, setColor] = useState<string>("red");
  const apply = useMutation({
    mutationFn: async () => {
      try {
        return await mutate<{ until: string }>("nameColors:apply", {
          profile_id: profileId,
          item_id: itemId,
          color,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "색을 바꾸지 못했습니다"));
      }
    },
    onSuccess: ({ until }) => {
      toast.success(
        `닉네임 색이 바뀌었어요. ${new Date(until).toLocaleDateString("ko-KR")}까지 이어집니다.`,
      );
      queryClient.invalidateQueries({ queryKey: ["name-colors"] });
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>닉네임 색 변경권 사용</DialogTitle>
        <DialogDescription>
          고른 색으로 7일 동안 이름이 바뀌어요. 이미 색이 있으면 새 색으로 다시
          7일이 시작돼요.
        </DialogDescription>
        <div className="flex flex-wrap gap-2">
          {NAME_COLORS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={color === key}
              aria-label={label}
              title={label}
              onClick={() => setColor(key)}
              className={`name-color-swatch name-color-${key} ${color === key ? "is-on" : ""}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border bg-white px-3 py-2">
            <span className={`font-semibold name-color-${color} is-light`}>
              {name}
            </span>
          </div>
          <div className="rounded-md border bg-[#1f242c] px-3 py-2">
            <span className={`font-semibold name-color-${color} is-dark`}>
              {name}
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button disabled={apply.isPending} onClick={() => apply.mutate()}>
            적용하기 (7일)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
