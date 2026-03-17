import { useState, useEffect } from 'react';

export type InstallContext = 'android' | 'ios' | 'installed' | 'unsupported';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getInitialContext(): InstallContext {
    if (typeof window === 'undefined') return 'unsupported';
    if (window.matchMedia('(display-mode: standalone)').matches) return 'installed';
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
    return 'unsupported';
}

export function useInstallPrompt() {
    const [context, setContext] = useState<InstallContext>(getInitialContext);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Only listen for install prompt on Android/Chrome (not iOS or already installed)
        if (context === 'installed' || context === 'ios') return;

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setContext('android');
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, [context]);

    const triggerInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setContext('installed');
            setDeferredPrompt(null);
        }
    };

    return { context, triggerInstall };
}
