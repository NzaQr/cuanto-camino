/*
 * JSX registration for the @magic-spells custom elements.
 * This file is a module so that `declare module 'react'` augments the React types.
 */
import type { BottomSheet } from '@magic-spells/bottom-sheet';
import type { DialogPanel } from '@magic-spells/dialog-panel';

/*
 * React 18 writes `className` on a custom element as a literal `classname`
 * attribute. Custom elements must use `class` instead.
 */
type CustomElementProps<T extends HTMLElement> = Omit<
  React.DetailedHTMLProps<React.HTMLAttributes<T>, T>,
  'className'
> & { class?: string };

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'dialog-panel': CustomElementProps<DialogPanel> & {
        position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
      };
      'bottom-sheet': CustomElementProps<BottomSheet> & {
        /** Largest viewport width, in px, where the sheet may open. */
        'max-display-width'?: string;
        /** Comma-separated viewport height percentages. */
        'snap-points'?: string;
        snap?: string;
        spring?: string;
        inset?: '';
        /**
         * Lowercase on purpose. React 18 drops `autoFocus` for every element
         * and writes other props on a custom element as plain attributes, so
         * this is the only spelling that reaches the DOM.
         */
        autofocus?: '';
      };
      'bottom-sheet-header': CustomElementProps<HTMLElement>;
      'bottom-sheet-content': CustomElementProps<HTMLElement>;
      'bottom-sheet-footer': CustomElementProps<HTMLElement>;
    }
  }
}

export {};
