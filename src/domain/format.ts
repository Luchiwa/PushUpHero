/**
 * format — Locale-aware Intl helpers.
 *
 * Single source of truth for user-facing date/number formatting. The locale
 * comes from `i18next.language` so formatting follows the active UI language
 * rather than the browser's `navigator.language` default.
 *
 * Use these in UI code instead of `.toLocaleDateString*('en-US', …)` or bare
 * `.toLocaleString()`. The internal `'sv-SE'` YYYY-MM-DD trick used for
 * date keys (sorting, storage keys) is technical formatting and stays as-is.
 */

import i18n from 'i18next';

/** Format a date / timestamp using the active UI locale. */
export function formatDate(date: Date | number, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return new Intl.DateTimeFormat(i18n.language, options).format(d);
}

/** Format a time of day (24h hour:minute) using the active UI locale. */
export function formatTime(date: Date | number, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return new Intl.DateTimeFormat(i18n.language, options ?? { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Format a number using the active UI locale (thousand separators, decimals). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(i18n.language, options).format(value);
}
