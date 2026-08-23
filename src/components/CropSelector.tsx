import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CropRect } from "@/types/video";

interface CropSelectorProps {
  videoWidth: number;
  videoHeight: number;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
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
  crop,
  onChange,
}: CropSelectorProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [dragMode, setDragMode] =
    useState<DragMode>(null);

  const dragStart =
    useRef<DragStart | null>(null);

  const getRelativePosition =
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
          x: Math.max(
            0,
            Math.min(
              1,
              (event.clientX -
                rect.left) /
                rect.width,
            ),
          ),

          y: Math.max(
            0,
            Math.min(
              1,
              (event.clientY -
                rect.top) /
                rect.height,
            ),
          ),
        };
      },
      [],
    );

  const clamp = (
    value: number,
    min: number,
    max: number,
  ) =>
    Math.min(
      max,
      Math.max(min, value),
    );

  const startDrag = (
    event: React.PointerEvent,
    mode: DragMode,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const point =
      getRelativePosition(event);

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
      (event: PointerEvent) => {
        if (
          !dragMode ||
          !dragStart.current
        ) {
          return;
        }

        const point =
          getRelativePosition(event);

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

        const right =
          base.x + base.width;

        const bottom =
          base.y + base.height;

        let next: CropRect = {
          ...base,
        };

        /* MOVE */

        if (dragMode === "move") {
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

        /* NORTH-WEST */

        if (dragMode === "nw") {
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

        /* NORTH */

        if (dragMode === "n") {
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

        /* NORTH-EAST */

        if (dragMode === "ne") {
          const newY =
            clamp(
              base.y + dy,
              0,
              bottom - MIN_CROP,
            );

          const newRight =
            clamp(
              right + dx,
              base.x + MIN_CROP,
              1,
            );

          next.y = newY;
          next.height =
            bottom - newY;
          next.width =
            newRight - base.x;
        }

        /* WEST */

        if (dragMode === "w") {
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

        /* EAST */

        if (dragMode === "e") {
          const newRight =
            clamp(
              right + dx,
              base.x + MIN_CROP,
              1,
            );

          next.width =
            newRight - base.x;
        }

        /* SOUTH-WEST */

        if (dragMode === "sw") {
          const newX =
            clamp(
              base.x + dx,
              0,
              right - MIN_CROP,
            );

          const newBottom =
            clamp(
              bottom + dy,
              base.y + MIN_CROP,
              1,
            );

          next.x = newX;
          next.width =
            right - newX;
          next.height =
            newBottom - base.y;
        }

        /* SOUTH */

        if (dragMode === "s") {
          const newBottom =
            clamp(
              bottom + dy,
              base.y + MIN_CROP,
              1,
            );

          next.height =
            newBottom - base.y;
        }

        /* SOUTH-EAST */

        if (dragMode === "se") {
          const newRight =
            clamp(
              right + dx,
              base.x + MIN_CROP,
              1,
            );

          const newBottom =
            clamp(
              bottom + dy,
              base.y + MIN_CROP,
              1,
            );

          next.width =
            newRight - base.x;

          next.height =
            newBottom - base.y;
        }

        onChange({
          x: clamp(
            next.x,
            0,
            1,
          ),
          y: clamp(
            next.y,
            0,
            1,
          ),
          width: clamp(
            next.width,
            MIN_CROP,
            1,
          ),
          height: clamp(
            next.height,
            MIN_CROP,
            1,
          ),
        });
      },
      [
        dragMode,
        getRelativePosition,
        onChange,
      ],
    );

  useEffect(() => {
    if (!dragMode) {
      return;
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );
    };
  }, [
    dragMode,
    handlePointerMove,
  ]);

  useEffect(() => {
    const stopDragging = () => {
      setDragMode(null);
      dragStart.current = null;
    };

    window.addEventListener(
      "pointerup",
      stopDragging,
    );

    return () => {
      window.removeEventListener(
        "pointerup",
        stopDragging,
      );
    };
  }, []);

  const handleClass =
    "absolute z-30 h-3 w-3 rounded-full border-2 border-white bg-black shadow cursor-pointer";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 touch-none"
    >
      {/* Outside darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "rgba(0,0,0,0.55)",
          clipPath: `polygon(
            0 0,
            100% 0,
            100% 100%,
            0 100%,
            0 0,
            ${crop.x * 100}% ${crop.y * 100}%,
            ${crop.x * 100}% ${(crop.y + crop.height) * 100}%,
            ${(crop.x + crop.width) * 100}% ${(crop.y + crop.height) * 100}%,
            ${(crop.x + crop.width) * 100}% ${crop.y * 100}%,
            ${crop.x * 100}% ${crop.y * 100}%
          )`,
          clipRule: "evenodd",
        }}
      />

      {/* Crop rectangle */}
      <div
        className="absolute z-20 border-2 border-white"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
        }}
        onPointerDown={(event) =>
          startDrag(
            event,
            "move",
          )
        }
      >
        {/* Grid */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-0 h-full border-l border-white/40" />
          <div className="absolute left-2/3 top-0 h-full border-l border-white/40" />
          <div className="absolute top-1/3 left-0 w-full border-t border-white/40" />
          <div className="absolute top-2/3 left-0 w-full border-t border-white/40" />
        </div>

        {/* NW */}
        <div
          className={`${handleClass} -left-2 -top-2 cursor-nwse-resize`}
          onPointerDown={(event) =>
            startDrag(event, "nw")
          }
        />

        {/* N */}
        <div
          className={`${handleClass} left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize`}
          onPointerDown={(event) =>
            startDrag(event, "n")
          }
        />

        {/* NE */}
        <div
          className={`${handleClass} -right-2 -top-2 cursor-nesw-resize`}
          onPointerDown={(event) =>
            startDrag(event, "ne")
          }
        />

        {/* W */}
        <div
          className={`${handleClass} -left-2 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          onPointerDown={(event) =>
            startDrag(event, "w")
          }
        />

        {/* E */}
        <div
          className={`${handleClass} -right-2 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          onPointerDown={(event) =>
            startDrag(event, "e")
          }
        />

        {/* SW */}
        <div
          className={`${handleClass} -bottom-2 -left-2 cursor-nesw-resize`}
          onPointerDown={(event) =>
            startDrag(event, "sw")
          }
        />

        {/* S */}
        <div
          className={`${handleClass} -bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize`}
          onPointerDown={(event) =>
            startDrag(event, "s")
          }
        />

        {/* SE */}
        <div
          className={`${handleClass} -bottom-2 -right-2 cursor-nwse-resize`}
          onPointerDown={(event) =>
            startDrag(event, "se")
          }
        />
      </div>
    </div>
  );
}
