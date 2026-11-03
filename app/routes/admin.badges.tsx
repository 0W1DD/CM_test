// Badges for the staff: make, edit and remove them, and tick who has each.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminGate, BackToAdmin, PageHeader } from "~/components/admin/ui";
import type { Badge } from "~/components/badges";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [{ title: "뱃지 관리" }];
}

interface Admin {
  badges: (Badge & { holders: number })[];
  profiles: {
    id: string;
    name: string;
    username: string;
    badge_ids: string[];
  }[];
}

const EMPTY = { name: "", emoji: "", description: "" };

/** Calls a badge mutation, turning its refusal into a readable error. */
async function call<T>(name: string, args: object, fallback: string) {
  try {
    return await mutate<T>(`badges:${name}`, args);
  } catch (error) {
    throw new Error(errorMessage(error, fallback));
  }
}

function BadgeAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["badges", "admin"],
    queryFn: () => query<Admin>("badges:admin"),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [holders, setHolders] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const badge = data?.badges.find((b) => b.id === selected) ?? null;

  // Picking a badge fills the form and the ticks from what is saved.
  useEffect(() => {
    if (!data) return;
    const b = data.badges.find((x) => x.id === selected);
    setForm(
      b
        ? { name: b.name, emoji: b.emoji, description: b.description ?? "" }
        : EMPTY,
    );
    setHolders(
      new Set(
        b
          ? data.profiles
              .filter((p) => p.badge_ids.includes(b.id))
              .map((p) => p.id)
          : [],
      ),
    );
  }, [data, selected]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["badges"] });
  const onError = (e: Error) => toast.error(e.message);

  const save = useMutation({
    mutationFn: () =>
      selected
        ? call<{ id: string }>(
            "update",
            { badge_id: selected, ...form },
            "뱃지를 저장하지 못했습니다",
          )
        : call<{ id: string }>("create", form, "뱃지를 만들지 못했습니다"),
    onSuccess: (result) => {
      toast.success(selected ? "뱃지를 저장했습니다." : "뱃지를 만들었습니다.");
      setSelected(result.id);
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () =>
      call("remove", { badge_id: selected }, "뱃지를 삭제하지 못했습니다"),
    onSuccess: () => {
      toast.success("뱃지를 삭제했습니다.");
      setSelected(null);
      refresh();
    },
    onError,
  });
  const give = useMutation({
    mutationFn: () =>
      call<{ holders: number }>(
        "setHolders",
        { badge_id: selected, profile_ids: [...holders] },
        "뱃지를 주지 못했습니다",
      ),
    onSuccess: (result) => {
      toast.success(`${result.holders}명이 이 뱃지를 가지고 있습니다.`);
      refresh();
    },
    onError,
  });

  if (isLoading || !data) return <LoadingState />;
  const q = filter.trim().toLowerCase();
  const shown = data.profiles.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q),
  );
  const toggle = (profileId: string) =>
    setHolders((h) => {
      const next = new Set(h);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="framed p-4">
        <div className="flex flex-wrap items-center gap-2">
          {data.badges.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b.id)}
              className={`profile-badge ${selected === b.id ? "ring-2 ring-primary" : ""}`}
            >
              <span aria-hidden>{b.emoji}</span>
              {b.name}
              <span className="text-muted-foreground">· {b.holders}명</span>
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
            + 새 뱃지
          </Button>
        </div>
      </div>

      <div className="framed p-4 space-y-3">
        <p className="text-sm font-semibold">
          {badge ? "뱃지 편집" : "새 뱃지 만들기"}
        </p>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <Input
            placeholder="🎄"
            value={form.emoji}
            maxLength={16}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            aria-label="아이콘(이모지)"
          />
          <Input
            placeholder="뱃지 이름"
            value={form.name}
            maxLength={30}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="뱃지 이름"
          />
        </div>
        <Input
          placeholder="설명 (선택, 뱃지에 마우스를 올리면 보입니다)"
          value={form.description}
          maxLength={200}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          aria-label="설명"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={save.isPending || !form.name.trim() || !form.emoji.trim()}
            onClick={() => save.mutate()}
          >
            {badge ? "저장" : "만들기"}
          </Button>
          {badge && (
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  confirm(
                    `"${badge.name}" 뱃지를 삭제할까요? 가진 사람 모두에게서 사라집니다.`,
                  )
                )
                  remove.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          )}
        </div>
      </div>

      {badge && (
        <div className="framed p-4 space-y-3">
          <p className="text-sm font-semibold">
            {badge.emoji} {badge.name} 줄 사람 ({holders.size}명 선택)
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="이름이나 사용자명으로 찾기"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setHolders(new Set(data.profiles.map((p) => p.id)))
              }
            >
              모두 선택
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHolders(new Set())}
            >
              모두 해제
            </Button>
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-border border border-border">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={holders.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">@{p.username}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            disabled={give.isPending}
            onClick={() => give.mutate()}
          >
            {give.isPending ? "저장하는 중..." : "선택한 사람에게 주기"}
          </Button>
          <p className="text-xs text-muted-foreground">
            체크를 풀고 저장하면 그 사람에게서 뱃지를 뺍니다. 처음 받은 뱃지는
            자동으로 대표 뱃지가 되고, 대표 뱃지는 각자 프로필 페이지에서 바꿀
            수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminBadges() {
  return (
    <AdminGate need="staff">
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-4">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={Award}
          title="뱃지"
          description="뱃지를 만들고, 프로필에 주거나 뺍니다."
          tone="lilac"
        />
        <BadgeAdmin />
      </div>
    </AdminGate>
  );
}
