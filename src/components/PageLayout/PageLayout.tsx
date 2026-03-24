/**
 * PageLayout — Shared full-screen page shell with a consistent topbar.
 *
 * Provides:
 *   - Fixed full-screen container with animation
 *   - Topbar: [back button] [title] [optional right slot]
 *   - Centered body column (max-width 480px)
 *
 * Used by ProfileModal, StatsScreen, and future pages.
 */
import type { ReactNode } from 'react';
import './PageLayout.scss';

interface PageLayoutProps {
    /** Page title displayed in the topbar */
    title: string;
    /** Close / back handler */
    onClose: () => void;
    /** Optional element rendered in the right slot of the topbar (e.g. settings button) */
    rightAction?: ReactNode;
    /** z-index for the overlay (default 40) */
    zIndex?: number;
    /** Extra className on the body container */
    bodyClassName?: string;
    children: ReactNode;
}

export function PageLayout({ title, onClose, rightAction, zIndex, bodyClassName, children }: PageLayoutProps) {
    return (
        <div className="page-layout" style={zIndex ? { zIndex } : undefined}>
            {/* ── Topbar ─────────────────────────────────────────── */}
            <div className="page-topbar">
                <button type="button" className="btn-icon page-back-btn" onClick={onClose} aria-label="Back">
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
