import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";

interface PostImage {
  id: string;
  url: string;
  filename: string;
  width: number;
  height: number;
}

interface PostCardImagesProps {
  images: PostImage[];
  isReply?: boolean;
  onImageClick: (image: { url: string; filename: string }) => void;
  hidden?: boolean;
}

export function PostCardImages({
  images,
  isReply = false,
  onImageClick,
  hidden = false,
}: PostCardImagesProps) {
  if (images.length === 0 || hidden) {
    return null;
  }

  return (
    <div className={isReply ? "mt-2" : "mt-4"}>
      {images.length === 1 && images[0] ? (
        <div className="overflow-hidden border border-border">
          <img
            src={images[0].url}
            alt={images[0].filename}
            width={images[0].width}
            height={images[0].height}
            loading="lazy"
            decoding="async"
            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: "400px", objectFit: "cover" }}
            onClick={() => {
              const image = images[0];
              if (image) onImageClick(image);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const image = images[0];
                if (image) onImageClick(image);
              }
            }}
          />
        </div>
      ) : (
        <Carousel
          className="w-full"
          opts={{
            align: "start",
            containScroll: "trimSnaps",
          }}
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {images.map((image) => (
              <CarouselItem key={image.id} className="pl-2 md:pl-4 basis-4/5">
                <div className="overflow-hidden border border-border">
                  <img
                    src={image.url}
                    alt={image.filename}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: "400px", objectFit: "cover" }}
                    onClick={() => onImageClick(image)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onImageClick(image);
                      }
                    }}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      )}
    </div>
  );
}
