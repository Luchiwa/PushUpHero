/**
 * useBackButton — capture the system / browser back button as in-app navigation.
 *
 * The PWA has no react-router and never pushed history entries, so on Android the
 * system back button used to exit the app immediately. This hook lets any screen
 * register a "back" handler (typically the same callback that closes a modal or
 * stops a workout). When the user presses back, the topmost handler runs.
 *
 * Design — single shared synthetic history entry, never popped on cleanup
 * -----------------------------------------------------------------------
 * - A single module-level LIFO stack holds every active back handler.
 * - We keep **at most one** synthetic history entry alive at any time. The
 *   entry is created lazily on the first registration and re-armed inside the
 *   `popstate` listener after every back press. If the stack is non-empty when
 *   a back press fires, the listener invokes the topmost handler; if it's
 *   empty, the listener consumes the entry as a no-op.
 * - Cleanup **never** touches `history`. Doing so caused a race that broke the
 *   WorkoutConfigScreen "Add Exercise" flow: when the block-list `PageLayout`
 *   unmounted and the wizard's `PageLayout` mounted in the same React commit,
 *   the deferred `popstate` from cleanup's `history.back()` could land *after*
 *   the new component had pushed its own entry, instantly firing the wizard's
 *   close handler. Leaving the entry alone removes the race entirely — the
 *   orphan is automatically reused the next time a consumer mounts.
 * - Trade-off: when every back-button consumer closes via the UI (X button)
 *   the orphan stays in history. The next back press is consumed harmlessly
 *   by the listener (empty stack → no-op); the press after that exits the
 *   PWA. A minor wart in exchange for race-free behavior.
 */
import { useEffect, useRef } from 'react';

type BackHandler = () => void;
type Entry = { id: number; handler: BackHandler };

const stack: Entry[] = [];
let nextId = 1;
let listenerInstalled = false;
let hasSyntheticEntry = false;

function ensureHistoryEntry() {
    if (hasSyntheticEntry) return;
    hasSyntheticEntry = true;
    history.pushState({ __back: 'pwa' }, '');
}

function ensureListener() {
    if (listenerInstalled) return;
    listenerInstalled = true;
    window.addEventListener('popstate', () => {
        // The browser just popped a history entry. If it wasn't ours, ignore.
        if (!hasSyntheticEntry) return;
        hasSyntheticEntry = false;

        if (stack.length === 0) return; // orphan consumed harmlessly

        // Re-arm so the back button stays captured for the remaining stack,
        // then invoke the topmost handler.
        ensureHistoryEntry();
        stack[stack.length - 1].handler();
    });
}

export function useBackButton(active: boolean, handler: BackHandler): void {
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!active) return;
        ensureListener();

        const id = nextId++;
        const entry: Entry = { id, handler: () => handlerRef.current() };
        stack.push(entry);
        ensureHistoryEntry();

        return () => {
            const idx = stack.findIndex(e => e.id === id);
            if (idx !== -1) stack.splice(idx, 1);
            // Intentionally NO history manipulation here — see header comment.
        };
    }, [active]);
}
