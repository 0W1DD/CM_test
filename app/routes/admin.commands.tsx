// The built-in slash commands, which the owner turns on and off (commung's
// console apps page, without the installing).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Power, SquareSlash } from "lucide-react";
import { toast } from "sonner";
import { AdminGate, BackToAdmin, PageHeader } from "~/components/admin/ui";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "명령어 관리" },
    { name: "description", content: "슬래시 명령어를 켜고 끌 수 있습니다" },
  ];
}

interface CommandSetting {
  name: string;
  description: string;
  enabled: boolean;
}

const COMMANDS_KEY = ["command-settings"] as const;

function CommandRow({ command }: { command: CommandSetting }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () =>
      mutate("commands:setEnabled", {
        name: command.name,
        enabled: !command.enabled,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMMANDS_KEY }),
    onError: (error) =>
      toast.error(errorMessage(error, "명령어 수정에 실패했습니다")),
  });

  return (
    <div className="flex items-center gap-2 py-2 border-b last:border-b-0">
      <Power
        className={`h-4 w-4 shrink-0 ${
          command.enabled ? "text-green-600" : "text-muted-foreground"
        }`}
      />
      <span className="font-mono">/{command.name}</span>
      <span className="text-xs text-muted-foreground flex-1 truncate ml-2">
        {command.description}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        title={command.enabled ? "끄기" : "켜기"}
      >
        {command.enabled ? "사용 중" : "사용 안 함"}
      </Button>
    </div>
  );
}

function CommandsManager() {
  const { data, isLoading, error } = useQuery({
    queryKey: COMMANDS_KEY,
    queryFn: () => query<CommandSetting[]>("commands:settings"),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data)
    return (
      <div className="text-destructive text-center">
        {errorMessage(error, "명령어를 불러올 수 없습니다")}
      </div>
    );
  return (
    <div>
      {data.map((command) => (
        <CommandRow key={command.name} command={command} />
      ))}
    </div>
  );
}

export default function CommandsPage() {
  return (
    <AdminGate need="owner">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={SquareSlash}
          title="명령어"
          description="끈 명령어는 추천과 /help에서 빠지고, 입력해도 일반 글로 올라가요"
          tone="butter"
        />
        <Card>
          <CardContent className="pt-6">
            <CommandsManager />
          </CardContent>
        </Card>
      </div>
    </AdminGate>
  );
}
