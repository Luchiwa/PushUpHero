/**
 * i18n types — Module augmentation for react-i18next + the
 * `SupportedLanguage` union shared across the i18n boundary.
 *
 * Strict resources typing (key autocomplete + compile-time missing-key
 * errors) is intentionally deferred until the namespaces are populated
 * — empty `{}` JSON files would lock the build.
 */
import 'react-i18next';

declare module 'react-i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
    }
}

/** The set of locales the app actively ships. Update this when adding a language. */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(v: unknown): v is SupportedLanguage {
    return typeof v === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}
