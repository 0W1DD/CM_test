import {
  AlertTriangle,
  Calendar,
  Edit3,
  Eye,
  Megaphone,
  Paperclip,
  Save,
  Send,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { useImageUpload } from "~/hooks/useImageUpload";
import { pastedImages } from "~/lib/upload-image";
import { useMarkdownWithMentions } from "~/hooks/useMarkdownWithMentions";
import { query } from "~/lib/naru";
import type { PostImage } from "~/types/post";
import type { Profile } from "~/types/profile";
import { MarkdownHelpModal } from "./markdown-help-modal";
import { ProfileAvatar } from "./profile-avatar";

const MAX_MESSAGE_LENGTH = 500;

interface HashtagSuggestion {
  tag: string;
  count: number;
}

// The date picker (with its calendar) only loads when a post is scheduled,
// so the composer on every page does not carry it.
const DateTimePicker = lazy(() =>
  import("~/components/ui/datetime-picker").then((module) => ({
    default: module.DateTimePicker,
  })),
);

export interface MessageComposerProps {
  mode: "create" | "edit";
  initialContent?: string;
  initialImages?: PostImage[];
  initialContentWarning?: string | null;
  initialAnnouncement?: boolean;
  placeholder?: string;
  onSubmit: (data: {
    content: string;
    image_ids: string[];
    content_warning?: string;
    announcement?: boolean;
    scheduled_at?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  submitButtonText?: string;
  submitButtonIcon?: ReactNode;
  showAnnouncement?: boolean;
  showScheduling?: boolean;
  canBeAnnouncement?: boolean;
  canSchedule?: boolean;
  schedulingConfig?: {
    minDate: Date;
    maxDate?: Date;
  };
}

export function MessageComposer({
  mode,
  initialContent = "",
  initialImages = [],
  initialContentWarning = null,
  initialAnnouncement = false,
  placeholder = "무슨 일이 일어나고 있나요?",
  onSubmit,
  onCancel,
  submitButtonText,
  submitButtonIcon,
  showAnnouncement = false,
  showScheduling = false,
  canBeAnnouncement = false,
  canSchedule = false,
  schedulingConfig,
}: MessageComposerProps) {
  const { currentProfile } = useAuth();

  // Core state
  const [message, setMessage] = useState(initialContent);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Content warning state
  const [hasContentWarning, setHasContentWarning] = useState(
    !!initialContentWarning,
  );
  const [contentWarning, setContentWarning] = useState(
    initialContentWarning || "",
  );

  // Announcement state
  const [isAnnouncement, setIsAnnouncement] = useState(initialAnnouncement);

  // Scheduling state (only for create mode)
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);

  // Image handling
  const {
    images,
    uploadedImageIds,
    isUploadingImages,
    handleImageSelect: handleImageSelectFromHook,
    removeImage: removeImageFromHook,
    clearImages,
    initializeWithExisting,
  } = useImageUpload({ maxImages: 4 });

  // Initialize images for edit mode
  useEffect(() => {
    if (mode === "edit" && initialImages.length > 0) {
      const existingImages = initialImages.map((img) => ({
        id: crypto.randomUUID(),
        file: null,
        preview: img.url,
        uploadedId: img.id,
      }));
      initializeWithExisting(existingImages);
    }
  }, [mode, initialImages, initializeWithExisting]);

  // Mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [mentionProfiles, setMentionProfiles] = useState<Profile[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Slash command autocomplete state
  type SlashCommand = {
    id: string;
    name: string;
    description: string | null;
  };
  const [showSlashDropdown, setShowSlashDropdown] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);
  const [allSlashCommands, setAllSlashCommands] = useState<
    SlashCommand[] | null
  >(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // IME composition state for CJK input
  const compositionDataRef = useRef<string>("");

  // Debounced message for markdown rendering
  const [debouncedMessage, setDebouncedMessage] = useState(message);

  useEffect(() => {
    if (!isPreviewMode) {
      setDebouncedMessage(message);
      return;
    }

    const debounceTimer = setTimeout(() => {
      setDebouncedMessage(message);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [message, isPreviewMode]);

  // Use the markdown hook
  const { md } = useMarkdownWithMentions({
    content: isPreviewMode ? debouncedMessage : message,
    useUsernameValidation: true,
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch profiles for mention autocomplete
  const fetchProfiles = useCallback(async (search: string) => {
    try {
      const result = await query<Profile[]>("profiles:list", {});
      const allProfiles: Profile[] = Array.isArray(result) ? result : [];

      const filteredProfiles = search
        ? allProfiles.filter(
            (profile) =>
              profile.name.toLowerCase().includes(search.toLowerCase()) ||
              profile.username.toLowerCase().includes(search.toLowerCase()),
          )
        : allProfiles;

      setMentionProfiles(filteredProfiles.slice(0, 10));
      setSelectedMentionIndex(0);
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    }
  }, []);

  // Debounce profile fetching
  useEffect(() => {
    if (!showMentionDropdown) return;

    if (mentionQuery === "") {
      fetchProfiles("");
      return;
    }

    const debounceTimer = setTimeout(() => {
      fetchProfiles(mentionQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [mentionQuery, showMentionDropdown, fetchProfiles]);

  // Fetch installed slash commands once when first needed
  const fetchSlashCommands = useCallback(async () => {
    try {
      const result = await query<SlashCommand[]>("commands:list", {});
      const commands: SlashCommand[] = Array.isArray(result) ? result : [];
      setAllSlashCommands(commands);
      return commands;
    } catch (error) {
      console.error("Failed to fetch slash commands:", error);
    }
    setAllSlashCommands([]);
    return [];
  }, []);

  // Filter commands by current query
  useEffect(() => {
    if (!showSlashDropdown || !allSlashCommands) return;
    const q = slashQuery.toLowerCase();
    const filtered = allSlashCommands
      .filter((cmd) => cmd.name.toLowerCase().startsWith(q))
      .slice(0, 8);
    setSlashCommands(filtered);
    setSelectedSlashIndex(0);
  }, [slashQuery, showSlashDropdown, allSlashCommands]);

  // Check for /command at the start of the message, after the "@author "
  // a reply begins with (the site runs it there too)
  const [slashPrefix, setSlashPrefix] = useState("");
  const checkForSlashCommand = (text: string, cursorPosition: number) => {
    const beforeCursor = text.slice(0, cursorPosition);
    const match = beforeCursor.match(/^((?:@[A-Za-z0-9_]+\s+)*)\/([a-z0-9_-]*)$/i);
    if (match) {
      setSlashPrefix(match[1] ?? "");
      setSlashQuery(match[2] ?? "");
      setShowSlashDropdown(true);
      if (allSlashCommands === null) {
        fetchSlashCommands();
      }
    } else {
      setShowSlashDropdown(false);
      setSlashCommands([]);
      setSlashQuery("");
    }
  };

  // Insert selected slash command
  const selectSlashCommand = (cmd: SlashCommand) => {
    const after = message.slice(slashPrefix.length + slashQuery.length + 1);
    const newMessage = `${slashPrefix}/${cmd.name} ${after.trimStart()}`;
    setMessage(newMessage);
    setShowSlashDropdown(false);
    setSlashCommands([]);
    setSlashQuery("");
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPosition = slashPrefix.length + cmd.name.length + 2;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // #tag autocomplete: tags already in use that start with what is typed
  // after a `#`, or the most used ones for a bare `#`.
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagStart, setTagStart] = useState(0);
  const [tagSuggestions, setTagSuggestions] = useState<HashtagSuggestion[]>(
    [],
  );
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);

  useEffect(() => {
    if (!showTagDropdown) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await query<HashtagSuggestion[]>(
          tagQuery ? "search:hashtags" : "search:popularHashtags",
          tagQuery ? { q: tagQuery, limit: 8 } : { limit: 8 },
        );
        if (cancelled) return;
        setTagSuggestions(Array.isArray(result) ? result : []);
        setSelectedTagIndex(0);
      } catch (error) {
        console.error("Failed to fetch hashtags:", error);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tagQuery, showTagDropdown]);

  const closeTagDropdown = () => {
    setShowTagDropdown(false);
    setTagSuggestions([]);
    setTagQuery("");
  };

  const checkForTag = (text: string, cursorPosition: number) => {
    const match = text
      .slice(0, cursorPosition)
      .match(/(^|\s)#([\p{L}\p{N}_]*)$/u);
    if (match) {
      const typed = match[2] ?? "";
      setTagStart(cursorPosition - typed.length - 1);
      setTagQuery(typed);
      setShowTagDropdown(true);
    } else if (showTagDropdown) {
      closeTagDropdown();
    }
  };

  const selectTag = (tag: string) => {
    const before = message.slice(0, tagStart);
    const cursor =
      textareaRef.current?.selectionStart ?? tagStart + 1 + tagQuery.length;
    const after = message
      .slice(Math.max(cursor, tagStart + 1))
      .replace(/^[\p{L}\p{N}_]*/u, "");
    setMessage(`${before}#${tag} ${after.trimStart()}`);
    closeTagDropdown();
    setTimeout(() => {
      textareaRef.current?.focus();
      const position = before.length + tag.length + 2;
      textareaRef.current?.setSelectionRange(position, position);
    }, 0);
  };

  // Check for @ mentions
  const checkForMention = (text: string, cursorPosition: number) => {
    let beforeCursor = text.slice(0, cursorPosition);

    const compositionData = compositionDataRef.current;
    let adjustedCursorPosition = cursorPosition;
    if (compositionData && beforeCursor.endsWith(compositionData)) {
      beforeCursor = beforeCursor.slice(0, -compositionData.length);
      adjustedCursorPosition = cursorPosition - compositionData.length;
    }

    const mentionMatch = beforeCursor.match(/@([^\s@]*)$/);

    if (mentionMatch) {
      const start = beforeCursor.length - mentionMatch[0].length;
      const query = mentionMatch[1] ?? "";

      setMentionPosition({ start, end: adjustedCursorPosition });
      setMentionQuery(query);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
      setMentionProfiles([]);
      setMentionQuery("");
    }
  };

  // Handle mention selection
  const selectMention = (profile: Profile) => {
    const beforeMention = message.slice(0, mentionPosition.start);

    const compositionData = compositionDataRef.current;
    const skipLength = compositionData ? compositionData.length : 0;
    const afterMention = message.slice(mentionPosition.end + skipLength);

    const newMessage = `${beforeMention}@${profile.username} ${afterMention}`;

    setMessage(newMessage);
    setShowMentionDropdown(false);
    setMentionProfiles([]);
    setMentionQuery("");

    compositionDataRef.current = "";

    setTimeout(() => {
      textareaRef.current?.focus();
      const newPosition = mentionPosition.start + profile.username.length + 2;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleImageSelectFromHook(e.target.files);
    }
  };

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && uploadedImageIds.length === 0) || isSubmitting)
      return;

    setIsSubmitting(true);
    try {
      const data: {
        content: string;
        image_ids: string[];
        content_warning?: string;
        announcement?: boolean;
        scheduled_at?: string;
      } = {
        content: trimmedMessage,
        image_ids: uploadedImageIds,
        content_warning: contentWarning.trim() || undefined,
      };

      // Add announcement for create and edit mode
      if (showAnnouncement) {
        data.announcement = isAnnouncement;
      }

      // Add scheduling only for create mode
      if (mode === "create" && showScheduling && isScheduled && scheduledAt) {
        data.scheduled_at = scheduledAt.toISOString();
      }

      await onSubmit(data);

      // Reset form only in create mode
      if (mode === "create") {
        setMessage("");
        clearImages();
        setIsAnnouncement(false);
        setIsScheduled(false);
        setScheduledAt(undefined);
        setHasContentWarning(false);
        setContentWarning("");
        setIsPreviewMode(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Ctrl+Enter or Cmd+Enter to submit (only in create mode)
    if (mode === "create" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSubmit) {
        handleSubmit();
      }
      return;
    }

    if (showMentionDropdown && mentionProfiles.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < mentionProfiles.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev > 0 ? prev - 1 : mentionProfiles.length - 1,
          );
          break;
        case "Enter":
        case "Tab": {
          e.preventDefault();
          const selectedProfile = mentionProfiles[selectedMentionIndex];
          if (selectedProfile) {
            selectMention(selectedProfile);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setShowMentionDropdown(false);
          setMentionProfiles([]);
          break;
      }
      return;
    }

    if (showTagDropdown && tagSuggestions.length > 0) {
      // Enter while composing Korean commits the syllable, not a tag.
      if (e.nativeEvent.isComposing) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedTagIndex((prev) =>
            prev < tagSuggestions.length - 1 ? prev + 1 : 0,
          );
          return;
        case "ArrowUp":
          e.preventDefault();
          setSelectedTagIndex((prev) =>
            prev > 0 ? prev - 1 : tagSuggestions.length - 1,
          );
          return;
        case "Enter":
        case "Tab": {
          const selected = tagSuggestions[selectedTagIndex];
          if (selected) {
            e.preventDefault();
            selectTag(selected.tag);
          }
          return;
        }
        case "Escape":
          e.preventDefault();
          closeTagDropdown();
          return;
      }
    }

    if (showSlashDropdown && slashCommands.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedSlashIndex((prev) =>
            prev < slashCommands.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedSlashIndex((prev) =>
            prev > 0 ? prev - 1 : slashCommands.length - 1,
          );
          break;
        case "Enter":
        case "Tab": {
          e.preventDefault();
          const selected = slashCommands[selectedSlashIndex];
          if (selected) {
            selectSlashCommand(selected);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setShowSlashDropdown(false);
          setSlashCommands([]);
          break;
      }
      return;
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    const cursorPosition = e.target.selectionStart;
    checkForMention(newMessage, cursorPosition);
    checkForSlashCommand(newMessage, cursorPosition);
    checkForTag(newMessage, cursorPosition);
  };

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(message, cursorPosition);
    checkForSlashCommand(message, cursorPosition);
    checkForTag(message, cursorPosition);
  };

  // IME composition handlers for CJK input
  const handleCompositionStart = () => {
    compositionDataRef.current = "";
  };

  const handleCompositionUpdate = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    compositionDataRef.current = e.data || "";
    const currentValue = e.currentTarget.value;
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(currentValue, cursorPosition);
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    compositionDataRef.current = "";
    const currentValue = e.currentTarget.value;
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(currentValue, cursorPosition);
    checkForTag(currentValue, cursorPosition);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMentionDropdown && event.target instanceof HTMLElement) {
        if (
          !event.target.closest(".mention-dropdown") &&
          !event.target.closest("textarea")
        ) {
          setShowMentionDropdown(false);
          setMentionProfiles([]);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMentionDropdown]);

  const isDisabled = isUploadingImages || isSubmitting;
  const canPreview = message.trim().length > 0;
  const uploadedImagesCount = images.filter((img) => img.uploadedId).length;
  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;
  const canSubmit =
    (message.trim().length > 0 || uploadedImagesCount > 0) &&
    !isDisabled &&
    !isOverLimit &&
    currentProfile &&
    (!isScheduled || scheduledAt !== undefined);

  // Determine button text and icon
  const finalSubmitText =
    submitButtonText || (mode === "edit" ? "저장" : "게시");
  const finalSubmitIcon =
    submitButtonIcon ||
    (mode === "edit" ? (
      <Save className="h-3 w-3 sm:mr-1.5" />
    ) : (
      <Send className="h-3 w-3 sm:mr-1.5" />
    ));

  return (
    <div className="bg-card relative">
      {/* Header with toggle buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant={!isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            disabled={isSubmitting}
            className="h-8 px-2 sm:px-3"
          >
            <Edit3 className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">
              {mode === "edit" ? "편집" : "작성"}
            </span>
          </Button>
          <Button
            type="button"
            variant={isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
            disabled={isSubmitting || !canPreview}
            className="h-8 px-2 sm:px-3"
          >
            <Eye className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">미리보기</span>
          </Button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {showAnnouncement && canBeAnnouncement && (
            <Button
              type="button"
              variant={isAnnouncement ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsAnnouncement(!isAnnouncement)}
              disabled={isDisabled}
              className="h-8 w-8 p-0"
              title={isAnnouncement ? "공지사항 해제" : "공지사항으로 게시"}
            >
              <Megaphone className="h-4 w-4" />
            </Button>
          )}
          {showScheduling && canSchedule && (
            <Button
              type="button"
              variant={isScheduled ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setIsScheduled(!isScheduled);
                if (isScheduled) {
                  setScheduledAt(undefined);
                }
              }}
              disabled={isDisabled}
              className="h-8 w-8 p-0"
              title={isScheduled ? "예약 취소" : "게시물 예약"}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant={hasContentWarning ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setHasContentWarning(!hasContentWarning);
              if (!hasContentWarning) {
                setContentWarning("민감한 내용");
              } else {
                setContentWarning("");
              }
            }}
            disabled={isDisabled}
            className="h-8 w-8 p-0"
            title={hasContentWarning ? "컨텐츠 경고 해제" : "컨텐츠 경고 추가"}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="h-8 w-8 p-0"
            title="이미지 첨부"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          {onCancel && (
            <Button
              onClick={onCancel}
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              className="h-8 px-2 sm:px-4 ml-1 sm:ml-2"
            >
              취소
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="sm"
            className="h-8 px-2 sm:px-4 ml-1 sm:ml-2"
          >
            {isSubmitting ? (
              <Spinner className="h-3 w-3 text-white" />
            ) : (
              <>
                {finalSubmitIcon}
                <span className="hidden sm:inline">{finalSubmitText}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex flex-wrap gap-2">
            {images.map((image, index) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.preview}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImageFromHook(index)}
                  disabled={isDisabled}
                  className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90 disabled:opacity-50 shadow-marsh"
                  title="이미지 제거"
                >
                  <X className="h-3 w-3" />
                </button>
                {isUploadingImages && !image.uploadedId && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-xs font-medium">
                      업로드 중...
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="relative">
        {!isPreviewMode ? (
          <div className="relative">
            {/* Content Warning Input */}
            {hasContentWarning && (
              <div className="mb-3 pb-3 p-4 bg-muted border-y border-border">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    컨텐츠 경고
                  </span>
                </div>
                <Input
                  value={contentWarning}
                  onChange={(e) => setContentWarning(e.target.value)}
                  placeholder="경고 내용을 입력하세요 (예: 민감한 내용, 스포일러 포함 등)"
                  disabled={isSubmitting}
                  className="bg-card"
                />
              </div>
            )}
            {/* Scheduling DateTime Picker */}
            {isScheduled && (
              <div className="mb-3 pb-4 p-4 bg-muted border-y border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    게시물 예약
                  </span>
                </div>
                <Suspense fallback={<Spinner className="h-5 w-5" />}>
                  <DateTimePicker
                    value={scheduledAt}
                    onChange={setScheduledAt}
                    minDate={schedulingConfig?.minDate || new Date()}
                    maxDate={schedulingConfig?.maxDate}
                    disabled={isSubmitting}
                  />
                </Suspense>
                {scheduledAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    이 게시물은 {new Date(scheduledAt).toLocaleString("ko-KR")}
                    에 자동으로 게시됩니다.
                  </p>
                )}
              </div>
            )}
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const files = pastedImages(e);
                if (files.length === 0) return;
                e.preventDefault();
                handleImageSelectFromHook(files);
              }}
              onClick={handleTextareaClick}
              onCompositionStart={handleCompositionStart}
              onCompositionUpdate={handleCompositionUpdate}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              disabled={isSubmitting}
              className={`resize-none border-0 focus:ring-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base leading-relaxed transition-all ${
                (showMentionDropdown && mentionProfiles.length > 0) ||
                (showSlashDropdown && slashCommands.length > 0) ||
                (showTagDropdown && tagSuggestions.length > 0)
                  ? "min-h-[120px] rounded-t-none"
                  : "min-h-[120px] rounded-none"
              }`}
            />
          </div>
        ) : (
          <div className="min-h-[120px] p-4">
            {message.trim() ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-base leading-relaxed"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
                dangerouslySetInnerHTML={{
                  __html: md.render(message),
                }}
              />
            ) : (
              <p className="text-muted-foreground text-base">
                미리 볼 내용이 없습니다.
              </p>
            )}
          </div>
        )}

        {/* Mention autocomplete */}
        {showMentionDropdown &&
          mentionProfiles.length > 0 &&
          !isPreviewMode && (
            <div className="mention-dropdown bg-card border-t border-border max-h-48 overflow-y-auto">
              {mentionProfiles.map((profile, index) => (
                <button
                  key={profile.username}
                  type="button"
                  className={`px-4 py-3 cursor-pointer w-full text-left flex items-center gap-3 transition-colors border-l-4 ${
                    index === selectedMentionIndex
                      ? "bg-accent border-l-primary"
                      : "hover:bg-background border-l-transparent"
                  }`}
                  onClick={() => selectMention(profile)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectMention(profile);
                    }
                  }}
                >
                  <ProfileAvatar
                    profilePictureUrl={profile.profile_picture_url}
                    name={profile.name}
                    username={profile.username}
                    size="md"
                  />
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium text-foreground">
                      {profile.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @{profile.username}
                    </span>
                  </div>
                  {index === selectedMentionIndex && (
                    <div className="text-xs text-muted-foreground font-medium">
                      Tab
                    </div>
                  )}
                </button>
              ))}
              <div className="px-4 py-2 bg-background border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>↑↓ 선택</span>
                  <span>Tab 확인</span>
                </div>
              </div>
            </div>
          )}

        {/* Hashtag autocomplete */}
        {showTagDropdown && tagSuggestions.length > 0 && !isPreviewMode && (
          <div className="tag-dropdown bg-card border-t border-border max-h-48 overflow-y-auto">
            {tagSuggestions.map((item, index) => (
              <button
                key={item.tag}
                type="button"
                className={`px-4 py-2.5 cursor-pointer w-full text-left flex items-center gap-3 transition-colors border-l-4 ${
                  index === selectedTagIndex
                    ? "bg-accent border-l-primary"
                    : "hover:bg-background border-l-transparent"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectTag(item.tag)}
              >
                <span className="text-sm font-semibold text-primary">
                  #{item.tag}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  글 {item.count}개
                </span>
              </button>
            ))}
            <div className="px-4 py-2 bg-background border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tagQuery ? "쓰인 태그" : "많이 쓴 태그"} · ↑↓ 선택</span>
                <span>Tab 확인</span>
              </div>
            </div>
          </div>
        )}

        {/* Slash command autocomplete */}
        {showSlashDropdown && slashCommands.length > 0 && !isPreviewMode && (
          <div className="slash-dropdown bg-card border-t border-border max-h-48 overflow-y-auto">
            {slashCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                type="button"
                className={`px-4 py-3 cursor-pointer w-full text-left flex items-center gap-3 transition-colors border-l-4 ${
                  index === selectedSlashIndex
                    ? "bg-accent border-l-primary"
                    : "hover:bg-background border-l-transparent"
                }`}
                onClick={() => selectSlashCommand(cmd)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectSlashCommand(cmd);
                  }
                }}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-mono font-medium text-foreground">
                    /{cmd.name}
                  </span>
                  {cmd.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {cmd.description}
                    </span>
                  )}
                </div>
                {index === selectedSlashIndex && (
                  <div className="text-xs text-muted-foreground font-medium">
                    Tab
                  </div>
                )}
              </button>
            ))}
            <div className="px-4 py-2 bg-background border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>↑↓ 선택</span>
                <span>Tab 확인</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className={`px-4 py-3 bg-background ${
          (
            (showMentionDropdown && mentionProfiles.length > 0) ||
              (showSlashDropdown && slashCommands.length > 0) ||
              (showTagDropdown && tagSuggestions.length > 0)
          ) && !isPreviewMode
            ? "border-t-0"
            : "border-t border-border"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <p className="text-xs text-muted-foreground">
            <MarkdownHelpModal /> 문법을 사용할 수 있습니다.
          </p>
          <div
            className={`text-xs ${
              isOverLimit
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {message.length > 0 &&
              `${message.length} / ${MAX_MESSAGE_LENGTH}자`}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />
    </div>
  );
}
