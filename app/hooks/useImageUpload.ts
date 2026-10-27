import { useState } from "react";
import { toast } from "sonner";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_FILE_SIZE,
  uploadImage as uploadImageToServer,
} from "~/lib/upload-image";

export interface ImageUpload {
  id: string;
  file: File | null;
  preview: string;
  uploadedId?: string;
}

interface UseImageUploadOptions {
  /**
   * Maximum number of images allowed (default: no limit)
   */
  maxImages?: number;
}

interface UseImageUploadReturn {
  /**
   * Image objects with file, preview, and uploaded ID
   */
  images: ImageUpload[];
  /**
   * Image preview URLs (for backward compatibility)
   */
  imagePreviews: string[];
  /**
   * Uploaded image IDs from the server (for backward compatibility)
   */
  uploadedImageIds: string[];
  /**
   * Upload progress percentage (0-100), null when not uploading
   */
  uploadProgress: number | null;
  /**
   * Whether images are currently being uploaded
   */
  isUploadingImages: boolean;
  /**
   * Handle file selection from input
   */
  handleImageSelect: (files: FileList | File[]) => void;
  /**
   * Remove an image by index
   */
  removeImage: (index: number) => void;
  /**
   * Clear all images
   */
  clearImages: () => void;
  /**
   * Initialize with existing images
   */
  initializeWithExisting: (existingImages: ImageUpload[]) => void;
}

const ALLOWED_TYPES = ALLOWED_IMAGE_TYPES;
const MAX_FILE_SIZE = MAX_IMAGE_FILE_SIZE;

/**
 * Custom hook for handling image uploads
 */
export function useImageUpload(
  options: UseImageUploadOptions = {},
): UseImageUploadReturn {
  const { maxImages } = options;
  const [images, setImages] = useState<ImageUpload[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const uploadImages = async (imageObjects: ImageUpload[]) => {
    setIsUploadingImages(true);
    setUploadProgress(0);
    try {
      const total = imageObjects.filter((o) => o.file !== null).length;
      let completed = 0;

      const uploadPromises = imageObjects
        .filter((imageObj) => imageObj.file !== null)
        .map(async (imageObj) => {
          const result = await uploadImageToServer(
            imageObj.file as File,
            (percent) => {
              const overall = Math.round(
                ((completed + percent / 100) / total) * 100,
              );
              setUploadProgress(overall);
            },
          );
          completed++;
          setUploadProgress(Math.round((completed / total) * 100));
          return { id: imageObj.id, uploadedId: result.id };
        });

      const uploadResults = await Promise.all(uploadPromises);

      // Update images with uploaded IDs
      setImages((prev) =>
        prev.map((img) => {
          const result = uploadResults.find((r) => r.id === img.id);
          return result ? { ...img, uploadedId: result.uploadedId } : img;
        }),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다",
      );
      // Remove the files that failed to upload
      const failedIds = imageObjects.map((obj) => obj.id);
      setImages((prev) => prev.filter((img) => !failedIds.includes(img.id)));
    } finally {
      setIsUploadingImages(false);
      setUploadProgress(null);
    }
  };

  const handleImageSelect = (filesInput: FileList | File[]) => {
    const files = Array.from(filesInput);
    if (files.length === 0) return;

    // Check max images limit
    if (maxImages !== undefined && images.length >= maxImages) {
      toast.error(`최대 ${maxImages}개의 이미지만 업로드할 수 있습니다`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error("이미지 크기는 25MB 이하여야 합니다");
        continue;
      }

      // Check if adding this file would exceed the limit
      if (
        maxImages !== undefined &&
        images.length + validFiles.length >= maxImages
      ) {
        toast.error(`최대 ${maxImages}개의 이미지만 업로드할 수 있습니다`);
        break;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const newImageObjects: ImageUpload[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: "",
    }));

    setImages((prev) => [...prev, ...newImageObjects]);

    // Create previews asynchronously
    newImageObjects.forEach((imageObj) => {
      if (!imageObj.file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageObj.id ? { ...img, preview: result } : img,
            ),
          );
        }
      };
      reader.readAsDataURL(imageObj.file);
    });

    // Upload the files
    uploadImages(newImageObjects);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setImages([]);
  };

  const initializeWithExisting = (existingImages: ImageUpload[]) => {
    setImages(existingImages);
  };

  // Backward compatibility getters
  const imagePreviews = images.map((img) => img.preview);
  const uploadedImageIds = images
    .map((img) => img.uploadedId)
    .filter((id): id is string => id !== undefined);

  return {
    images,
    imagePreviews,
    uploadedImageIds,
    uploadProgress,
    isUploadingImages,
    handleImageSelect,
    removeImage,
    clearImages,
    initializeWithExisting,
  };
}
