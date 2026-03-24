import { memo } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './ReloadPrompt.scss';

export const ReloadPrompt = memo(function ReloadPrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    const close = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="reload-prompt-container">
            <div className="reload-prompt-toast">
                <div className="reload-prompt-message">
                    <span>A new version is available!</span>
                </div>
                <div className="reload-prompt-actions">
                    <button type="button" className="btn-reload" onClick={() => updateServiceWorker(true)}>
                        Reload
                    </button>
                    <button type="button" className="btn-close" onClick={() => close()}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
});
