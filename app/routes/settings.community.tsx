import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Palette, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { SESSION_KEY, type Session } from "~/hooks/useSession";
import { errorMessage, mutate } from "~/lib/naru";

const DEFAULT_PICKER = "#6b7fb8";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function CommunitySettings() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    isOwner,
    isLoading: instanceLoading,
    themeKeyColor,
  } = useCurrentInstance();
  const queryClient = useQueryClient();
  const hexInputId = useId();
  const pickerInputId = useId();

  const [pickerValue, setPickerValue] = useState(DEFAULT_PICKER);
  const [hexValue, setHexValue] = useState("");
  const [hexError, setHexError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const savedColorRef = useRef<string | null>(null);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (instanceLoading) return;
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    savedColorRef.current = themeKeyColor;
    if (themeKeyColor) {
      setPickerValue(themeKeyColor);
      setHexValue(themeKeyColor);
    } else {
      setPickerValue(DEFAULT_PICKER);
      setHexValue("");
    }
  }, [instanceLoading, themeKeyColor]);

  // The theme injector reads the color from the session (members) or the
  // public instance, so a preview writes it there until saved or reset.
  const updateCacheThemeColor = (next: string | null) => {
    queryClient.setQueryData<Session | null>(SESSION_KEY, (prev) =>
      prev
        ? { ...prev, instance: { ...prev.instance, theme_key_color: next } }
        : prev,
    );
  };

  useEffect(() => {
    return () => {
      if (!hasHydratedRef.current) return;
      const saved = savedColorRef.current;
      queryClient.setQueryData<Session | null>(SESSION_KEY, (prev) =>
        prev
          ? { ...prev, instance: { ...prev.instance, theme_key_color: saved } }
          : prev,
      );
    };
  }, [queryClient]);

  const handlePickerChange = (value: string) => {
    const normalized = value.toLowerCase();
    setPickerValue(normalized);
    setHexValue(normalized);
    setHexError("");
    updateCacheThemeColor(normalized);
  };

  const handleHexChange = (value: string) => {
    const trimmed = value.trim();
    setHexValue(trimmed);
    if (!trimmed) {
      setHexError("");
      return;
    }
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (HEX_RE.test(normalized)) {
      setHexError("");
      setPickerValue(normalized.toLowerCase());
      updateCacheThemeColor(normalized.toLowerCase());
    } else {
      setHexError("유효한 #RRGGBB 형식의 색상 코드를 입력하세요");
    }
  };

  const handleSave = async () => {
    const normalized = hexValue.startsWith("#") ? hexValue : `#${hexValue}`;
    if (!HEX_RE.test(normalized)) {
      setHexError("유효한 #RRGGBB 형식의 색상 코드를 입력하세요");
      return;
    }
    const lower = normalized.toLowerCase();
    setIsSaving(true);
    try {
      await mutate("community:setTheme", { theme_key_color: lower });
      savedColorRef.current = lower;
      updateCacheThemeColor(lower);
      queryClient.invalidateQueries({ queryKey: ["instance"] });
      toast.success("테마 색상이 저장되었습니다");
    } catch (error) {
      toast.error(errorMessage(error, "테마 색상 저장에 실패했습니다"));
      updateCacheThemeColor(savedColorRef.current);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await mutate("community:setTheme", { theme_key_color: null });
      savedColorRef.current = null;
      setPickerValue(DEFAULT_PICKER);
      setHexValue("");
      updateCacheThemeColor(null);
      queryClient.invalidateQueries({ queryKey: ["instance"] });
      toast.success("사용자 지정 색상이 제거되었습니다");
    } catch (error) {
      toast.error(errorMessage(error, "색상 제거에 실패했습니다"));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleReset = () => {
    const saved = savedColorRef.current;
    if (saved) {
      setPickerValue(saved);
      setHexValue(saved);
    } else {
      setPickerValue(DEFAULT_PICKER);
      setHexValue("");
    }
    setHexError("");
    updateCacheThemeColor(saved);
  };

  if (authLoading || instanceLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-64">
            <div className="flex items-center gap-3">
              <Spinner className="h-6 w-6" />
              <span className="text-muted-foreground">로딩 중...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              접근 제한
            </h1>
            <p className="text-muted-foreground">
              커뮤 소유자만 이 설정에 접근할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const savedColor = savedColorRef.current;
  const normalizedHex = hexValue.startsWith("#") ? hexValue : `#${hexValue}`;
  const hasPendingChange =
    hexValue !== "" &&
    HEX_RE.test(normalizedHex) &&
    normalizedHex.toLowerCase() !== (savedColor ?? "").toLowerCase();
  const canReset =
    hexValue !== (savedColor ?? "") ||
    pickerValue !== (savedColor ?? DEFAULT_PICKER);

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>설정으로 돌아가기</span>
          </Link>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-8 bg-primary/10">
              <div className="flex items-center gap-3">
                <Palette className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    커뮤 테마 색상
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    이 색상으로부터 전체 팔레트가 자동으로 생성됩니다
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label
                  htmlFor={pickerInputId}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  기본 색상
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id={pickerInputId}
                    type="color"
                    value={pickerValue}
                    onChange={(e) => handlePickerChange(e.target.value)}
                    className="h-12 w-16 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                  />
                  <Input
                    id={hexInputId}
                    type="text"
                    value={hexValue}
                    onChange={(e) => handleHexChange(e.target.value)}
                    placeholder="#RRGGBB"
                    className={`h-12 w-40 font-mono text-base ${
                      hexError
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : ""
                    }`}
                  />
                </div>
                {hexError && (
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {hexError}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  색상을 변경하면 실시간으로 미리보기가 적용됩니다. 저장 전에는
                  서버에 반영되지 않습니다.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={!hasPendingChange || isSaving || isRemoving}
                  className="flex-1 h-12 text-base font-medium"
                >
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      저장 중...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      색상 저장
                    </div>
                  )}
                </Button>

                {canReset && (
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isSaving || isRemoving}
                    className="flex-1 sm:flex-none h-12 text-base font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      재설정
                    </div>
                  </Button>
                )}
              </div>

              {savedColor && (
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={handleRemove}
                    disabled={isSaving || isRemoving}
                    className="h-12 text-base font-medium text-destructive hover:text-destructive"
                  >
                    {isRemoving ? (
                      <div className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        제거 중...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        사용자 지정 색상 제거
                      </div>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    제거하면 앱 기본 색상으로 돌아갑니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
