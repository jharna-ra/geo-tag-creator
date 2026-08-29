import { useEffect, useRef, useState } from "react";

interface GeotagUploaderProps {
  onImageSelected: (file: File | null) => void;

  /*
   * Optional multi-file callback.
   * Existing code using only onImageSelected will continue to work.
   */
  onImagesSelected?: (files: File[]) => void;
}

export default function GeotagUploader({
  onImageSelected,
  onImagesSelected,
}: GeotagUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);

  const currentFile = files[currentIndex] ?? null;

  /*
   * Create preview URLs for all selected images.
   */
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));

    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  /*
   * Notify parent whenever the current image changes.
   */
  useEffect(() => {
    onImageSelected(currentFile);
  }, [currentFile, onImageSelected]);

  /*
   * Notify optional multi-file parent.
   */
  useEffect(() => {
    if (onImagesSelected) {
      onImagesSelected(files);
    }
  }, [files, onImagesSelected]);

  /*
   * Accept normal image files.
   */
  const filterImages = (selectedFiles: File[]) => {
    return selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );
  };

  /*
   * Add files without destroying previously selected files.
   */
  const addFiles = (selectedFiles: File[]) => {
    const images = filterImages(selectedFiles);

    if (!images.length) {
      alert("Please select PNG, JPG, JPEG or WebP images.");
      return;
    }

    setFiles((previous) => {
      const existingKeys = new Set(
        previous.map(
          (file) =>
            `${file.name}-${file.size}-${file.lastModified}`
        )
      );

      const newFiles = images.filter(
        (file) =>
          !existingKeys.has(
            `${file.name}-${file.size}-${file.lastModified}`
          )
      );

      const combined = [...previous, ...newFiles];

      return combined;
    });

    /*
     * If this is the first upload, show the first image.
     */
    setCurrentIndex((previous) => {
      if (files.length === 0) return 0;
      return previous;
    });
  };

  /*
   * Normal file picker.
   */
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(event.target.files ?? []);

    if (!selected.length) return;

    addFiles(selected);

    /*
     * Allow selecting the same file again later.
     */
    event.target.value = "";
  };

  /*
   * Folder picker.
   *
   * Chromium browsers support webkitdirectory.
   */
  const handleFolderChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(event.target.files ?? []);

    if (!selected.length) return;

    addFiles(selected);

    event.target.value = "";
  };

  /*
   * Select a particular image.
   */
  const selectImage = (index: number) => {
    if (index < 0 || index >= files.length) return;

    setCurrentIndex(index);
  };

  /*
   * Previous image.
   */
  const previousImage = () => {
    setCurrentIndex((index) =>
      index <= 0 ? files.length - 1 : index - 1
    );
  };

  /*
   * Next image.
   */
  const nextImage = () => {
    setCurrentIndex((index) =>
      index >= files.length - 1 ? 0 : index + 1
    );
  };

  /*
   * Remove current image.
   */
  const removeCurrent = () => {
    if (!files.length) return;

    setFiles((previous) => {
      const updated = previous.filter(
        (_, index) => index !== currentIndex
      );

      return updated;
    });

    setCurrentIndex((index) => {
      if (files.length <= 1) return 0;

      if (index >= files.length - 1) {
        return files.length - 2;
      }

      return index;
    });
  };

  /*
   * Remove everything.
   */
  const clearAll = () => {
    setFiles([]);
    setCurrentIndex(0);
    onImageSelected(null);

    if (onImagesSelected) {
      onImagesSelected([]);
    }
  };

  const preview =
    currentIndex >= 0 &&
    currentIndex < previews.length
      ? previews[currentIndex]
      : null;

  return (
    <div className="space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Upload Images
        </h2>

        <p className="text-sm text-muted-foreground">
          Upload one image, multiple images, or an entire folder.
        </p>
      </div>

      {/* Hidden normal file picker */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple
        className="hidden"
        onChange={handleChange}
      />

      {/* Hidden folder picker */}
      <input
        ref={folderInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple
        // @ts-expect-error - webkitdirectory is supported by Chromium
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleFolderChange}
      />

      {/* Upload buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Choose Images
        </button>

        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Choose Folder
        </button>
      </div>

      {/* Empty state */}
      {!files.length && (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <div className="text-sm font-medium">
            No images selected
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            Choose one or more images or select an entire folder.
          </div>
        </div>
      )}

      {/* Current preview */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-black">
            {preview && (
              <img
                src={preview}
                alt={currentFile?.name ?? "Selected image"}
                className="max-h-[500px] w-full object-contain"
              />
            )}
          </div>

          {/* Current filename */}
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
              Current image
            </div>

            <div className="mt-1 truncate text-sm font-medium">
              {currentFile?.name}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Image {currentIndex + 1} of {files.length}
            </div>
          </div>

          {/* Previous / Next */}
          {files.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={previousImage}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                ← Previous
              </button>

              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {files.length}
              </span>

              <button
                type="button"
                onClick={nextImage}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Next →
              </button>
            </div>
          )}

          {/* Thumbnail strip */}
          {files.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {files.map((file, index) => (
                <button
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  type="button"
                  onClick={() => selectImage(index)}
                  className={`overflow-hidden rounded-lg border-2 ${
                    index === currentIndex
                      ? "border-primary"
                      : "border-transparent"
                  }`}
                  title={file.name}
                >
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={removeCurrent}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Remove Current
            </button>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Clear All
            </button>
          </div>

          {/* File list */}
          <div className="rounded-xl border">
            <div className="border-b px-4 py-3 text-sm font-semibold">
              Selected Images ({files.length})
            </div>

            <div className="max-h-56 overflow-y-auto">
              {files.map((file, index) => (
                <button
                  key={`${file.name}-${file.size}-${file.lastModified}-list`}
                  type="button"
                  onClick={() => selectImage(index)}
                  className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 ${
                    index === currentIndex
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <img
                    src={previews[index]}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {file.name}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {index + 1} of {files.length}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
