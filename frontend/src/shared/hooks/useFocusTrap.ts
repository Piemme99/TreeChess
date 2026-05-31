import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
}

/**
 * Traps keyboard focus within `containerRef` while `active` is true.
 *
 * On activation it records the previously focused element, moves focus into
 * the container (first focusable element, or the container itself), and cycles
 * Tab/Shift+Tab within the container. On deactivation it restores focus to the
 * element that was focused before the trap engaged.
 *
 * Returns a ref intended for the dialog container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move initial focus into the dialog.
    const focusable = getFocusable(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableEls = getFocusable(container);
      if (focusableEls.length === 0) {
        // Keep focus on the container itself.
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that opened the trap.
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}
