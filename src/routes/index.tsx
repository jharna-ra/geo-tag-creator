import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LocationForm } from "@/components/LocationForm";
import { GeotagPreview } from "@/components/GeotagPreview";
import { VideoCard } from "@/components/VideoCard";
import { renderGeotag, renderGeotagBlob } from "@/lib/geotagRenderer";
import { computeTiming, processVideo } from "@/lib/videoProcessor";
import { downloadBlob, outputName, probeVideo } from "@/lib/videoUtils";
import { DEFAULT_OPTIONS, EMPTY_DATA, type GeotagData, type GeotagOptions } from "@/types/geotag";
import { DEFAULT_SETTINGS, type VideoItem, type VideoSettings } from "@/types/video";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GeoTag Video Generator — Burn GPS Overlays Into Videos" },
      {
        name: "description",
        content:
          "Add a GPS location geotag with satellite map, address, coordinates and date to your videos. Trim, choose overlay duration and download the MP4 — all in your browser.",
      },
      { property: "og:title", content: "GeoTag Video Generator" },
      {
        property: "og:description",
        content:
          "Generate professional GPS location overlays for your videos, processed locally in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const MAX_VIDEOS = 6;

function Index() {
  const [data, setData] = useState<GeotagData>(EMPTY_DATA);
  const [options, setOptions] = useState<GeotagOptions>(DEFAULT_OPTIONS);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [queueLabel, setQueueLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const patchData = useCallback((p: Partial<GeotagData>) => setData((d) => ({ ...d, ...p })), []);
  const patchOptions = useCallback((p: Partial<GeotagOptions>) => setOptions((o) => ({ ...o, ...p })), []);

  // Keep a PNG data URL of the geotag for the live video previews.
  useEffect(() => {
    let cancelled = false;
    renderGeotag(data, options, 900).then(({ canvas }) => {
      if (!cancelled) setOverlayUrl(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [data, options]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_VIDEOS - videos.length;
    if (room <= 0) {
      toast.error(`You can work with up to ${MAX_VIDEOS} videos at a time.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    for (const file of picked) {
      const url = URL.createObjectURL(file);
      try {
        const meta = await probeVideo(url);
        if (!meta.duration) throw new Error("Could not read this video's duration.");
        setVideos((v) => [
          ...v,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            file,
            url,
            name: file.name,
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            settings: DEFAULT_SETTINGS(meta.duration),
            status: "idle",
            progress: 0,
          },
        ]);
      } catch (e) {
        URL.revokeObjectURL(url);
        toast.error(
          e instanceof Error ? e.message : "This video format is not supported by your browser.",
        );
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateSettings = (id: string, patch: Partial<VideoSettings>) =>
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, settings: { ...v.settings, ...patch } } : v)));

  const applyToAll = (id: string) => {
    const src = videos.find((v) => v.id === id);
    if (!src) return;
    setVideos((vs) =>
      vs.map((v) =>
        v.id === id
          ? v
          : {
              ...v,
              settings: {
                ...src.settings,
                trimStart: Math.min(src.settings.trimStart, v.duration),
                trimEnd: Math.min(src.settings.trimEnd, v.duration),
              },
            },
      ),
    );
    toast.success("Settings applied to all videos.");
  };

  const removeVideo = (id: string) =>
    setVideos((vs) => {
      const target = vs.find((v) => v.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        if (target.outputUrl) URL.revokeObjectURL(target.outputUrl);
      }
      return vs.filter((v) => v.id !== id);
    });

  const clearAll = () => {
    if (!videos.length) return;
    if (!window.confirm("Remove all videos and generated files from this session?")) return;
    videos.forEach((v) => {
      URL.revokeObjectURL(v.url);
      if (v.outputUrl) URL.revokeObjectURL(v.outputUrl);
    });
    setVideos([]);
    toast.success("Workspace cleared.");
  };

  const generate = async () => {
    if (!videos.length) {
      toast.error("Upload at least one video first.");
      return;
    }
    if (data.latitude == null || data.longitude == null) {
      toast.error("Set a location first — coordinates are required for the map.");
      return;
    }
    setRunning(true);
    const list = [...videos];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      setQueueLabel(`Processing ${i + 1} of ${list.length} — ${item.name}`);
      setVideos((vs) =>
        vs.map((v) => (v.id === item.id ? { ...v, status: "processing", progress: 0, error: undefined } : v)),
      );
      try {
        const overlayWidth = Math.max(600, Math.round((item.width || 1280) * item.settings.scale));
        const png = await renderGeotagBlob(data, options, overlayWidth);
        const blob = await processVideo({
          item,
          overlayPng: png,
          onProgress: (p) =>
            setVideos((vs) => vs.map((v) => (v.id === item.id ? { ...v, progress: p } : v))),
        });
        const url = URL.createObjectURL(blob);
        setVideos((vs) =>
          vs.map((v) =>
            v.id === item.id
              ? {
                  ...v,
                  status: "done",
                  progress: 100,
                  outputBlob: blob,
                  outputUrl: url,
                  outputName: outputName(v.name),
                }
              : v,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Processing failed.";
        setVideos((vs) => vs.map((v) => (v.id === item.id ? { ...v, status: "error", error: msg } : v)));
        toast.error(`${item.name}: ${msg}`);
      }
    }
    setQueueLabel("");
    setRunning(false);
    toast.success("Processing finished.");
  };

  const downloadAll = async () => {
    const done = videos.filter((v) => v.outputBlob);
    if (!done.length) return;
    const zip = new JSZip();
    done.forEach((v) => zip.file(v.outputName!, v.outputBlob!));
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "geotagged_videos.zip");
  };

  const readyCount = useMemo(() => videos.filter((v) => v.status === "done").length, [videos]);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">GeoTag Video Generator</h1>
          <p className="text-muted-foreground">
            Generate professional GPS location overlays for your videos.
          </p>
          <p className="text-sm text-muted-foreground">
            1. Location → 2. Geotag → 3. Upload Videos → 4. Edit → 5. Generate → 6. Download
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LocationForm data={data} onChange={patchData} />
          <GeotagPreview data={data} options={options} onOptions={patchOptions} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={running}>
                Choose Videos
              </Button>
              <Button variant="outline" onClick={clearAll} disabled={running || !videos.length}>
                Clear All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Up to {MAX_VIDEOS} videos (MP4, MOV, WebM). Your videos are processed locally in your browser
              and are not permanently stored — generated files exist only until you download them or refresh
              the page.
            </p>
          </CardContent>
        </Card>

        {videos.map((v, i) => (
          <VideoCard
            key={v.id}
            item={v}
            index={i}
            overlayUrl={overlayUrl}
            onUpdate={updateSettings}
            onRemove={removeVideo}
            onApplyToAll={applyToAll}
          />
        ))}

        {videos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button size="lg" onClick={generate} disabled={running}>
                {running ? "Processing…" : "Generate Geotagged Video"}
              </Button>
              {running && (
                <div className="space-y-2">
                  <p className="text-sm">{queueLabel}</p>
                  <Progress value={videos.find((v) => v.status === "processing")?.progress ?? 0} />
                  <p className="text-xs text-muted-foreground">
                    The video engine loads on first use; large videos can take a few minutes.
                  </p>
                </div>
              )}
              {readyCount > 1 && (
                <Button variant="secondary" onClick={downloadAll}>
                  Download All ({readyCount})
                </Button>
              )}
              {videos.some((v) => v.status === "done") && (
                <ul className="space-y-1 text-sm">
                  {videos
                    .filter((v) => v.status === "done")
                    .map((v) => (
                      <li key={v.id} className="flex items-center justify-between rounded border px-3 py-2">
                        <span>
                          {v.outputName} · final {computeTiming(v).finalDuration.toFixed(0)}s · geotag{" "}
                          {v.settings.percent}%
                        </span>
                        <Button size="sm" onClick={() => downloadBlob(v.outputBlob!, v.outputName!)}>
                          Download
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
