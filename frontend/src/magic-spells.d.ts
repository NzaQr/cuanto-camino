/*
 * Ambient types for the @magic-spells web components. The packages ship
 * JavaScript only. This file is a script (no import/export) on purpose:
 * an untyped package can only get types from an ambient module declaration.
 */

declare module '@magic-spells/dialog-panel' {
  export type DialogPanelState = 'hidden' | 'showing' | 'shown' | 'hiding';

  export class DialogPanel extends HTMLElement {
    /** Opens the dialog. Returns false when a `beforeShow` handler cancelled it. */
    show(triggerEl?: HTMLElement | null): boolean;
    /** Closes the dialog. Returns false when refused (cancelled, or still opening). */
    hide(triggerEl?: HTMLElement | null): boolean;
    readonly state: DialogPanelState;
    readonly dialog: HTMLDialogElement | null;
    readonly isOpen: boolean;
    readonly triggerElement: HTMLElement | null;
  }

  export class DialogBackdrop extends HTMLElement {}
}

declare module '@magic-spells/dialog-panel/css';

declare module '@magic-spells/bottom-sheet' {
  import type { DialogPanel } from '@magic-spells/dialog-panel';

  export class BottomSheet extends HTMLElement {
    /** Opens through the parent panel. The trigger gets focus back on close. */
    show(triggerEl?: HTMLElement | null): void;
    /** Closes through the parent panel. Returns false when the panel refused. */
    hide(): boolean;
    /** Animates to a declared snap point. Undeclared values are ignored. */
    snapTo(value: number): void;
    maxDisplayWidth: number;
    snapPoints: number[];
    snap: number | null;
    readonly panel: DialogPanel | null;
    readonly dialog: HTMLDialogElement | null;
    readonly header: HTMLElement | null;
    readonly content: HTMLElement | null;
    readonly footer: HTMLElement | null;
    readonly backdrop: HTMLElement | null;
  }

  export class BottomSheetHeader extends HTMLElement {}
  export class BottomSheetContent extends HTMLElement {}
  export class BottomSheetFooter extends HTMLElement {}
}

declare module '@magic-spells/bottom-sheet/css';
