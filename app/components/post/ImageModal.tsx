import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";

interface ImageModalProps {
  image: {
    url: string;
    filename: string;
  } | null;
  onClose: () => void;
}

export function ImageModal({ image, onClose }: ImageModalProps) {
  return (
    <Dialog open={!!image} onOpenChange={() => onClose()}>
      <DialogContent
        className="!fixed !inset-0 !w-screen !h-screen !max-w-none !max-h-none !p-0 !rounded-none !border-none !bg-black !z-50 !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !gap-0 !shadow-none !overflow-visible block"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {image?.filename || "이미지 보기"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          게시물에 첨부된 이미지를 전체 화면으로 보고 있습니다. ESC 키나 닫기
          버튼을 눌러 닫을 수 있습니다.
        </DialogDescription>
        <DialogClose className="absolute top-4 right-4 z-10 text-white hover:text-muted-foreground p-2 rounded-full hover:bg-black/50 transition-colors">
          <X className="h-6 w-6" />
          <span className="sr-only">Close</span>
        </DialogClose>
        {image && (
          <button
            className="absolute inset-0 flex items-center justify-center p-4 cursor-pointer"
            type="button"
            onClick={() => onClose()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClose();
              }
            }}
          >
            <img
              src={image.url}
              alt={image.filename}
              className="max-w-full max-h-full object-contain rounded-lg cursor-default"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
