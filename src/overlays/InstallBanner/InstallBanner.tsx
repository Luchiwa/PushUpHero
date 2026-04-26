import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '@hooks/useInstallPrompt';
import { isChromeiOS } from '@infra/device';
import './InstallBanner.scss';

export function InstallBanner() {
    const { t } = useTranslation('dashboard');
    const { context, triggerInstall } = useInstallPrompt();
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || context === 'installed' || context === 'unsupported') return null;

    return (
        <>
            {/* ── Compact banner ───────────────────────────────────── */}
            <div className="install-banner">
                <div className="install-banner-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                </div>
                <div className="install-banner-text">
                    <span className="install-banner-title">{t('install_banner.title')}</span>
                    <span className="install-banner-sub">{t('install_banner.subtitle')}</span>
                </div>
                <div className="install-banner-actions">
                    {context === 'android' && (
                        <button type="button" className="install-banner-btn install-banner-btn--install" onClick={triggerInstall}>
                            {t('install_banner.btn_install')}
                        </button>
                    )}
                    {context === 'ios' && (
                        <button type="button" className="install-banner-btn install-banner-btn--how" onClick={() => setShowIOSGuide(true)}>
                            {t('install_banner.btn_how')}
                        </button>
                    )}
                    <button type="button" className="install-banner-dismiss" onClick={() => setDismissed(true)} aria-label={t('install_banner.btn_dismiss_aria')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── iOS guide sheet ──────────────────────────────────── */}
            {showIOSGuide && (
                <div className="ios-guide-overlay" role="presentation" onClick={() => setShowIOSGuide(false)} onKeyDown={e => e.key === 'Escape' && setShowIOSGuide(false)}>
                    <div className="ios-guide-sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        <button type="button" className="ios-guide-close" onClick={() => setShowIOSGuide(false)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        <div className="ios-guide-header">
                            <h3 className="ios-guide-title">{t('install_banner.ios_guide.title')}</h3>
                            <p className="ios-guide-subtitle">{t('install_banner.ios_guide.subtitle')}</p>
                        </div>

                        <div className="ios-guide-steps">
                            <div className="ios-guide-step">
                                <span className="ios-guide-step-num">1</span>
                                <div className="ios-guide-step-content">
                                    <span className="ios-guide-step-icon">
                                        {isChromeiOS ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <circle cx="12" cy="5" r="2" />
                                                <circle cx="12" cy="12" r="2" />
                                                <circle cx="12" cy="19" r="2" />
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                                <polyline points="16 6 12 2 8 6" />
                                                <line x1="12" y1="2" x2="12" y2="15" />
                                            </svg>
                                        )}
                                    </span>
                                    <span>
                                        {isChromeiOS
                                            ? <>{t('install_banner.ios_guide.step1_chrome_prefix')} <strong>{t('install_banner.ios_guide.step1_chrome_strong')}</strong> {t('install_banner.ios_guide.step1_chrome_suffix')}</>
                                            : <>{t('install_banner.ios_guide.step1_safari_prefix')} <strong>{t('install_banner.ios_guide.step1_safari_strong')}</strong> {t('install_banner.ios_guide.step1_safari_suffix')}</>
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="ios-guide-step">
                                <span className="ios-guide-step-num">2</span>
                                <div className="ios-guide-step-content">
                                    <span className="ios-guide-step-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                    </span>
                                    <span>
                                        {isChromeiOS
                                            ? <>{t('install_banner.ios_guide.step2_chrome_prefix')} <strong>{t('install_banner.ios_guide.step2_strong')}</strong></>
                                            : <>{t('install_banner.ios_guide.step2_safari_prefix')} <strong>{t('install_banner.ios_guide.step2_strong')}</strong></>
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="ios-guide-step">
                                <span className="ios-guide-step-num">3</span>
                                <div className="ios-guide-step-content">
                                    <span className="ios-guide-step-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </span>
                                    <span>{t('install_banner.ios_guide.step3_prefix')} <strong>{t('install_banner.ios_guide.step3_strong')}</strong> {t('install_banner.ios_guide.step3_suffix')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="ios-guide-pointer">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {isChromeiOS ? (
                                    <>
                                        <line x1="12" y1="19" x2="12" y2="5" />
                                        <polyline points="5 12 12 5 19 12" />
                                    </>
                                ) : (
                                    <>
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <polyline points="19 12 12 19 5 12" />
                                    </>
                                )}
                            </svg>
                            <span>
                                {isChromeiOS
                                    ? <>{t('install_banner.ios_guide.pointer_chrome_prefix')} <strong>{t('install_banner.ios_guide.pointer_chrome_strong')}</strong> {t('install_banner.ios_guide.pointer_chrome_suffix')}</>
                                    : <>{t('install_banner.ios_guide.pointer_safari_prefix')} <strong>{t('install_banner.ios_guide.pointer_safari_strong')}</strong> {t('install_banner.ios_guide.pointer_safari_suffix')}</>
                                }
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
