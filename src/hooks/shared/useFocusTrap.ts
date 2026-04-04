import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside the referenced container element.
 *
 * - Tab / Shift+Tab cycle through focusable children
 * - First focusable element (or close button) receives focus on mount
 * - Previously focused element is restored on unmount
 * - Focusable elements are re-scanned on every Tab press so dynamic
 *   content (accordion panels, conditional fields, etc.) is handled
 *   without a MutationObserver.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;

        // Initial focus: prefer a close button, otherwise first focusable element
        const initialTarget =
            container.querySelector<HTMLElement>('[aria-label="Close"], [aria-label="Back"]') ??
            container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        initialTarget?.focus();

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Tab') return;

            const focusable = Array.from(
                container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        };
    }, [containerRef]);
}
