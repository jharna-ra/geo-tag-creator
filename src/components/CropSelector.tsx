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

const MIN_CROP = 0.03;

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

  /*
   * Keep the component aware of the real video
   * aspect ratio. This is important for the
   * gallery-style rectangular crop.
   */
  const videoAspect =
    videoHeight > 0
      ? videoWidth / videoHeight
      : 1;

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
      Math.max(
        min,
        value,
      ),
    );

  const startDrag = (
    event: React.PointerEvent,
    mode: DragMode,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const point =
      getRelativePosition(
        event,
      );

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
      // Pointer capture is optional.
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
          getRelativePosition(
            event,
          );

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
          base.x +
          base.width;

        const bottom =
          base.y +
          base.height;

        let next: CropRect = {
          ...base,
        };

        /*
         * MOVE
         */
        if (
          dragMode ===
          "move"
        ) {
          next.x =
            clamp(
              base.x + dx,
              0,
              1 -
                base.width,
            );

          next.y =
            clamp(
              base.y + dy,
              0,
              1 -
                base.height,
            );
        }

        /*
         * NORTH-WEST
         */
        if (
          dragMode ===
          "nw"
        ) {
          const newX =
            clamp(
              base.x + dx,
              0,
              right -
                MIN_CROP,
            );

          const newY =
            clamp(
              base.y + dy,
              0,
              bottom -
                MIN_CROP,
            );

          next.x =
            newX;

          next.y =
            newY;

          next.width =
            right -
            newX;

          next.height =
            bottom -
            newY;
        }

        /*
         * NORTH
         */
        if (
          dragMode ===
          "n"
        ) {
          const newY =
            clamp(
              base.y + dy,
              0,
              bottom -
                MIN_CROP,
            );

          next.y =
            newY;

          next.height =
            bottom -
            newY;
        }

        /*
         * NORTH-EAST
         */
        if (
          dragMode ===
          "ne"
        ) {
          const newY =
            clamp(
              base.y + dy,
              0,
              bottom -
                MIN_CROP,
            );

          const newRight =
            clamp(
              right + dx,
              base.x +
                MIN_CROP,
              1,
            );

          next.y =
            newY;

          next.height =
            bottom -
            newY;

          next.width =
            newRight -
            base.x;
        }

        /*
         * WEST
         */
        if (
          dragMode ===
          "w"
        ) {
          const newX =
            clamp(
              base.x + dx,
              0,
              right -
                MIN_CROP,
            );

          next.x =
            newX;

          next.width =
            right -
            newX;
        }

        /*
         * EAST
         */
        if (
          dragMode ===
          "e"
        ) {
          const newRight =
            clamp(
              right + dx,
              base.x +
                MIN_CROP,
              1,
            );

          next.width =
            newRight -
            base.x;
        }

        /*
         * SOUTH-WEST
         */
        if (
          dragMode ===
          "sw"
        ) {
          const newX =
            clamp(
              base.x + dx,
              0,
              right -
                MIN_CROP,
            );

          const newBottom =
            clamp(
              bottom + dy,
              base.y +
                MIN_CROP,
              1,
            );

          next.x =
            newX;

          next.width =
            right -
            newX;

          next.height =
            newBottom -
            base.y;
        }

        /*
         * SOUTH
         */
        if (
          dragMode ===
          "s"
        ) {
          const newBottom =
            clamp(
              bottom + dy,
              base.y +
                MIN_CROP,
              1,
            );

          next.height =
            newBottom -
            base.y;
        }

        /*
         * SOUTH-EAST
         */
        if (
          dragMode ===
          "se"
        ) {
          const newRight =
            clamp(
              right + dx,
              base.x +
                MIN_CROP,
              1,
            );

          const newBottom =
            clamp(
              bottom + dy,
              base.y +
                MIN_CROP,
              1,
            );

          next.width =
            newRight -
            base.x;

          next.height =
            newBottom -
            base.y;
        }

        /*
         * Final safety clamp.
         */
        const safeWidth =
          clamp(
            next.width,
            MIN_CROP,
            1,
          );

        const safeHeight =
          clamp(
            next.height,
            MIN_CROP,
            1,
          );

        const safeX =
          clamp(
            next.x,
            0,
            1 -
              safeWidth,
          );

        const safeY =
          clamp(
            next.y,
            0,
            1 -
              safeHeight,
          );

        onChange({
          x: safeX,
          y: safeY,
          width: safeWidth,
          height: safeHeight,
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
    const stopDragging =
      () => {
        setDragMode(null);
        dragStart.current =
          null;
      };

    window.addEventListener(
      "pointerup",
      stopDragging,
    );

    window.addEventListener(
      "pointercancel",
      stopDragging,
    );

    return () => {
      window.removeEventListener(
        "pointerup",
        stopDragging,
      );

      window.removeEventListener(
        "pointercancel",
        stopDragging,
      );
    };
  }, []);

  /*
   * Prevent accidental browser dragging/
   * selection while manipulating the crop.
   */
  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) {
      return;
    }

    const previous =
      element.style.touchAction;

    element.style.touchAction =
      "none";

    return () => {
      element.style.touchAction =
        previous;
    };
  }, []);

  /*
   * The actual video aspect ratio is retained
   * here so the crop overlay remains rectangular
   * and predictable for portrait/landscape videos.
   */
  void videoAspect;

  const handleClass =
    [
      "absolute",
      "z-40",
      "h-3.5",
      "w-3.5",
      "rounded-full",
      "border-2",
      "border-white",
      "bg-black",
      "shadow-lg",
      "cursor-pointer",
      "touch-none",
    ].join(" ");

  const left =
    crop.x * 100;

  const top =
    crop.y * 100;

  const width =
    crop.width * 100;

  const height =
    crop.height * 100;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 overflow-hidden select-none touch-none"
      style={{
        userSelect: "none",
        WebkitUserSelect:
          "none",
        WebkitTouchCallout:
          "none",
      }}
    >
      {/* =================================================
          OUTSIDE DARKENING
      ================================================= */}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "rgba(0,0,0,0.58)",

          clipPath:
            `polygon(
              0 0,
              100% 0,
              100% 100%,
              0 100%,
              0 0,
              ${left}% ${top}%,
              ${left}% ${top + height}%,
              ${left + width}% ${top + height}%,
              ${left + width}% ${top}%,
              ${left}% ${top}%
            )`,

          clipRule:
            "evenodd",
        }}
      />

      {/* =================================================
          CROP RECTANGLE
      ================================================= */}

      <div
        className="absolute z-30 border-2 border-white bg-transparent"
        style={{
          left:
            `${left}%`,
          top:
            `${top}%`,
          width:
            `${width}%`,
          height:
            `${height}%`,
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.35)",
          touchAction:
            "none",
        }}
        onPointerDown={(
          event,
        ) =>
          startDrag(
            event,
            "move",
          )
        }
      >
        {/* =================================================
            GALLERY-STYLE GRID
        ================================================= */}

        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/3 top-0 h-full border-l border-white/45"
          />

          <div
            className="absolute left-2/3 top-0 h-full border-l border-white/45"
          />

          <div
            className="absolute top-1/3 left-0 w-full border-t border-white/45"
          />

          <div
            className="absolute top-2/3 left-0 w-full border-t border-white/45"
          />
        </div>

        {/* =================================================
            CORNER HANDLES
        ================================================= */}

        <div
          className={`${handleClass} -left-2 -top-2 cursor-nwse-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "nw",
            )
          }
        />

        <div
          className={`${handleClass} -right-2 -top-2 cursor-nesw-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "ne",
            )
          }
        />

        <div
          className={`${handleClass} -left-2 -bottom-2 cursor-nesw-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "sw",
            )
          }
        />

        <div
          className={`${handleClass} -right-2 -bottom-2 cursor-nwse-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "se",
            )
          }
        />

        {/* =================================================
            EDGE HANDLES
        ================================================= */}

        <div
          className={`${handleClass} left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "n",
            )
          }
        />

        <div
          className={`${handleClass} -right-2 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "e",
            )
          }
        />

        <div
          className={`${handleClass} left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "s",
            )
          }
        />

        <div
          className={`${handleClass} -left-2 top-1/2 -translate-y-1/2 cursor-ew-resize`}
          onPointerDown={(
            event,
          ) =>
            startDrag(
              event,
              "w",
            )
          }
        />

        {/* =================================================
            CENTER MOVE INDICATOR
        ================================================= */}

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-black/30 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity"
        >
          Move
        </div>
      </div>
    </div>
  );
}
