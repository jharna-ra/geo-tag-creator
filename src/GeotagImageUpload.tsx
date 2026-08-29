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

  onChange: (
    file: File | null,
  ) => void;

  onFilesChange?: (
    files: File[],
  ) => void;
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
      imageFile
        ? [imageFile]
        : [],
    );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [previewUrls, setPreviewUrls] =
    useState<string[]>([]);

  useEffect(() => {
    if (imageFile) {
      setFiles((previous) => {
        if (
          previous.length === 1 &&
          previous[0] === imageFile
        ) {
          return previous;
        }

        return [
          imageFile,
        ];
      });

      setCurrentIndex(0);
    } else if (!imageUrl) {
      setFiles([]);
      setCurrentIndex(0);
    }
  }, [
    imageFile,
    imageUrl,
  ]);

  useEffect(() => {
    const urls =
      files.map(
        (file) =>
          URL.createObjectURL(
            file,
          ),
      );

    setPreviewUrls(urls);

    return () => {
      urls.forEach(
        (url) =>
          URL.revokeObjectURL(
            url,
          ),
      );
    };
  }, [files]);

  const currentFile =
    files[currentIndex] ??
    null;

  const currentPreview =
    previewUrls[currentIndex] ??
    imageUrl ??
    null;

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
        "Please upload image files.",
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

      const combined = [
        ...previous,
        ...newFiles,
      ];

      onFilesChange?.(
        combined,
      );

      if (
        previous.length ===
          0 &&
        newFiles.length
      ) {
        onChange(
          newFiles[0],
        );
      }

      return combined;
    });
  };

  const handleChange = (
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

    onChange(
      files[index],
    );
  };

  const nextImage = () => {
    if (files.length <= 1)
      return;

    const index =
      currentIndex >=
      files.length - 1
        ? 0
        : currentIndex + 1;

    selectImage(index);
  };

  const previousImage = () => {
    if (files.length <= 1)
      return;

    const index =
      currentIndex <= 0
        ? files.length - 1
        : currentIndex - 1;

    selectImage(index);
  };

  const removeCurrent = () => {
    const updated =
      files.filter(
        (_, index) =>
          index !==
          currentIndex,
      );

    setFiles(updated);
    onFilesChange?.(
      updated,
    );

    if (!updated.length) {
      setCurrentIndex(0);
      onChange(null);
      return;
    }

    const index =
      Math.min(
        currentIndex,
        updated.length - 1,
      );

    setCurrentIndex(index);
    onChange(
      updated[index],
    );
  };

  const clearAll = () => {
    setFiles([]);
    setCurrentIndex(0);
    onChange(null);
    onFilesChange?.([]);

    if (inputRef.current) {
      inputRef.current.value =
        "";
    }

    if (
      folderInputRef.current
    ) {
      folderInputRef.current.value =
        "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Upload Geotag Images
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleChange}
        />

        <input
          ref={folderInputRef}
          type="file"
          accept="image/*"
          multiple
          // @ts-expect-error Chromium support
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleChange}
        />

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

        {!files.length && (
          <div className="rounded-xl border-2 border-dashed p-8 text-center">
            <p className="text-sm">
              Upload one image, multiple
              images, or an entire folder.
            </p>
          </div>
        )}

        {files.length > 0 && (
          <>
            <div className="overflow-hidden rounded-xl border bg-black">
              {currentPreview && (
                <img
                  src={currentPreview}
                  alt={
                    currentFile?.name ??
                    "Image"
                  }
                  className="max-h-[550px] w-full object-contain"
                />
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">
                Current image
              </div>

              <div className="truncate font-medium">
                {currentFile?.name}
              </div>

              <div className="text-xs text-muted-foreground">
                Image{" "}
                {currentIndex + 1}{" "}
                of {files.length}
              </div>
            </div>

            {files.length > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={
                    previousImage
                  }
                >
                  ← Previous
                </Button>

                <span className="text-xs">
                  {currentIndex + 1} /{" "}
                  {files.length}
                </span>

                <Button
                  onClick={
                    nextImage
                  }
                >
                  Save & Next →
                </Button>
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
                    >
                      <img
                        src={
                          previewUrls[
                            index
                          ]
                        }
                        alt={
                          file.name
                        }
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ),
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={
                  removeCurrent
                }
              >
                Remove Current
              </Button>

              <Button
                variant="outline"
                onClick={
                  clearAll
                }
              >
                Clear All
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
