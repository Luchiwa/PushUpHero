import { useRegisterSW } from 'virtual:pwa-register/react';

export function ReloadPrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error: any) {
            console.log('SW registration error', error);
        },
    });

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
                    <button className="btn-reload" onClick={() => updateServiceWorker(true)}>
                        Reload
                    </button>
                    <button className="btn-close" onClick={() => close()}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
