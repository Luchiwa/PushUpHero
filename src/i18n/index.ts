/**
 * i18n — i18next initialization.
 *
 * Detection order: our custom @infra/storage-backed lookup first (so the
 * STORAGE_KEYS registry stays the single source of truth and we don't
 * bypass the storage isolation rule), then `navigator.language`. Fallback
 * is English. Resources are statically imported so init is synchronous —
 * no <Suspense> needed around <App>.
 *
 * `<html lang>` follows the active language via the `languageChanged`
 * listener — do not duplicate this listener elsewhere.
 */
import i18n from 'i18next';
import LanguageDetector, { type CustomDetector } from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { STORAGE_KEYS, read, write } from '@infra/storage';

import frCommon from './locales/fr/common.json';
import frStart from './locales/fr/start.json';
import frWorkout from './locales/fr/workout.json';
import frStats from './locales/fr/stats.json';
import frQuests from './locales/fr/quests.json';
import frModals from './locales/fr/modals.json';
import frCoach from './locales/fr/coach.json';
import frErrors from './locales/fr/errors.json';
import frDashboard from './locales/fr/dashboard.json';
import frSaved from './locales/fr/saved.json';

import enCommon from './locales/en/common.json';
import enStart from './locales/en/start.json';
import enWorkout from './locales/en/workout.json';
import enStats from './locales/en/stats.json';
import enQuests from './locales/en/quests.json';
import enModals from './locales/en/modals.json';
import enCoach from './locales/en/coach.json';
import enErrors from './locales/en/errors.json';
import enDashboard from './locales/en/dashboard.json';
import enSaved from './locales/en/saved.json';

const storageDetector: CustomDetector = {
    name: 'pushupHeroStorage',
    lookup: () => {
        const value = read<string>(STORAGE_KEYS.preferredLanguage, '');
        return value || undefined;
    },
    cacheUserLanguage: (lng) => {
        write(STORAGE_KEYS.preferredLanguage, lng);
    },
};

const detector = new LanguageDetector();
detector.addDetector(storageDetector);

void i18n
    .use(detector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['fr', 'en'],
        defaultNS: 'common',
        ns: ['common', 'start', 'workout', 'stats', 'quests', 'modals', 'coach', 'errors', 'dashboard', 'saved'],
        resources: {
            fr: {
                common: frCommon,
                start: frStart,
                workout: frWorkout,
                stats: frStats,
                quests: frQuests,
                modals: frModals,
                coach: frCoach,
                errors: frErrors,
                dashboard: frDashboard,
                saved: frSaved,
            },
            en: {
                common: enCommon,
                start: enStart,
                workout: enWorkout,
                stats: enStats,
                quests: enQuests,
                modals: enModals,
                coach: enCoach,
                errors: enErrors,
                dashboard: enDashboard,
                saved: enSaved,
            },
        },
        detection: {
            order: ['pushupHeroStorage', 'navigator'],
            caches: ['pushupHeroStorage'],
        },
        interpolation: {
            escapeValue: false,
        },
        returnNull: false,
    });

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
});

export default i18n;
