import { useState, useEffect } from 'react';

export type InstallContext = 'android' | 'ios' | 'installed' | 'unsupported';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
    const [context, setContext] = useState<InstallContext>('unsupported');
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Already installed (running in standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setContext('installed');
            return;
        }

        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isIOS) {
            setContext('ios');
            return;
        }

        // Android / Chrome: listen for the native install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setContext('android');
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

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
