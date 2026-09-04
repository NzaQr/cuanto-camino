import React, { useEffect, useRef } from 'react';

interface WalkSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  'aria-label': string;
}

/**
 * Range input that keeps its touch gesture to itself.
 *
 * On mobile the panel lives inside a bottom sheet whose library listens for
 * pointer events on the whole content area. A horizontal slide on a slider
 * always carries a little vertical jitter, and the sheet claims that as a
 * drag and captures the pointer. The slider then stops moving and the sheet
 * moves instead. The listener is native and sits below the React root, so a
 * React `stopPropagation` runs too late: the pointer event is stopped with a
 * native listener on the input itself. `touch-action: none` keeps the
 * browser from scrolling the content on the same touch.
 */
function WalkSlider({ min, max, step, value, onChange, 'aria-label': ariaLabel }: WalkSliderProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const keep = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', keep);
    el.addEventListener('touchstart', keep, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', keep);
      el.removeEventListener('touchstart', keep);
    };
  }, []);

  return (
    <input
      ref={ref}
      type="range"
      className="walk-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export default WalkSlider;
