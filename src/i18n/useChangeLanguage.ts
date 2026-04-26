/**
 * useChangeLanguage — switches the active UI language.
 *
 * Calls `i18next.changeLanguage`, which triggers our `languageChanged`
 * listener (registered in src/i18n/index.ts) — that handles `<html lang>`
 * and the localStorage cache via the custom @infra/storage detector.
 *
 * If a user is signed in, the new preference is mirrored to Firestore
 * (`profile.preferredLanguage`) so the next sign-in on another device
 * picks it up. Cloud sync errors are logged, not surfaced — the local
 * switch already happened and is the user-visible win.
 */

import { useCallback } from 'react';
import i18n from 'i18next';
import { useAuthCore } from '@hooks/useAuth';
import { updatePreferredLanguage } from '@services/profileService';

export type SupportedLanguage = 'fr' | 'en';

export function useChangeLanguage(): (lang: SupportedLanguage) => Promise<void> {
    const { user } = useAuthCore();
    return useCallback(async (lang: SupportedLanguage) => {
        if (i18n.language !== lang) {
            await i18n.changeLanguage(lang);
        }
        if (user) {
            try {
                await updatePreferredLanguage(user.uid, lang);
            } catch (err) {
                console.error('[useChangeLanguage] cloud sync failed', err);
            }
        }
    }, [user]);
}
