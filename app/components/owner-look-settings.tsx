import { useQueryClient } from "@tanstack/react-query";
import { Code, Save } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { SESSION_KEY, type Session } from "~/hooks/useSession";
import { errorMessage, mutate } from "~/lib/naru";

const MAX_CSS = 50000;

/**
 * The site owner's own look (community:setLook): 사용자 CSS, kept in the
 * database so a template update leaves it, and whether the page loads the
 * site's /_owner/style.css and /_owner/script.js, the folder Naru keeps out
 * of every template and update.
 */
export function OwnerLookSettings() {
  const { customCss, ownerFiles } = useCurrentInstance();
  const queryClient = useQueryClient();
  const cssId = useId();
  const filesId = useId();
  const [css, setCss] = useState(customCss ?? "");
  const [files, setFiles] = useState(ownerFiles);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCss(customCss ?? "");
    setFiles(ownerFiles);
  }, [customCss, ownerFiles]);

  const changed = css !== (customCss ?? "") || files !== ownerFiles;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await mutate<{
        custom_css: string | null;
        owner_files: boolean;
      }>("community:setLook", { custom_css: css, owner_files: files });
      // The page applies it at once (CommunityOwnerLook).
      queryClient.setQueryData<Session | null>(SESSION_KEY, (prev) =>
        prev ? { ...prev, instance: { ...prev.instance, ...saved } } : prev,
      );
      toast.success("저장했습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "저장하지 못했습니다"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mt-6">
      <div className="px-6 py-8 bg-primary/10">
        <div className="flex items-center gap-3">
          <Code className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">
              사이트 주인 CSS
            </h2>
            <p className="text-sm text-muted-foreground">
              템플릿을 업데이트해도 그대로 남는 사이트 주인의 꾸미기
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="space-y-3">
          <label
            htmlFor={cssId}
            className="text-sm font-semibold text-foreground"
          >
            사용자 CSS
          </label>
          <Textarea
            id={cssId}
            value={css}
            onChange={(e) => setCss(e.target.value)}
            maxLength={MAX_CSS}
            rows={10}
            spellCheck={false}
            placeholder=":root { --primary: oklch(0.6 0.15 30); }"
            className="font-mono text-sm"
          />
          <p className="text-sm text-muted-foreground">
            앱과 테마 색상의 CSS 뒤에 들어가, 같은 선택자라면 언제나 이깁니다.
            색은 <code>--primary</code>, <code>--background</code>,{" "}
            <code>--foreground</code> 같은 변수로 바꿀 수 있어요. 최대 5만
            자입니다.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={filesId}
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <input
              id={filesId}
              type="checkbox"
              checked={files}
              onChange={(e) => setFiles(e.target.checked)}
              className="h-4 w-4"
            />
            사이트 주인 파일 불러오기
          </label>
          <p className="text-sm text-muted-foreground">
            사이트의 <code>/_owner/style.css</code>를 사용자 CSS 앞에,{" "}
            <code>/_owner/script.js</code>를 페이지가 준비된 뒤에 불러옵니다.
            템플릿을 업데이트해도 나루가 건드리지 않는 폴더예요. 켠 채로 파일이
            없으면 페이지마다 요청 하나가 404로 끝나니, 파일을 올린 뒤 켜세요.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={!changed || isSaving}
            className="w-full h-12 text-base font-medium"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                저장 중...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                저장
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
