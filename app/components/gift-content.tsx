import type { GiftImage } from "~/lib/events";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/** A gift's text with its links made clickable, and its pictures and GIFs. */
export function GiftContent({
  content,
  images,
}: {
  content: string | null;
  images: GiftImage[];
}) {
  return (
    <div className="space-y-2">
      {content && (
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
          {content.split(URL_PATTERN).map((part, i) =>
            i % 2 === 1 ? (
              <a
                // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed text
                key={i}
                href={part}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline break-all"
              >
                {part}
              </a>
            ) : (
              part
            ),
          )}
        </p>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <a
              key={image.id}
              href={image.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <img
                src={image.url}
                alt={image.filename}
                className="max-h-56 max-w-full rounded-lg border border-border"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
