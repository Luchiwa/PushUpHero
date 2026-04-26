import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthCore } from '@hooks/useAuth';
import { useModalClose } from '@hooks/shared/useModalClose';
import { useFocusTrap } from '@hooks/shared/useFocusTrap';
import { PasswordChangeSection } from './PasswordChangeSection/PasswordChangeSection';
import { DeleteAccountSection } from './DeleteAccountSection/DeleteAccountSection';
import './SettingsModal.scss';

interface SettingsModalProps {
    onClose: () => void;
    onAccountDeleted: () => void;
}

function SettingsAccordion({ title, danger, isOpen, onToggle, children }: {
    title: string;
    danger?: boolean;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className={`settings-accordion${danger ? ' settings-accordion--danger' : ''}${isOpen ? ' settings-accordion--open' : ''}`}>
            <button type="button" className="settings-accordion-header" onClick={onToggle}>
                <span className={`settings-accordion-title${danger ? ' settings-accordion-title--danger' : ''}`}>{title}</span>
                <svg
                    className={`settings-accordion-chevron${isOpen ? ' settings-accordion-chevron--open' : ''}`}
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {isOpen && <div className="settings-accordion-body">{children}</div>}
        </div>
    );
}

export function SettingsModal({ onClose, onAccountDeleted }: SettingsModalProps) {
    const { t } = useTranslation('modals');
    const { user, logout } = useAuthCore();
    const { closing, handleClose, handleAnimationEnd } = useModalClose(onClose);
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef);

    const handleLogout = async () => {
        await logout();
        onAccountDeleted(); // reuse the "close everything" callback
    };

    // Detect if user signed in via Google (no password)
    const isGoogleUser = user?.providerIds.includes('google.com') ?? false;

    const [openSection, setOpenSection] = useState<string | null>(null);
    const toggleSection = (key: string) => setOpenSection(prev => prev === key ? null : key);

    return (
        <div
            ref={modalRef}
            className={`settings-overlay${closing ? ' settings-overlay--exit' : ''}`}
            role="presentation"
            onClick={handleClose}
            onKeyDown={e => e.key === 'Escape' && handleClose()}
            onAnimationEnd={handleAnimationEnd}
        >
            <div className={`settings-card${closing ? ' settings-card--exit' : ''}`} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                {/* Header */}
                <div className="settings-header">
                    <h2 className="settings-title">{t('settings.title')}</h2>
                    <button type="button" className="btn-icon settings-close-btn" onClick={handleClose} aria-label={t('settings.close_aria')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="settings-body">
                    {/* ── Change Password ───────────────────────── */}
                    {!isGoogleUser && (
                        <SettingsAccordion title={t('settings.section_password')} isOpen={openSection === 'password'} onToggle={() => toggleSection('password')}>
                            <PasswordChangeSection />
                        </SettingsAccordion>
                    )}

                    {/* ── Danger Zone ───────────────────────────── */}
                    <SettingsAccordion title={t('settings.section_delete')} danger isOpen={openSection === 'delete'} onToggle={() => toggleSection('delete')}>
                        <DeleteAccountSection onAccountDeleted={onAccountDeleted} />
                    </SettingsAccordion>

                    <button type="button" className="btn-logout" onClick={handleLogout}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        {t('settings.btn_signout')}
                    </button>
                </div>
            </div>
        </div>
    );
}
