import React, { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChevronDownIcon, ChevronUpIcon } from '@hugeicons/core-free-icons';
import type { BottomSheet } from '@magic-spells/bottom-sheet';
import type { DialogPanel } from '@magic-spells/dialog-panel';
import PanelBrand from './PanelBrand.tsx';
import { SHEET_MAX_WIDTH } from '../hooks/useMediaQuery.ts';
import './MobileSheet.css';

/** Upward travel on the closed bar, in px, that opens the sheet. */
const DRAG_OPEN_PX = 24;

type InputModality = 'pointer' | 'keyboard';

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Mobile bottom sheet built on @magic-spells/bottom-sheet.
 *
 * The library owns the native modal <dialog>, the drag gestures, the backdrop,
 * focus trapping and Escape. This component does three things on top:
 * - keeps the React `open` state and the sheet in sync in both directions;
 * - shows a persistent bar at the bottom edge while the sheet is closed;
 * - manages focus and the content scroller around the open/close animations.
 *
 * Focus. `showModal()` focuses the first focusable descendant, which would be
 * the close button, and browsers that show focus rings for programmatic focus
 * (WebKit) draw a ring on it as soon as the sheet appears. The <bottom-sheet>
 * element is therefore `tabindex="-1" autofocus`: it takes the initial focus
 * and it has no ring. On close the library would call `.focus()` on the
 * trigger passed to `show()`, which paints the same ring on the closed bar.
 * The sheet is shown without a trigger, so the native `dialog.close()` focus
 * restore applies, and the bar is focused by hand only after a keyboard close.
 *
 * Geometry. The bar never goes away: the library always opens a modal
 * dialog, so a non-modal peek has to be a second element. The sheet is made
 * to rest exactly on top of it instead (see --bs-panel-hidden-offset and the
 * shared --sheet-bar-h), so the close ends where the bar is and the swap at
 * `hidden` changes no pixel.
 *
 * Animation. The content is an async scroller (`overflow-y: scroll`,
 * `-webkit-overflow-scrolling: touch`). While the dialog slides, iOS paints
 * that scroll layer a frame behind the rest of the sheet, so the content
 * visibly trails the header. `data-animating` on the panel turns the scroller
 * into a plain box for the duration of the show/hide transitions only.
 */
function MobileSheet({ open, onOpenChange, children }: MobileSheetProps) {
  const panelRef = useRef<DialogPanel>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const contentRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number | null>(null);
  const lastInput = useRef<InputModality>('pointer');

  const openRef = useRef(open);
  openRef.current = open;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  // Sheet → React state. Escape, a backdrop tap, the close button and a drag
  // dismiss all close through dialog-panel and never touch React on their own.
  useEffect(() => {
    const panel = panelRef.current;
    const sheet = sheetRef.current;
    if (!panel || !sheet) return;

    const onPointerDown = () => {
      lastInput.current = 'pointer';
    };
    const onKeyDown = () => {
      lastInput.current = 'keyboard';
    };

    const startAnimating = () => panel.setAttribute('data-animating', '');
    const stopAnimating = () => panel.removeAttribute('data-animating');

    const onHidden = () => {
      stopAnimating();
      if (contentRef.current) contentRef.current.scrollTop = 0;
      // Keyboard users need a place to land. Pointer users get the native
      // restore only, which draws no ring on the bar.
      if (lastInput.current === 'keyboard') triggerRef.current?.focus();
      if (openRef.current) onOpenChangeRef.current(false);
    };
    // dialog-panel refuses hide() while it is still opening. Check again once settled.
    const onShown = () => {
      stopAnimating();
      if (!openRef.current) sheet.hide();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    panel.addEventListener('beforeShow', startAnimating);
    panel.addEventListener('beforeHide', startAnimating);
    panel.addEventListener('hidden', onHidden);
    panel.addEventListener('shown', onShown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      panel.removeEventListener('beforeShow', startAnimating);
      panel.removeEventListener('beforeHide', startAnimating);
      panel.removeEventListener('hidden', onHidden);
      panel.removeEventListener('shown', onShown);
    };
  }, []);

  // React state → sheet. Declared after the listener effect: effects run in
  // order, and the first show() emits beforeShow synchronously.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    // No trigger on purpose: see the focus notes above.
    if (open) sheet.show();
    else sheet.hide();
  }, [open]);

  // The closed bar is not a library drag surface. A short upward drag on it
  // opens the sheet, so the old "pull up" habit still works.
  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.isPrimary) dragStartY.current = e.clientY;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartY.current === null) return;
    if (dragStartY.current - e.clientY > DRAG_OPEN_PX) {
      dragStartY.current = null;
      onOpenChange(true);
    }
  }

  function endDrag() {
    dragStartY.current = null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="panel-header sheet-trigger"
        onClick={() => onOpenChange(true)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-expanded={open}
        aria-label="Abrir menú"
      >
        <span className="sheet-grabber" aria-hidden="true" />
        <PanelBrand />
        <span className="sheet-chevron" aria-hidden="true">
          <HugeiconsIcon icon={ChevronUpIcon} size={16} color="currentColor" strokeWidth={1.75} />
        </span>
      </button>

      <dialog-panel ref={panelRef} class="sheet-panel">
        <dialog aria-labelledby="sheet-title">
          <bottom-sheet
            ref={sheetRef}
            max-display-width={String(SHEET_MAX_WIDTH)}
            tabIndex={-1}
            autofocus=""
          >
            <bottom-sheet-header class="panel-header sheet-header">
              <PanelBrand heading titleId="sheet-title" />
              <button
                type="button"
                className="sheet-close"
                data-action-hide-dialog=""
                aria-label="Cerrar menú"
              >
                <HugeiconsIcon icon={ChevronDownIcon} size={16} color="currentColor" strokeWidth={1.75} />
              </button>
            </bottom-sheet-header>
            <bottom-sheet-content ref={contentRef} class="sheet-content">
              {children}
            </bottom-sheet-content>
          </bottom-sheet>
        </dialog>
      </dialog-panel>
    </>
  );
}

export default MobileSheet;
