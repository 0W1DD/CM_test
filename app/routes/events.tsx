// Events: the morning check-in and the weekly gift exchange, where a
// member signs up, writes a gift for the one they were given, and opens
// what they were given on Monday morning.
import { useMutation } from "@tanstack/react-query";
import {
  CalendarCheck,
  Gift,
  ImagePlus,
  PartyPopper,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { BoxCollectionBook } from "~/components/box-collection";
import { CheckInButton, GiftSignupButton } from "~/components/events-rail";
import {
  ARRIVAL_STYLE,
  ARRIVAL_STYLES,
  type ArrivalStyle,
  GiftArrivalOverlay,
} from "~/components/gift-arrival";
import { GiftContent } from "~/components/gift-content";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useImageUpload } from "~/hooks/useImageUpload";
import {
  type EventsStatus,
  kstLastMinute,
  kstTime,
  useEventsStatus,
} from "~/lib/events";
import { errorMessage, mutate } from "~/lib/naru";
import { ALLOWED_IMAGE_TYPES } from "~/lib/upload-image";

export function meta() {
  return [
    { title: "이벤트" },
    { name: "description", content: "출석체크와 주간 선물 교환식" },
  ];
}

/** The gift the profile writes for this week, until Sunday 23:30. */
function GiftEditor({
  gift,
  onSaved,
  profileId,
}: {
  gift: EventsStatus["gift"];
  onSaved: () => void;
  profileId: string | undefined;
}) {
  const [content, setContent] = useState(gift.content ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useImageUpload({ maxImages: 4 });
  const { initializeWithExisting } = upload;
  // Start from what was saved.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, from the saved gift
  useEffect(() => {
    initializeWithExisting(
      gift.images.map((image) => ({
        id: image.id,
        file: null,
        preview: image.url,
        uploadedId: image.id,
      })),
    );
  }, []);
  const closed = gift.phase === "closed";
  const save = useMutation({
    mutationFn: async () => {
      try {
        await mutate("events:giftSave", {
          profile_id: profileId,
          content,
          image_ids: upload.uploadedImageIds,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "선물을 저장하지 못했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("선물을 저장했습니다");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (closed)
    return gift.submitted_at ? (
      <GiftContent content={gift.content} images={gift.images} />
    ) : (
      <p className="text-sm text-muted-foreground">
        선물 입력 시간이 지났습니다.
      </p>
    );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
        rows={6}
        placeholder="선물로 보낼 글이나 링크를 적어 주세요. 이미지와 GIF도 넣을 수 있습니다."
        className="w-full border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {upload.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {upload.images.map((image, index) => (
            <div key={image.id} className="relative">
              <img
                src={image.preview}
                alt=""
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => upload.removeImage(index)}
                className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"
                aria-label="이미지 빼기"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) upload.handleImageSelect(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.images.length >= 4}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          이미지·GIF 넣기
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={save.isPending || upload.isUploadingImages}
        >
          {upload.isUploadingImages
            ? "이미지 올리는 중..."
            : save.isPending
              ? "저장하는 중..."
              : gift.submitted_at
                ? "선물 다시 저장"
                : "선물 저장"}
        </Button>
        {gift.submitted_at && (
          <span className="text-xs text-muted-foreground">
            {kstTime(gift.submitted_at)}에 저장됨
          </span>
        )}
      </div>
    </form>
  );
}

/** Last week's gifts to the profile: wrapped until pressed. */
function ReceivedGifts({ received }: { received: EventsStatus["received"] }) {
  const [unwrapped, setUnwrapped] = useState(false);
  if (!received.open)
    return received.count > 0 ? (
      <p className="text-sm text-muted-foreground">
        선물을 {received.count}개 받았습니다. {kstTime(received.opens)}에 열어볼
        수 있습니다.
      </p>
    ) : null;
  if (received.gifts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        지난주에 받은 선물이 없습니다.
      </p>
    );
  if (!unwrapped)
    return (
      <Button onClick={() => setUnwrapped(true)}>
        <PartyPopper className="h-4 w-4" />
        선물 {received.gifts.length}개 열어보기
      </Button>
    );
  return (
    <ul className="space-y-3">
      {received.gifts.map((gift, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: one giver per gift
          key={i}
          className="tour-card border border-border bg-background p-4 space-y-2"
        >
          <p className="text-sm font-semibold text-foreground">
            🎁 {gift.giver?.name ?? "알 수 없음"}님이 보낸 선물
          </p>
          <GiftContent content={gift.content} images={gift.images} />
        </li>
      ))}
    </ul>
  );
}

export default function EventsPage() {
  const { data, isLoading, profileId, refresh } = useEventsStatus();
  const { isModerator } = useCurrentInstance();
  const { currentProfile } = useAuth();
  // Two tabs: the events, and the random box's book (#collection opens it).
  const { hash } = useLocation();
  const [tab, setTab] = useState<"events" | "book">(
    hash === "#collection" ? "book" : "events",
  );
  useEffect(() => {
    if (hash === "#collection") setTab("book");
  }, [hash]);
  // The staff's look at what a recipient sees, before or after Monday
  // 08:00: from their own saved gift, or a sample. Nothing is saved.
  const [preview, setPreview] = useState<"waiting" | "open" | null>(null);
  // The arrival, in each of its designs.
  const [arrival, setArrival] = useState<ArrivalStyle | null>(null);
  const cancel = useMutation({
    mutationFn: async () => {
      try {
        await mutate("events:giftCancel", { profile_id: profileId });
      } catch (error) {
        throw new Error(errorMessage(error, "취소하지 못했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("신청을 취소했습니다");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data)
    return <LoadingState message="이벤트를 불러오는 중..." />;
  const { gift, received } = data;
  const coin = data.currency ?? "코인";
  const previewReceived: EventsStatus["received"] = {
    ...received,
    open: preview === "open",
    count: 1,
    gifts: [
      {
        giver: currentProfile
          ? {
              id: currentProfile.id,
              name: currentProfile.name,
              username: currentProfile.username,
              profile_picture_url: null,
            }
          : null,
        content: gift.submitted_at
          ? gift.content
          : "메리 크리스마스! 따뜻한 핫초코 한 잔 보냅니다 ☕ https://example.com",
        images: gift.submitted_at ? gift.images : [],
      },
    ],
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PartyPopper className="h-6 w-6" />
          이벤트
        </h1>
        {isModerator && (
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ShieldCheck className="h-4 w-4" />
            선물 교환식 관리
          </Link>
        )}
      </div>

      <div className="events-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "events"}
          className={tab === "events" ? "is-open" : ""}
          onClick={() => setTab("events")}
        >
          이벤트
        </button>
        <button
          type="button"
          role="tab"
          data-tour="box-book"
          aria-selected={tab === "book"}
          className={tab === "book" ? "is-open" : ""}
          onClick={() => setTab("book")}
        >
          도감
        </button>
      </div>

      {tab === "book" ? (
        <BoxCollectionBook />
      ) : (
        <>
          <section className="framed bg-card p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarCheck className="h-5 w-5 text-primary" />
              출석체크
            </h2>
            <p className="text-sm text-muted-foreground">
              출석체크 시 {coin} {data.check_in.coins}개를 받습니다.
            </p>
            <CheckInButton />
          </section>

          {isModerator && (
            <div className="flex flex-wrap items-center gap-2 border border-dashed border-border p-3 text-sm">
              <span className="font-semibold text-foreground">
                받는 화면 미리보기
              </span>
              <span className="text-xs text-muted-foreground">
                (운영진에게만 보입니다. 실제 선물은 바뀌지 않아요)
              </span>
              {(
                [
                  ["waiting", "열리기 전"],
                  ["open", "월요일 8시 이후"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={preview === value ? "default" : "outline"}
                  onClick={() => setPreview(preview === value ? null : value)}
                >
                  {label}
                </Button>
              ))}
              <span className="basis-full" />
              <span className="font-semibold text-foreground">도착 연출</span>
              {ARRIVAL_STYLES.map((style) => (
                <Button
                  key={style.value}
                  size="sm"
                  variant="outline"
                  onClick={() => setArrival(style.value)}
                >
                  {style.label}
                  {style.value === ARRIVAL_STYLE && " (사용 중)"}
                </Button>
              ))}
            </div>
          )}

          {arrival && (
            <GiftArrivalOverlay
              key={arrival}
              style={arrival}
              gifts={previewReceived.gifts}
              onClose={() => setArrival(null)}
            />
          )}

          {(preview || received.count > 0) && (
            <section className="framed bg-card p-5 space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <PartyPopper className="h-5 w-5 text-primary" />
                받은 선물
                {preview && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (미리보기)
                  </span>
                )}
              </h2>
              <ReceivedGifts
                // A fresh, still-wrapped gift each time the preview changes
                key={preview ?? "real"}
                received={preview ? previewReceived : received}
              />
            </section>
          )}

          <section className="framed bg-card p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Gift className="h-5 w-5 text-primary" />
              주간 선물 교환식
            </h2>
            <div className="space-y-2 text-sm text-foreground">
              <p>
                일주일에 한 번 선물을 교환합니다. 월요일 아침 8시에 열어볼 수
                있습니다.
              </p>
              <p>
                선물은 랜덤으로 배부됩니다. 운영진에게 따로 메시지를 줄 경우
                특정인에게 선물을 줄 수도 있습니다. 일종의 찌름 기능이라고
                생각해주세요. 이 외의 선물은 100% 시스템 랜덤으로 전달됩니다.
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  월요일 ~ 토요일: 선물 교환식 신청을 합니다. (이번 주 마감:{" "}
                  {kstLastMinute(gift.signup_ends)})
                </li>
                <li>
                  신청 후 ~ 일요일 저녁 11시 반까지: 선물을 입력합니다.
                  링크/이미지/글을 넣을 수 있습니다. (마감:{" "}
                  {kstTime(gift.gifts_close)})
                </li>
                <li>
                  수신인을 정하고 싶을 경우 신청 마감 전까지 운영진에게 개인
                  메시지를 보냅니다. 선착순으로 배정됩니다.
                </li>
              </ol>
              <p className="text-muted-foreground">
                선물을 보낸 사람은 선물이 열리는 월요일에 {coin}{" "}
                {data.gift_coins}
                개를 받습니다. 지금 신청 {gift.participants}명.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <GiftSignupButton />
              {gift.signed_up && gift.phase === "signup" && (
                <button
                  type="button"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (window.confirm("선물 교환식 신청을 취소할까요?"))
                      cancel.mutate();
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                >
                  신청 취소
                </button>
              )}
            </div>

            {gift.signed_up && (
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="font-semibold text-foreground">선물 작성하기</h3>
                <p className="text-xs text-muted-foreground">
                  받을 사람은 랜덤으로 정해지며 공개되지 않습니다.
                </p>
                <GiftEditor
                  key={gift.week}
                  gift={gift}
                  onSaved={refresh}
                  profileId={profileId}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
