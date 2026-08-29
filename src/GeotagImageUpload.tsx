import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  imageUrl: string | null;
  imageFile: File | null;

  /*
   * Existing callback.
   */
  onChange: (file: File | null) => void;

  /*
   * Optional multi-image callback.
   */
  onFilesChange?: (files: File[]) => void;
}

export function GeotagImageUpload({
  imageUrl,
  imageFile,
  onChange,
  onFilesChange,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const folderInputRef =
    useRef<HTMLInputElement>(null);

  const [files, setFiles] =
    useState<File[]>(
      imageFile ? [imageFile] : []
    );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [previewUrls, setPreviewUrls] =
    useState<string[]>([]);

  /*
   * Keep internal state synchronized
   * with the existing single-image prop.
   */
  useEffect(() => {
    if (imageFile) {
      setFiles((previous) => {
        if (
          previous.length === 1 &&
          previous[0] === imageFile
        ) {
          return previous;
        }

        return [imageFile];
      });

      setCurrentIndex(0);

      return;
    }

    /*
     * If parent clears its image,
     * clear the internal state too.
     */
    if (!imageUrl) {
      setFiles([]);
      setCurrentIndex(0);
    }
  }, [imageFile, imageUrl]);

  /*
   * Generate preview URLs.
   */
  useEffect(() => {
    const urls =
      files.map((file) =>
        URL.createObjectURL(file)
      );

    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, [files]);

  /*
   * Current image.
   */
  const currentFile =
    files[currentIndex] ?? null;

  const currentPreview =
    previewUrls[currentIndex] ??
    imageUrl ??
    null;

  /*
   * Filter only images.
   */
  const filterImages = (
    selectedFiles: File[]
  ) => {
    return selectedFiles.filter(
      (file) =>
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        file.type === "image/jpg" ||
        file.type === "image/webp"
    );
  };

  /*
   * Add selected images.
   */
  const addFiles = (
    selectedFiles: File[]
  ) => {
    const images =
      filterImages(selectedFiles);

    if (!images.length) {
      alert(
        "Please upload PNG, JPG, JPEG or WebP images."
      );

      return;
    }

    setFiles((previous) => {
      const existing =
        new Set(
          previous.map(
            (file) =>
              `${file.name}-${file.size}-${file.lastModified}`
          )
        );

      const newFiles =
        images.filter(
          (file) =>
            !existing.has(
              `${file.name}-${file.size}-${file.lastModified}`
            )
        );

      const combined = [
        ...previous,
        ...newFiles,
      ];

      if (onFilesChange) {
        onFilesChange(combined);
      }

      /*
       * Keep the original single-file
       * API working.
       */
      if (
        previous.length === 0 &&
        newFiles.length > 0
      ) {
        onChange(newFiles[0]);
      }

      return combined;
    });
  };

  /*
   * Normal picker.
   */
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected =
      Array.from(
        event.target.files ?? []
      );

    if (!selected.length) return;

    addFiles(selected);

    event.target.value = "";
  };

  /*
   * Folder picker.
   */
  const handleFolderChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected =
      Array.from(
        event.target.files ?? []
      );

    if (!selected.length) return;

    addFiles(selected);

    event.target.value = "";
  };

  /*
   * Change current image.
   */
  const selectImage = (
    index: number
  ) => {
    if (
      index < 0 ||
      index >= files.length
    ) {
      return;
    }

    setCurrentIndex(index);

    const file =
      files[index];

    onChange(file);
  };

  /*
   * Previous.
   */
  const previousImage = () => {
    if (files.length <= 1) return;

    const nextIndex =
      currentIndex <= 0
        ? files.length - 1
        : currentIndex - 1;

    selectImage(nextIndex);
  };

  /*
   * Next.
   */
  const nextImage = () => {
    if (files.length <= 1) return;

    const nextIndex =
      currentIndex >= files.length - 1
        ? 0
        : currentIndex + 1;

    selectImage(nextIndex);
  };

  /*
   * Remove current image.
   */
  const removeCurrent = () => {
    if (!files.length) return;

    const newFiles =
      files.filter(
        (_, index) =>
          index !== currentIndex
      );

    setFiles(newFiles);

    if (onFilesChange) {
      onFilesChange(newFiles);
    }

    if (!newFiles.length) {
      setCurrentIndex(0);
      onChange(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    const newIndex =
      Math.min(
        currentIndex,
        newFiles.length - 1
      );

    setCurrentIndex(newIndex);

    onChange(
      newFiles[newIndex]
    );
  };

  /*
   * Remove everything.
   */
  const clearAll = () => {
    setFiles([]);
    setCurrentIndex(0);

    onChange(null);

    if (onFilesChange) {
      onFilesChange([]);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Upload Geotag Image
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Normal file picker */}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          className="hidden"
          onChange={handleChange}
        />

        {/* Folder picker */}
        <input
          ref={folderInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          // @ts-expect-error - Chromium webkitdirectory support
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleFolderChange}
        />

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              inputRef.current?.click()
            }
          >
            Choose Images
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              folderInputRef.current?.click()
            }
          >
            Choose Folder
          </Button>
        </div>

        {/* Empty state */}
        {!files.length && (
          <div className="rounded-xl border-2 border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Upload one image, multiple images,
              or an entire folder.
            </p>

            <p className="mt-2 text-xs text-muted-foreground">
              PNG, JPG, JPEG or WebP
            </p>
          </div>
        )}

        {/* Preview */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-black">
              {currentPreview && (
                <img
                  src={currentPreview}
                  alt={
                    currentFile?.name ??
                    "Uploaded geotag"
                  }
                  className="max-h-[500px] w-full object-contain"
                />
              )}
            </div>

            {/* Filename */}
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">
                Current image
              </div>

              <div className="mt-1 truncate text-sm font-medium">
                {currentFile?.name}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Image {currentIndex + 1} of{" "}
                {files.length}
              </div>
            </div>

            {/* Previous / Next */}
            {files.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={previousImage}
                >
                  ← Previous
                </Button>

                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} /{" "}
                  {files.length}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  onClick={nextImage}
                >
                  Next →
                </Button>
              </div>
            )}

            {/* Thumbnails */}
            {files.length > 1 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {files.map(
                  (file, index) => (
                    <button
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      type="button"
                      onClick={() =>
                        selectImage(index)
                      }
                      className={`overflow-hidden rounded-lg border-2 ${
                        index === currentIndex
                          ? "border-primary"
                          : "border-transparent"
                      }`}
                      title={file.name}
                    >
                      <img
                        src={
                          previewUrls[index]
                        }
                        alt={file.name}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  )
                )}
              </div>
            )}

            {/* Selected file list */}
            <div className="rounded-xl border">
              <div className="border-b px-4 py-3 text-sm font-semibold">
                Selected Images (
                {files.length})
              </div>

              <div className="max-h-56 overflow-y-auto">
                {files.map(
                  (file, index) => (
                    <button
                      key={`${file.name}-${file.size}-${file.lastModified}-row`}
                      type="button"
                      onClick={() =>
                        selectImage(index)
                      }
                      className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 ${
                        index === currentIndex
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <img
                        src={
                          previewUrls[index]
                        }
                        alt=""
                        className="h-12 w-12 rounded-md object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {file.name}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {index + 1} of{" "}
                          {files.length}
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Remove / clear */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={
                  removeCurrent
                }
              >
                Remove Current
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={clearAll}
              >
                Clear All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
