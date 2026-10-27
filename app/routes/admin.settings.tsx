// The community's settings (commung's console settings page and community
// form). Its slug, custom domain and deletion are the Naru site's own: the
// site's name, Naru's custom domains and the site's control panel.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { CommunitySettings } from "~/components/admin/types";
import { SettingsForm } from "~/components/admin/settings-form";
import { AdminGate, BackToAdmin, PageHeader } from "~/components/admin/ui";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { SESSION_KEY } from "~/hooks/useSession";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "커뮤 설정" },
    { name: "description", content: "커뮤 정보와 운영 옵션을 조정해요" },
  ];
}

const SETTINGS_KEY = ["community-settings"] as const;

function SettingsCard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => query<CommunitySettings>("community:settings"),
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (data) setVersion((v) => v + 1);
  }, [data]);

  if (isLoading)
    return <LoadingState message="설정을 불러오는 중..." asCard={false} />;
  if (error || !data)
    return (
      <div className="text-destructive text-center">
        {errorMessage(error, "설정을 불러올 수 없습니다")}
      </div>
    );
  return (
    <SettingsForm
      key={version}
      initial={data}
      submitLabel="커뮤 수정"
      onSubmit={async (body) => {
        const updated = await mutate<CommunitySettings>(
          "community:update",
          body,
        );
        queryClient.setQueryData(SETTINGS_KEY, updated);
        queryClient.invalidateQueries({ queryKey: SESSION_KEY });
        queryClient.invalidateQueries({ queryKey: ["instance"] });
        toast.success("커뮤가 성공적으로 수정되었습니다");
      }}
    />
  );
}

export default function CommunitySettingsPage() {
  return (
    <AdminGate need="owner">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <BackToAdmin />
        <PageHeader
          eyebrow="설정"
          icon={Settings}
          title="커뮤 설정"
          description="커뮤 정보와 운영 옵션을 조정해요"
          tone="lilac"
          actions={
            <Link to="/settings/community">
              <Button variant="outline" size="sm">
                <Palette className="h-4 w-4" />
                테마 색상
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="pt-6">
            <SettingsCard />
          </CardContent>
        </Card>
      </div>
    </AdminGate>
  );
}
