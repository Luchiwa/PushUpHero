import { useTranslation } from 'react-i18next';
import { useChangeLanguage, type SupportedLanguage } from '@i18n/useChangeLanguage';
import './LanguagePreferenceSection.scss';

// Display labels are proper nouns — kept verbatim across locales rather
// than translated (a user looking for "Français" expects to find it
// even when the UI is in English, and vice versa).
const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string }[] = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
];

export function LanguagePreferenceSection() {
    const { t, i18n } = useTranslation('modals');
    const changeLanguage = useChangeLanguage();
    const currentLang = i18n.language.split('-')[0] as SupportedLanguage;
    const safeCurrent = SUPPORTED_LANGUAGES.some(l => l.code === currentLang) ? currentLang : 'en';

    return (
        <div className="settings-form">
            <div className="input-group">
                <label htmlFor="settings-language">{t('settings.language.label_select')}</label>
                <select
                    id="settings-language"
                    className="settings-language-select"
                    value={safeCurrent}
                    onChange={e => { void changeLanguage(e.target.value as SupportedLanguage); }}
                >
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
