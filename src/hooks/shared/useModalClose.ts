import { useState, useCallback } from 'react';
import { useBackButton } from './useBackButton';

/**
 * Shared closing-animation pattern for modals and screens.
 * Sets `closing = true` → CSS exit animation plays → `onAnimationEnd` fires → `onDone()` called.
 *
 * Also registers a system back-button handler that triggers the same animated close,
 * so the Android back button dismisses the modal in-app instead of exiting the PWA.
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

    // While the modal is open, route the back button through the same close animation.
    useBackButton(!closing, handleClose);

    return { closing, handleClose, handleAnimationEnd } as const;
}
