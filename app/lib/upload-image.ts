import { getMember, mutate, signIn } from "~/lib/naru";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
];

// Naru Media's limit per file; large photos are shrunk before upload.
export const MAX_IMAGE_FILE_SIZE = 25 * 1024 * 1024;

// The SDK draws photos at most this long on the long edge before uploading.
const SDK_LONG_EDGE = 2048;

export interface UploadedImage {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}

/**
 * The image's pixel size as stored: the browser's decoding of the file,
 * scaled as the SDK shrinks large photos. 1×1 where it cannot decode it.
 */
async function measure(file: File): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    bitmap.close();
    const scale = Math.min(1, SDK_LONG_EDGE / Math.max(width, height));
    if (file.type !== "image/gif" && scale < 1) {
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    return { width, height };
  } catch {
    return { width: 1, height: 1 };
  }
}

/**
 * Uploads an image to the site's Naru Media as the signed-in member and
 * registers it with its size (`images:register`), for posts, messages and
 * profiles to name by ID.
 */
export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const member = await getMember();
  if (!member) {
    await signIn();
    throw new Error("로그인이 필요합니다");
  }
  const size = await measure(file);
  const upload = await member.media.upload(file, {
    onProgress: (progress) => {
      if (progress.phase === "uploading" && progress.total > 0)
        onProgress?.(Math.round((progress.loaded / progress.total) * 100));
      else if (progress.phase === "finishing") onProgress?.(100);
    },
  });
  return mutate<UploadedImage>("images:register", {
    upload_id: upload.id,
    ...size,
  });
}

/**
 * The image files pasted with a paste event (a screenshot copied to the
 * clipboard, an image copied from a page), so composers can attach them
 * as if they were picked from a file dialog. Empty when the paste is text.
 */
export function pastedImages(event: {
  clipboardData: DataTransfer | null;
}): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}
