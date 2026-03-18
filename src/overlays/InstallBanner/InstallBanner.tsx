import { useState } from 'react';
import { useInstallPrompt } from '@hooks/useInstallPrompt';
import './InstallBanner.scss';

export function InstallBanner() {
    const { context, triggerInstall } = useInstallPrompt();
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || context === 'installed' || context === 'unsupported') return null;

    return (
        <>
            {/* ── Compact banner ───────────────────────────────────── */}
            <div className="install-banner">
                <div className="install-banner-icon">📲</div>
                <div className="install-banner-text">
                    <span className="install-banner-title">Add to Home Screen</span>
                    <span className="install-banner-sub">Use Push-Up Hero as a native app</span>
                </div>
                <div className="install-banner-actions">
                    {context === 'android' && (
                        <button type="button" className="install-banner-btn" onClick={triggerInstall}>
                            Install
                        </button>
                    )}
                    {context === 'ios' && (
                        <button type="button" className="install-banner-btn" onClick={() => setShowIOSGuide(true)}>
                            How?
                        </button>
                    )}
                    <button type="button" className="install-banner-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
                        ✕
                    </button>
                </div>
            </div>

            {/* ── iOS guide sheet ──────────────────────────────────── */}
            {showIOSGuide && (
                <div className="ios-guide-overlay" role="presentation" onClick={() => setShowIOSGuide(false)} onKeyDown={e => e.key === 'Escape' && setShowIOSGuide(false)}>
                    <div className="ios-guide-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        <button type="button" className="ios-guide-close" onClick={() => setShowIOSGuide(false)}>✕</button>
                        <h3 className="ios-guide-title">Add to Home Screen</h3>
                        <ol className="ios-guide-steps">
                            <li>
                                <span className="ios-guide-step-icon">
                                    {/* Share icon */}
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                                        <polyline points="16 6 12 2 8 6"/>
                                        <line x1="12" y1="2" x2="12" y2="15"/>
                                    </svg>
                                </span>
                                Tap the <strong>Share</strong> button at the bottom of Safari
                            </li>
                            <li>
                                <span className="ios-guide-step-icon">➕</span>
                                Scroll down and tap <strong>"Add to Home Screen"</strong>
                            </li>
                            <li>
                                <span className="ios-guide-step-icon">✅</span>
                                Tap <strong>"Add"</strong> — done!
                            </li>
                        </ol>
                        <div className="ios-guide-arrow">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <polyline points="19 12 12 19 5 12"/>
                            </svg>
                            <span>Safari Share button</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
