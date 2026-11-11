// Cropping a picture before it is uploaded: the picture behind a frame
// (round for a profile picture, tall for the big one), moved by dragging and
// zoomed with the slider, the wheel, or two fingers. "적용" draws what is in
// the frame onto a canvas and hands it back as a file, at a sensible size.
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";

interface Props {
  file: File;
  /** Width over height of what is kept: 1 for a square, 3 / 4 for tall. */
  aspect: number;
  /** Shows a round guide (the picture is still saved square). */
  round?: boolean;
  /** Width of the saved picture, in pixels. */
  outputWidth: number;
  title: string;
  onCancel: () => void;
  onDone: (file: File) => void;
}

const MAX_ZOOM = 4;

export function ImageCropper({
  file,
  aspect,
  round = false,
  outputWidth,
  title,
  onCancel,
  onDone,
}: Props) {
  // The frame on screen.
  const fw = aspect >= 1 ? 288 : Math.round(320 * aspect);
  const fh = Math.round(fw / aspect);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(next);
  }, [file]);

  // The picture covers the frame at zoom 1.
  const base = natural ? Math.max(fw / natural.w, fh / natural.h) : 1;
  const scale = base * zoom;
  const dw = (natural?.w ?? 0) * scale;
  const dh = (natural?.h ?? 0) * scale;
  const clamp = (o: { x: number; y: number }, z = zoom) => {
    const s = base * z;
    const mx = Math.max(0, ((natural?.w ?? 0) * s - fw) / 2);
    const my = Math.max(0, ((natural?.h ?? 0) * s - fh) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, o.x)),
      y: Math.min(my, Math.max(-my, o.y)),
    };
  };
  const zoomTo = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setOffset((o) => clamp(o, next));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) zoomTo(zoom * (d / pinch.current));
      pinch.current = d;
      return;
    }
    setOffset((o) =>
      clamp({ x: o.x + now.x - last.x, y: o.y + now.y - last.y }),
    );
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
  };

  const apply = async () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    setBusy(true);
    try {
      // Where the picture's corner sits in the frame, back in its pixels.
      const px = fw / 2 - dw / 2 + offset.x;
      const py = fh / 2 - dh / 2 + offset.y;
      const sx = -px / scale;
      const sy = -py / scale;
      const sw = fw / scale;
      const sh = fh / scale;
      const width = Math.round(Math.min(outputWidth, sw));
      const height = Math.round(width / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext("2d");
      if (!g) throw new Error("canvas");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      // A PNG keeps its see-through parts; anything else becomes a JPEG.
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, type, 0.9),
      );
      if (!blob) throw new Error("toBlob");
      const name = file.name.replace(/\.[^.]+$/, "") || "image";
      onDone(
        new File([blob], `${name}.${type === "image/png" ? "png" : "jpg"}`, {
          type,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          끌어서 위치를 옮기고, 아래 막대나 휠, 두 손가락으로 확대하세요.
        </DialogDescription>
        <div
          className="cropper-frame mx-auto"
          style={{ width: fw, height: fh }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              style={{
                width: dw || undefined,
                height: dh || undefined,
                transform: `translate(${fw / 2 - dw / 2 + offset.x}px, ${fh / 2 - dh / 2 + offset.y}px)`,
                visibility: natural ? "visible" : "hidden",
              }}
            />
          )}
          {round && <div className="cropper-round" aria-hidden />}
        </div>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          aria-label="확대"
          className="w-full accent-[var(--primary)]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button disabled={busy || !natural} onClick={apply}>
            적용
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
