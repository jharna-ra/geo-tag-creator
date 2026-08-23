import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  imageUrl: string | null;
  imageFile: File | null;
  onChange: (file: File | null) => void;
}

export function GeotagImageUpload({
  imageUrl,
  imageFile,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(imageUrl);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile, imageUrl]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    onChange(file);
  };

  const removeImage = () => {
    onChange(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Geotag Image</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        {!previewUrl ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              Upload the geotag image that you want to place on your videos.
            </p>

            <Button onClick={() => inputRef.current?.click()}>
              Choose Geotag Image
            </Button>

            <p className="mt-3 text-xs text-muted-foreground">
              PNG, JPG or WebP
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border bg-black">
              <img
                src={previewUrl}
                alt="Uploaded geotag"
                className="max-h-72 w-full object-contain"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                Replace Image
              </Button>

              <Button
                variant="destructive"
                onClick={removeImage}
              >
                Remove Image
              </Button>
            </div>

            {imageFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {imageFile.name}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              This exact uploaded image will be used as the video overlay.
              No new geotag image will be generated.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
