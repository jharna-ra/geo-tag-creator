import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
   * ---------------------------------------------
   * GET POINTER POSITION
   * ---------------------------------------------
   *
   * Converts the mouse/touch position into
   * normalized coordinates from 0 to 1.
   */
  const getRelativePos = useCallback(
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

  /*
   * ---------------------------------------------
   * CLAMP
   * ---------------------------------------------
   */

  const clamp = (
    value: number,
    min: number,
    max: number,
  ) => {
    return Math.min(
      Math.max(value, min),
      max,
    );
  };

  /*
   * ---------------------------------------------
   * POINTER DOWN
   * ---------------------------------------------
   */

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

    /*
     * Capture pointer so dragging continues
     * even if the pointer leaves the handle.
     */
    try {
      event.currentTarget.setPointerCapture(
        event.pointerId,
      );
    } catch {
      // Ignore pointer capture errors.
    }
  };

  /*
   * ---------------------------------------------
   * HANDLE POINTER MOVE
   * ---------------------------------------------
   */

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

        let next = {
          ...base,
        };

        /*
         * =========================================
         * MOVE
         * =========================================
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
         * =========================================
         * NORTH-WEST
         * =========================================
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
         * =========================================
         * NORTH
         * =========================================
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
         * =========================================
         * NORTH-EAST
         * =========================================
         */

        if (
          dragMode === "ne"
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

          const newRight =
            clamp(
              base.x +
                base.width +
                dx,
              base.x +
                MIN_CROP,
              1,
            );

          next.y = newY;

          next.width =
            newRight -
            base.x;

          next.height =
            bottom - newY;
        }

        /*
         * =========================================
         * WEST
         * =========================================
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
         * =========================================
         * EAST
         * =========================================
         */

        if (
          dragMode === "e"
        ) {
          const newRight =
            clamp(
              base.x +
                base.width +
                dx,
              base.x +
                MIN_CROP,
              1,
            );

          next.width =
            newRight -
            base.x;
        }

        /*
         * =========================================
         * SOUTH-WEST
         * =========================================
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

          const newBottom =
            clamp(
              base.y +
                base.height +
                dy,
              base.y +
                MIN_CROP,
              1,
            );

          next.x = newX;

          next.width =
            right - newX;

          next.height =
            newBottom -
            base.y;
        }

        /*
         * =========================================
         * SOUTH
         * =========================================
         */

        if (
          dragMode === "s"
        ) {
          const newBottom =
            clamp(
              base.y +
                base.height +
                dy,
              base.y +
                MIN_CROP,
              1,
            );

          next.height =
            newBottom -
            base.y;
        }

        /*
         * =========================================
         * SOUTH-EAST
         * =========================================
         */

        if (
          dragMode === "se"
        ) {
          const newRight =
            clamp(
              base.x +
                base.width +
                dx,
              base.x +
                MIN_CROP,
              1,
            );

          const newBottom =
            clamp(
              base.y +
                base.height +
                dy,
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
         * =========================================
         * FINAL SAFETY
         * =========================================
         */

        next.x = clamp(
          next.x,
          0,
          1,
        );

        next.y = clamp(
          next.y,
          0,
          1,
        );

        next.width = clamp(
          next.width,
          MIN_CROP,
          1 - next.x,
        );

        next.height = clamp(
          next.height,
          MIN_CROP,
          1 - next.y,
        );

        onChange(next);
      },
      [
        dragMode,
        getRelativePos,
        onChange,
      ],
    );

  /*
   * ---------------------------------------------
   * POINTER UP
   * ---------------------------------------------
   */

  const stopDrag =
    useCallback(() => {
      setDragMode(null);

      dragStart.current =
        null;
    }, []);

  /*
   * ---------------------------------------------
   * GLOBAL POINTER EVENTS
   * ---------------------------------------------
   */

  useEffect(() => {
    if (!dragMode) {
      return;
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    window.addEventListener(
      "pointerup",
      stopDrag,
    );

    window.addEventListener(
      "pointercancel",
      stopDrag,
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      window.removeEventListener(
        "pointerup",
        stopDrag,
      );

      window.removeEventListener(
        "pointercancel",
        stopDrag,
      );
    };
  }, [
    dragMode,
    handlePointerMove,
    stopDrag,
  ]);

  /*
   * ---------------------------------------------
   * CROP DISPLAY VALUES
   * ---------------------------------------------
   */

  const left =
    crop.x * 100;

  const top =
    crop.y * 100;

  const width =
    crop.width * 100;

  const height =
    crop.height * 100;

  /*
   * Actual pixel dimensions
   */

  const cropPixelWidth =
    Math.round(
      crop.width *
        videoWidth,
    );

  const cropPixelHeight =
    Math.round(
      crop.height *
        videoHeight,
    );

  /*
   * ---------------------------------------------
   * HANDLE COMPONENT
   * ---------------------------------------------
   */

  const Handle = ({
    mode,
    className,
    cursor,
  }: {
    mode: DragMode;
    className: string;
    cursor: string;
  }) => (
    <div
      className={`absolute z-30 ${className}`}
      style={{
        cursor,
        touchAction: "none",
      }}
      onPointerDown={(event) =>
        startDrag(
          event,
          mode,
        )
      }
    />
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 select-none"
      style={{
        touchAction: "none",
      }}
    >
      {/* =========================================
          DARK AREA OUTSIDE CROP
      ========================================= */}

      <div className="pointer-events-none absolute inset-0 bg-black/55" />

      {/* =========================================
          CROP WINDOW
      ========================================= */}

      <div
        className="absolute border-2 border-white"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          touchAction: "none",
        }}
        onPointerDown={(event) =>
          startDrag(
            event,
            "move",
          )
        }
      >
        {/* =======================================
            GRID
        ======================================= */}

        <div className="pointer-events-none absolute inset-0">
          {/* Vertical 1 */}

          <div className="absolute left-1/3 top-0 h-full border-l border-white/40" />

          {/* Vertical 2 */}

          <div className="absolute left-2/3 top-0 h-full border-l border-white/40" />

          {/* Horizontal 1 */}

          <div className="absolute left-0 top-1/3 w-full border-t border-white/40" />

          {/* Horizontal 2 */}

          <div className="absolute left-0 top-2/3 w-full border-t border-white/40" />
        </div>

        {/* =======================================
            TOP EDGE
        ======================================= */}

        <Handle
          mode="n"
          className="left-3 right-3 -top-2 h-4"
          cursor="ns-resize"
        />

        {/* =======================================
            BOTTOM EDGE
        ======================================= */}

        <Handle
          mode="s"
          className="bottom-[-8px] left-3 right-3 h-4"
          cursor="ns-resize"
        />

        {/* =======================================
            LEFT EDGE
        ======================================= */}

        <Handle
          mode="w"
          className="bottom-3 left-[-8px] top-3 w-4"
          cursor="ew-resize"
        />

        {/* =======================================
            RIGHT EDGE
        ======================================= */}

        <Handle
          mode="e"
          className="bottom-3 right-[-8px] top-3 w-4"
          cursor="ew-resize"
        />

        {/* =======================================
            TOP LEFT
        ======================================= */}

        <Handle
          mode="nw"
          className="-left-2 -top-2 h-5 w-5 rounded-full border-2 border-black bg-white"
          cursor="nwse-resize"
        />

        {/* =======================================
            TOP RIGHT
        ======================================= */}

        <Handle
          mode="ne"
          className="-right-2 -top-2 h-5 w-5 rounded-full border-2 border-black bg-white"
          cursor="nesw-resize"
        />

        {/* =======================================
            BOTTOM LEFT
        ======================================= */}

        <Handle
          mode="sw"
          className="-bottom-2 -left-2 h-5 w-5 rounded-full border-2 border-black bg-white"
          cursor="nesw-resize"
        />

        {/* =======================================
            BOTTOM RIGHT
        ======================================= */}

        <Handle
          mode="se"
          className="-bottom-2 -right-2 h-5 w-5 rounded-full border-2 border-black bg-white"
          cursor="nwse-resize"
        />
      </div>

      {/* =========================================
          CROP DIMENSIONS
      ========================================= */}

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow">
        {cropPixelWidth} ×{" "}
        {cropPixelHeight} px
      </div>

      {/* =========================================
          CROP INFO
      ========================================= */}

      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/75 px-3 py-2 text-xs text-white shadow">
        <div className="font-medium">
          Crop Area
        </div>

        <div className="mt-1 opacity-80">
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
    </div>
  );
}
