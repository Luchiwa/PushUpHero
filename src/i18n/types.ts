/**
 * i18n — Module augmentation for react-i18next.
 *
 * Sets the default namespace so `useTranslation()` without args resolves
 * keys against `common`. Strict resources typing (key autocomplete +
 * compile-time missing-key errors) is intentionally deferred until the
 * namespaces are populated — empty `{}` JSON files would lock the build.
 */
import 'react-i18next';

declare module 'react-i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
    }
}
