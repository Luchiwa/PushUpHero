import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './ReloadPrompt.scss';

export const ReloadPrompt = memo(function ReloadPrompt() {
    const { t } = useTranslation();
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh) return null;

    return (
        <div className="reload-prompt-container">
            <div className="reload-prompt-toast">
                <div className="reload-prompt-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                </div>
                <div className="reload-prompt-text">
                    <span className="reload-prompt-title">{t('reload_prompt.title')}</span>
                    <span className="reload-prompt-sub">{t('reload_prompt.subtitle')}</span>
                </div>
                <div className="reload-prompt-actions">
                    <button type="button" className="reload-prompt-btn" onClick={() => updateServiceWorker(true)}>
                        {t('reload_prompt.btn_update')}
                    </button>
                    <button type="button" className="reload-prompt-dismiss" onClick={() => setNeedRefresh(false)} aria-label={t('action.dismiss')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
});
