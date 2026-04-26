import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthCore } from '@hooks/useAuth';
import { reauthenticateWithGoogle, reauthenticateWithEmail, translateAuthError } from '@services/authService';
import { deleteCurrentAccount } from '@services/deleteAccount';
import './DeleteAccountSection.scss';

interface DeleteAccountSectionProps {
    onAccountDeleted: () => void;
}

export function DeleteAccountSection({ onAccountDeleted }: DeleteAccountSectionProps) {
    const { t } = useTranslation('modals');
    const { user } = useAuthCore();

    const [deleteInput, setDeleteInput] = useState('');
    const [password, setPassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const isGoogleUser = user?.providerIds.includes('google.com') ?? false;
    const isEmailUser = user?.providerIds.includes('password') ?? false;
    const confirmWord = t('settings.delete.type_to_confirm_word');

    const handleDeleteAccount = async () => {
        setDeleteError('');
        setDeleteLoading(true);
        try {
            if (!user) throw new Error('No authenticated user');

            // Force re-authentication so deleteUser never fails with requires-recent-login
            if (isGoogleUser) {
                await reauthenticateWithGoogle();
            } else if (isEmailUser) {
                if (!password) {
                    setDeleteError(t('settings.delete.missing_password_error'));
                    setDeleteLoading(false);
                    return;
                }
                await reauthenticateWithEmail(password);
            }

            await deleteCurrentAccount();
            onAccountDeleted();
        } catch (err: unknown) {
            setDeleteError(t(translateAuthError(err)));
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <>
            <p className="settings-danger-desc">
                {t('settings.delete.warning_lead')} <strong>{t('settings.delete.warning_strong')}</strong>{t('settings.delete.warning_tail')}
            </p>
            <div className="input-group">
                <label htmlFor="settings-delete-confirm">
                    {t('settings.delete.type_to_confirm_prefix')} <strong>{confirmWord}</strong> {t('settings.delete.type_to_confirm_suffix')}
                </label>
                <input
                    id="settings-delete-confirm"
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder={confirmWord}
                    className={deleteInput === confirmWord ? 'input--danger-ready' : ''}
                    aria-describedby={deleteError ? 'delete-account-error' : undefined}
                    aria-invalid={!!deleteError || undefined}
                />
            </div>
            {isEmailUser && deleteInput === confirmWord && (
                <div className="input-group">
                    <label htmlFor="settings-delete-password">{t('settings.delete.label_password')}</label>
                    <input
                        id="settings-delete-password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('settings.delete.password_placeholder')}
                        autoComplete="current-password"
                        aria-describedby={deleteError ? 'delete-account-error' : undefined}
                        aria-invalid={!!deleteError || undefined}
                    />
                </div>
            )}
            {deleteError && <p id="delete-account-error" className="settings-feedback settings-feedback--error" role="alert">{deleteError}</p>}
            <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== confirmWord || deleteLoading || (isEmailUser && !password)}
            >
                {deleteLoading ? t('settings.delete.btn_loading') : t('settings.delete.btn_submit')}
            </button>
        </>
    );
}
