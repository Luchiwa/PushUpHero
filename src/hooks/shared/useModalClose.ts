import { useState, useCallback } from 'react';

/**
 * Shared closing-animation pattern for modals and screens.
 * Sets `closing = true` → CSS exit animation plays → `onAnimationEnd` fires → `onDone()` called.
 *
 * @param onDone Callback invoked once the exit animation finishes on the root element.
 */
export function useModalClose(onDone: () => void) {
    const [closing, setClosing] = useState(false);

    const handleClose = useCallback(() => {
        setClosing(true);
    }, []);

    const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
        if (closing && e.currentTarget === e.target) onDone();
    }, [closing, onDone]);

    return { closing, handleClose, handleAnimationEnd } as const;
}
