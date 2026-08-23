import { useRef, useState, useCallback } from "react";

interface CropRect {
  x: number; // 0–1, fraction of video width
  y: number; // 0–1, fraction of video height
  width: number; // 0–1
  height: number; // 0–1
}

interface CropSelectorProps {
  videoWidth: number;
  videoHeight: number;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
}

export function CropSelector({ videoWidth, videoHeight, crop, onChange }: CropSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<null | "move" | "resize">(null);
  const dragStart = useRef({ x: 0, y: 0, crop });

  const getRelativePos = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDownMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDragMode("move");
    dragStart.current = { ...getRelativePos(e), crop };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerDownResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDragMode("resize");
    dragStart.current = { ...getRelativePos(e), crop };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode) return;
      const pos = getRelativePos(e);
      const dx = pos.x - dragStart.current.x;
      const dy = pos.y - dragStart.current.y;
      const base = dragStart.current.crop;

      if (dragMode === "move") {
        const newX = Math.min(Math.max(base.x + dx, 0), 1 - base.width);
        const newY = Math.min(Math.max(base.y + dy, 0), 1 - base.height);
        onChange({ ...base, x: newX, y: newY });
      } else if (dragMode === "resize") {
        const newW = Math.min(Math.max(base.width + dx, 0.1), 1 - base.x);
        const newH = Math.min(Math.max(base.height + dy, 0.1), 1 - base.y);
        onChange({ ...base, width: newW, height: newH });
      }
    },
    [dragMode, onChange],
  );

  const onPointerUp = () => setDragMode(null);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Dark overlay outside crop area */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      {/* Crop rectangle */}
      <div
        className="absolute border-2 border-white cursor-move"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
        }}
        onPointerDown={onPointerDownMove}
      >
        {/* Resize handle, bottom-right corner */}
        <div
          className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border border-gray-400 rounded-full cursor-nwse-resize"
          onPointerDown={onPointerDownResize}
        />
      </div>
    </div>
  );
}
