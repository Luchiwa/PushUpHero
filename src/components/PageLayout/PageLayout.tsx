/**
 * PageLayout — Shared full-screen page shell with a consistent topbar.
 *
 * Provides:
 *   - Fixed full-screen container with slide-in / slide-out animation
 *   - Topbar: [back button] [title] [optional right slot]
 *   - Centered body column (max-width 480px)
 *
 * Used by ProfileModal, StatsScreen, QuestsScreen, ProgressionScreen, WorkoutConfigScreen.
 */
import { useState, useCallback, type ReactNode } from 'react';
import { useBackButton } from '@hooks/shared/useBackButton';
import './PageLayout.scss';

interface PageLayoutProps {
    /** Page title displayed in the topbar */
    title: string;
    /** Close / back handler — called after exit animation completes */
    onClose: () => void;
    /**
     * Optional in-place back handler. When provided, the topbar back arrow and the
     * system back button call this directly instead of running the exit animation.
     * Use for screens whose "back" navigates within the same mounted component (e.g.
     * stepping a wizard backward) so the PageLayout doesn't get stuck in its
     * post-exit state.
     */
    onBack?: () => void;
    /** Optional element rendered in the right slot of the topbar (e.g. settings button) */
    rightAction?: ReactNode;
    /** z-index for the overlay (default 40) */
    zIndex?: number;
    /** Extra className on the body container */
    bodyClassName?: string;
    /** Transition style: 'slide' (push nav) or 'sheet' (bottom sheet) */
    transition?: 'slide' | 'sheet';
    children: ReactNode;
}

export function PageLayout({ title, onClose, onBack, rightAction, zIndex, bodyClassName, transition = 'slide', children }: PageLayoutProps) {
    const [closing, setClosing] = useState(false);

    const handleClose = useCallback(() => {
        setClosing(true);
    }, []);

    const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
        if (closing && e.currentTarget === e.target) onClose();
    }, [closing, onClose]);

    // If onBack is provided, the back arrow / system back button bypass the exit
    // animation entirely (for in-place navigation). Otherwise fall back to the
    // animated close path.
    const backAction = onBack ?? handleClose;

    // System / Android back button → mirror whatever the topbar back arrow does.
    useBackButton(!closing, backAction);

    const exitClass = closing
        ? (transition === 'sheet' ? 'page-layout--sheet-exit' : 'page-layout--exit')
        : '';
    const enterClass = transition === 'sheet' ? 'page-layout--sheet' : '';

    return (
        <div
            className={`page-layout ${enterClass} ${exitClass}`}
            style={zIndex ? { zIndex } : undefined}
            onAnimationEnd={handleAnimationEnd}
        >
            {/* ── Topbar ─────────────────────────────────────────── */}
            <div className="page-topbar">
                <button type="button" className="btn-icon page-back-btn" onClick={backAction} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="page-topbar-title">{title}</span>
                {rightAction ?? <span className="page-topbar-spacer" />}
            </div>

            {/* ── Body ───────────────────────────────────────────── */}
            <div className={`page-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
                {children}
            </div>
        </div>
    );
}
