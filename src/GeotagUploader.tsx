import {
  useEffect,
  useRef,
  useState,
} from "react";

interface GeotagUploaderProps {
  onImageSelected: (
    file: File | null,
  ) => void;

  onImagesSelected?: (
    files: File[],
  ) => void;
}

export default function GeotagUploader({
  onImageSelected,
  onImagesSelected,
}: GeotagUploaderProps) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const folderInputRef =
    useRef<HTMLInputElement>(null);

  const [files, setFiles] =
    useState<File[]>([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [previews, setPreviews] =
    useState<string[]>([]);

  const currentFile =
    files[currentIndex] ?? null;

  useEffect(() => {
    const urls = files.map(
      (file) =>
        URL.createObjectURL(file),
    );

    setPreviews(urls);

    return () => {
      urls.forEach((url) =>
        URL.revokeObjectURL(url),
      );
    };
  }, [files]);

  useEffect(() => {
    onImageSelected(
      currentFile,
    );
  }, [
    currentFile,
    onImageSelected,
  ]);

  useEffect(() => {
    onImagesSelected?.(files);
  }, [
    files,
    onImagesSelected,
  ]);

  const addFiles = (
    selected: File[],
  ) => {
    const images =
      selected.filter(
        (file) =>
          file.type.startsWith(
            "image/",
          ),
      );

    if (!images.length) {
      alert(
        "Please select image files.",
      );
      return;
    }

    setFiles((previous) => {
      const existing =
        new Set(
          previous.map(
            (file) =>
              `${file.name}-${file.size}-${file.lastModified}`,
          ),
        );

      const newFiles =
        images.filter(
          (file) =>
            !existing.has(
              `${file.name}-${file.size}-${file.lastModified}`,
            ),
        );

      return [
        ...previous,
        ...newFiles,
      ];
    });
  };

  const handleFiles = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    addFiles(
      Array.from(
        event.target.files ?? [],
      ),
    );

    event.target.value = "";
  };

  const selectImage = (
    index: number,
  ) => {
    if (
      index < 0 ||
      index >= files.length
    ) {
      return;
    }

    setCurrentIndex(index);
  };

  const previousImage = () => {
    if (!files.length) return;

    setCurrentIndex(
      (index) =>
        index <= 0
          ? files.length - 1
          : index - 1,
    );
  };

  const nextImage = () => {
    if (!files.length) return;

    setCurrentIndex(
      (index) =>
        index >=
        files.length - 1
          ? 0
          : index + 1,
    );
  };

  const removeCurrent = () => {
    setFiles((previous) => {
      const next =
        previous.filter(
          (_, index) =>
            index !==
            currentIndex,
        );

      return next;
    });

    setCurrentIndex(
      (index) =>
        Math.max(
          0,
          Math.min(
            index,
            files.length - 2,
          ),
        ),
    );
  };

  const clearAll = () => {
    setFiles([]);
    setCurrentIndex(0);
    onImageSelected(null);
  };

  const preview =
    previews[currentIndex] ??
    null;

  return (
    <div className="space-y-5 rounded-2xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Upload Images
        </h2>

        <p className="text-sm text-muted-foreground">
          Choose one image, several images,
          or an entire folder.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error Chromium directory support
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Choose Images
        </button>

        <button
          type="button"
          onClick={() =>
            folderInputRef.current?.click()
          }
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Choose Folder
        </button>
      </div>

      {!files.length && (
        <div className="rounded-xl border-2 border-dashed p-10 text-center">
          <p className="font-medium">
            No images selected
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            Upload images or choose a folder.
          </p>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border bg-black">
            {preview && (
              <img
                src={preview}
                alt={
                  currentFile?.name ??
                  "Selected image"
                }
                className="max-h-[600px] w-full object-contain"
              />
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
              Current image
            </div>

            <div className="mt-1 truncate text-sm font-semibold">
              {currentFile?.name}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Image {currentIndex + 1} of{" "}
              {files.length}
            </div>
          </div>

          {files.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={
                  previousImage
                }
                className="rounded-lg border px-4 py-2 text-sm"
              >
                ← Previous
              </button>

              <span className="text-xs">
                {currentIndex + 1} /{" "}
                {files.length}
              </span>

              <button
                type="button"
                onClick={
                  nextImage
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Save & Next →
              </button>
            </div>
          )}

          {files.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {files.map(
                (
                  file,
                  index,
                ) => (
                  <button
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    type="button"
                    onClick={() =>
                      selectImage(
                        index,
                      )
                    }
                    className={`overflow-hidden rounded-lg border-2 ${
                      index ===
                      currentIndex
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                    title={file.name}
                  >
                    <img
                      src={
                        previews[
                          index
                        ]
                      }
                      alt={file.name}
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                ),
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={
                removeCurrent
              }
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
        </>
      )}
    </div>
  );
}
