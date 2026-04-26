import { useState } from 'react';
import { useAuthCore } from '@hooks/useAuth';
import { reauthenticateWithGoogle, reauthenticateWithEmail, translateAuthError } from '@services/authService';
import { deleteCurrentAccount } from '@services/deleteAccount';
import './DeleteAccountSection.scss';

interface DeleteAccountSectionProps {
    onAccountDeleted: () => void;
}

export function DeleteAccountSection({ onAccountDeleted }: DeleteAccountSectionProps) {
    const { user } = useAuthCore();

    const [deleteInput, setDeleteInput] = useState('');
    const [password, setPassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const isGoogleUser = user?.providerIds.includes('google.com') ?? false;
    const isEmailUser = user?.providerIds.includes('password') ?? false;

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
                    setDeleteError('Please enter your password to confirm deletion.');
                    setDeleteLoading(false);
                    return;
                }
                await reauthenticateWithEmail(password);
            }

            await deleteCurrentAccount();
            onAccountDeleted();
        } catch (err: unknown) {
            setDeleteError(translateAuthError(err));
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <>
            <p className="settings-danger-desc">
                Deleting your account is <strong>permanent and irreversible</strong>. All your data (sessions, friends, progress) will be permanently deleted.
            </p>
            <div className="input-group">
                <label htmlFor="settings-delete-confirm">Type <strong>DELETE</strong> to confirm</label>
                <input
                    id="settings-delete-confirm"
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className={deleteInput === 'DELETE' ? 'input--danger-ready' : ''}
                    aria-describedby={deleteError ? 'delete-account-error' : undefined}
                    aria-invalid={!!deleteError || undefined}
                />
            </div>
            {isEmailUser && deleteInput === 'DELETE' && (
                <div className="input-group">
                    <label htmlFor="settings-delete-password">Enter your password</label>
                    <input
                        id="settings-delete-password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Your password"
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
                disabled={deleteInput !== 'DELETE' || deleteLoading || (isEmailUser && !password)}
            >
                {deleteLoading ? 'Deleting…' : 'Delete My Account'}
            </button>
        </>
    );
}
