import { useCallback, useEffect, useRef } from "react";

const MOBILE_MQ = "(max-width: 640px)";
const DRAG_THRESHOLD_PX = 8;
const VELOCITY_OPEN = -600; // px/s upward → prefer open
const VELOCITY_CLOSE = 600; // px/s downward → prefer close
const SAMPLE_MS = 64;

function project(velocityPxPerSec: number, decelerationRate = 0.998): number {
  return ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface UseBottomSheetGestureOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled?: boolean;
}

/**
 * Pointer-driven bottom sheet: 1:1 drag from the handle, velocity projection snap,
 * light rubber-banding past the open edge. Header tap still toggles when movement is small.
 */
export function useBottomSheetGesture(
  sheetRef: React.RefObject<HTMLElement | null>,
  { open, onOpenChange, enabled = true }: UseBottomSheetGestureOptions,
) {
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const closedYRef = useRef(0);
  const yRef = useRef(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const originYRef = useRef(0);
  const samplesRef = useRef<{ t: number; y: number }[]>([]);
  const movedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  openRef.current = open;
  onOpenChangeRef.current = onOpenChange;

  const measureClosedY = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return 0;
    const handle = el.querySelector("[data-sheet-handle]") as HTMLElement | null;
    const safe = Number.parseFloat(getComputedStyle(el).paddingBottom) || 0;
    const peek = (handle?.offsetHeight ?? 64) + safe;
    return Math.max(0, el.offsetHeight - peek);
  }, [sheetRef]);

  const applyY = useCallback(
    (y: number, { animate }: { animate: boolean }) => {
      const el = sheetRef.current;
      if (!el) return;
      const closedY = closedYRef.current;
      const clamped = Math.min(closedY, Math.max(0, y));
      yRef.current = clamped;
      el.style.setProperty("--sheet-y", `${clamped}px`);
      el.classList.toggle("is-dragging", !animate);
      el.classList.toggle("sheet-animating", animate);
      if (!animate) {
        el.classList.remove("sheet-animating");
      }
    },
    [sheetRef],
  );

  const snapTo = useCallback(
    (nextOpen: boolean) => {
      const closedY = closedYRef.current;
      const target = nextOpen ? 0 : closedY;
      applyY(target, { animate: !prefersReducedMotion() });
      if (openRef.current !== nextOpen) {
        onOpenChangeRef.current(nextOpen);
      }
    },
    [applyY],
  );

  // Keep transform in sync when open state changes externally (header keyboard, line select)
  useEffect(() => {
    if (!enabled) return;
    const el = sheetRef.current;
    if (!el) return;
    if (draggingRef.current) return;
    closedYRef.current = measureClosedY();
    applyY(open ? 0 : closedYRef.current, { animate: true });
  }, [open, enabled, applyY, measureClosedY, sheetRef]);

  useEffect(() => {
    if (!enabled) return;
    const el = sheetRef.current;
    if (!el) return;

    const mq = window.matchMedia(MOBILE_MQ);
    let mobile = mq.matches;

    const syncMetrics = () => {
      closedYRef.current = measureClosedY();
      if (!draggingRef.current) {
        applyY(openRef.current ? 0 : closedYRef.current, { animate: false });
      }
    };

    const onMq = () => {
      mobile = mq.matches;
      el.classList.toggle("sheet-gesture", mobile);
      if (mobile) syncMetrics();
      else {
        el.style.removeProperty("--sheet-y");
        el.classList.remove("is-dragging", "sheet-animating", "sheet-gesture");
      }
    };

    onMq();
    mq.addEventListener("change", onMq);
    window.addEventListener("resize", syncMetrics);
    window.visualViewport?.addEventListener("resize", syncMetrics);

    const isHandle = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("[data-sheet-handle]"));
    };

    const velocity = () => {
      const samples = samplesRef.current;
      if (samples.length < 2) return 0;
      const last = samples[samples.length - 1];
      let prev = samples[0];
      for (let i = samples.length - 2; i >= 0; i--) {
        if (last.t - samples[i].t >= SAMPLE_MS) {
          prev = samples[i];
          break;
        }
        prev = samples[i];
      }
      const dt = last.t - prev.t;
      if (dt <= 0) return 0;
      return ((last.y - prev.y) / dt) * 1000;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!mobile || e.button !== 0) return;
      if (!isHandle(e.target)) return;

      draggingRef.current = true;
      movedRef.current = false;
      pointerIdRef.current = e.pointerId;
      startYRef.current = e.clientY;
      originYRef.current = yRef.current;
      samplesRef.current = [{ t: e.timeStamp, y: yRef.current }];
      closedYRef.current = measureClosedY();

      el.setPointerCapture(e.pointerId);
      applyY(yRef.current, { animate: false });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const dy = e.clientY - startYRef.current;
      if (Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true;

      let next = originYRef.current + dy;
      const closedY = closedYRef.current;

      // Rubber-band above open (y < 0) and lightly past closed
      if (next < 0) {
        next = -rubberband(-next, el.offsetHeight);
      } else if (next > closedY) {
        next = closedY + rubberband(next - closedY, el.offsetHeight * 0.35);
      }

      yRef.current = next;
      el.style.setProperty("--sheet-y", `${next}px`);
      samplesRef.current.push({ t: e.timeStamp, y: next });
      if (samplesRef.current.length > 8) samplesRef.current.shift();
    };

    const finish = (e: PointerEvent) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
      draggingRef.current = false;
      pointerIdRef.current = null;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      // Tap without meaningful drag → toggle
      if (!movedRef.current) {
        snapTo(!openRef.current);
        return;
      }

      const v = velocity();
      const current = Math.min(
        closedYRef.current,
        Math.max(0, yRef.current),
      );
      const projected = current + project(v);
      const mid = closedYRef.current / 2;

      let nextOpen: boolean;
      if (v <= VELOCITY_OPEN) nextOpen = true;
      else if (v >= VELOCITY_CLOSE) nextOpen = false;
      else nextOpen = projected < mid;

      snapTo(nextOpen);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);

    return () => {
      mq.removeEventListener("change", onMq);
      window.removeEventListener("resize", syncMetrics);
      window.visualViewport?.removeEventListener("resize", syncMetrics);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
    };
  }, [enabled, applyY, measureClosedY, sheetRef, snapTo]);
}
