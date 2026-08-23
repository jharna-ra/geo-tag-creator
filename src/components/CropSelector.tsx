import {
  useCallback,
  useRef,
  useState,
} from "react";

import type { CropRect } from "@/lib/crop";

interface CropSelectorProps {
  videoWidth: number;

  videoHeight: number;

  crop: CropRect;

  onChange: (
    crop: CropRect,
  ) => void;
}

type DragMode =
  | "move"
  | "nw"
  | "n"
  | "ne"
  | "w"
  | "e"
  | "sw"
  | "s"
  | "se"
  | null;

interface Point {
  x: number;
  y: number;
}

interface DragStart {
  point: Point;
  crop: CropRect;
}

const MIN_CROP = 0.05;

export function CropSelector({
  videoWidth,
  videoHeight,
  crop,
  onChange,
}: CropSelectorProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [dragMode, setDragMode] =
    useState<DragMode>(null);

  const dragStart =
    useRef<DragStart | null>(null);

  const getRelativePos =
    useCallback(
      (
        event:
          | React.PointerEvent
          | PointerEvent,
      ): Point | null => {
        const container =
          containerRef.current;

        if (!container) {
          return null;
        }

        const rect =
          container.getBoundingClientRect();

        if (
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          return null;
        }

        return {
          x:
            (event.clientX -
              rect.left) /
            rect.width,

          y:
            (event.clientY -
              rect.top) /
            rect.height,
        };
      },
      [],
    );

  const clamp = (
    value: number,
    min: number,
    max: number,
  ) => {
    return Math.min(
      max,
      Math.max(min, value),
    );
  };

  const startDrag = (
    event: React.PointerEvent,
    mode: DragMode,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const point =
      getRelativePos(event);

    if (!point) {
      return;
    }

    dragStart.current = {
      point,

      crop: {
        ...crop,
      },
    };

    setDragMode(mode);

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId,
      );
    } catch {
      // Ignore pointer capture errors.
    }
  };

  const handlePointerMove =
    useCallback(
      (event: React.PointerEvent) => {
        if (
          !dragMode ||
          !dragStart.current
        ) {
          return;
        }

        const point =
          getRelativePos(event);

        if (!point) {
          return;
        }

        const start =
          dragStart.current;

        const base =
          start.crop;

        const dx =
          point.x -
          start.point.x;

        const dy =
          point.y -
          start.point.y;

        let next: CropRect = {
          ...base,
        };

        /*
         * MOVE
         */
        if (
          dragMode === "move"
        ) {
          next.x = clamp(
            base.x + dx,
            0,
            1 - base.width,
          );

          next.y = clamp(
            base.y + dy,
            0,
            1 - base.height,
          );
        }

        /*
         * NORTH-WEST
         */
        if (
          dragMode === "nw"
        ) {
          const right =
            base.x +
            base.width;

          const bottom =
            base.y +
            base.height;

          const newX =
            clamp(
              base.x + dx,
              0,
              right - MIN_CROP,
            );

          const newY =
            clamp(
              base.y + dy,
              0,
              bottom - MIN_CROP,
            );

          next.x = newX;

          next.y = newY;

          next.width =
            right - newX;

          next.height =
            bottom - newY;
        }

        /*
         * NORTH
         */
        if (
          dragMode === "n"
        ) {
          const bottom =
            base.y +
            base.height;

          const newY =
            clamp(
              base.y + dy,
              0,
              bottom - MIN_CROP,
            );

          next.y = newY;

          next.height =
            bottom - newY;
        }

        /*
         * NORTH-EAST
         */
        if (
          dragMode === "ne"
        ) {
          const bottom =
            base.y +
            base.height;

          const newWidth =
            clamp(
              base.width + dx,
              MIN_CROP,
              1 - base.x,
            );

          const newY =
            clamp(
              base.y + dy,
              0,
              bottom - MIN_CROP,
            );

          next.width =
            newWidth;

          next.y = newY;

          next.height =
            bottom - newY;
        }

        /*
         * WEST
         */
        if (
          dragMode === "w"
        ) {
          const right =
            base.x +
            base.width;

          const newX =
            clamp(
              base.x + dx,
              0,
              right - MIN_CROP,
            );

          next.x = newX;

          next.width =
            right - newX;
        }

        /*
         * EAST
         */
        if (
          dragMode === "e"
        ) {
          next.width =
            clamp(
              base.width + dx,
              MIN_CROP,
              1 - base.x,
            );
        }

        /*
         * SOUTH-WEST
         */
        if (
          dragMode === "sw"
        ) {
          const right =
            base.x +
            base.width;

          const newX =
            clamp(
              base.x + dx,
              0,
              right - MIN_CROP,
            );

          const newHeight =
            clamp(
              base.height + dy,
              MIN_CROP,
              1 - base.y,
            );

          next.x = newX;

          next.width =
            right - newX;

          next.height =
            newHeight;
        }

        /*
         * SOUTH
         */
        if (
          dragMode === "s"
        ) {
          next.height =
            clamp(
              base.height + dy,
              MIN_CROP,
              1 - base.y,
            );
        }

        /*
         * SOUTH-EAST
         */
        if (
          dragMode === "se"
        ) {
          next.width =
            clamp(
              base.width + dx,
              MIN_CROP,
              1 - base.x,
            );

          next.height =
            clamp(
              base.height + dy,
              MIN_CROP,
              1 - base.y,
            );
        }

        onChange(next);
      },
      [
        dragMode,
        getRelativePos,
        onChange,
      ],
    );

  const stopDrag = () => {
    setDragMode(null);

    dragStart.current =
      null;
  };

  const handleClass =
    "absolute z-30 h-4 w-4 rounded-full border-2 border-white bg-black shadow cursor-pointer";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 touch-none select-none"
      onPointerMove={
        handlePointerMove
      }
      onPointerUp={
        stopDrag
      }
      onPointerCancel={
        stopDrag
      }
    >
      {/* Dark area outside crop */}
      <div
        className="absolute inset-0 bg-black/60 pointer-events-none"
      />

      {/* Crop rectangle */}
      <div
        className="absolute border-2 border-white"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
          boxShadow:
            "0 0 0 9999px rgba(0,0,0,0.55)",
        }}
        onPointerDown={(event) =>
          startDrag(
            event,
            "move",
          )
        }
      >
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/40" />
          <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/40" />

          <div className="absolute top-1/3 left-0 right-0 border-t border-white/40" />
          <div className="absolute top-2/3 left-0 right-0 border-t border-white/40" />
        </div>

        {/* TOP LEFT */}
        <div
          className={`${handleClass} -left-2 -top-2 cursor-nwse-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "nw",
            )
          }
        />

        {/* TOP */}
        <div
          className={`${handleClass} left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "n",
            )
          }
        />

        {/* TOP RIGHT */}
        <div
          className={`${handleClass} -right-2 -top-2 cursor-nesw-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "ne",
            )
          }
        />

        {/* LEFT */}
        <div
          className={`${handleClass} -left-2 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "w",
            )
          }
        />

        {/* RIGHT */}
        <div
          className={`${handleClass} -right-2 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "e",
            )
          }
        />

        {/* BOTTOM LEFT */}
        <div
          className={`${handleClass} -bottom-2 -left-2 cursor-nesw-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "sw",
            )
          }
        />

        {/* BOTTOM */}
        <div
          className={`${handleClass} -bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "s",
            )
          }
        />

        {/* BOTTOM RIGHT */}
        <div
          className={`${handleClass} -bottom-2 -right-2 cursor-nwse-resize`}
          onPointerDown={(event) =>
            startDrag(
              event,
              "se",
            )
          }
        />

        {/* Label */}
        <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-xs text-white pointer-events-none">
          {Math.round(
            crop.width * 100,
          )}
          % ×{" "}
          {Math.round(
            crop.height * 100,
          )}
          %
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-md bg-black/80 px-3 py-2 text-xs text-white pointer-events-none whitespace-nowrap">
        Drag inside to move • Drag handles to resize
      </div>
    </div>
  );
}
