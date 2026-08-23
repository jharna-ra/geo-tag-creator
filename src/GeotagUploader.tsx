import { useEffect, useState } from "react";

interface GeotagUploaderProps {
  onImageSelected: (file: File | null) => void;
}

export default function GeotagUploader({
  onImageSelected,
}: GeotagUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;

    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      alert("Please select a PNG or JPG image.");
      return;
    }

    setFile(selected);
    onImageSelected(selected);
  };

  const removeImage = () => {
    setFile(null);
    setPreview(null);
    onImageSelected(null);
  };

  return (
    <div className="space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Upload Geotag Image
        </h2>

        <p className="text-sm text-muted-foreground">
          Upload the geotag image you want to place on your video.
        </p>
      </div>

      {!file ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8">
          <span className="mb-2 text-sm font-medium">
            Choose Geotag Image
          </span>

          <span className="text-xs text-muted-foreground">
            PNG, JPG or JPEG
          </span>

          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleChange}
          />
        </label>
      ) : (
        <div className="space-y-3">
          {preview && (
            <div className="overflow-hidden rounded-lg border">
              <img
                src={preview}
                alt="Uploaded geotag"
                className="max-h-64 w-full object-contain"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="truncate text-sm">
              {file.name}
            </span>

            <button
              type="button"
              onClick={removeImage}
              className="rounded-md border px-3 py-1 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
