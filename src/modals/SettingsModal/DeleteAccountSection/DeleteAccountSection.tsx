import { useState } from 'react';
import { GoogleAuthProvider, EmailAuthProvider, reauthenticateWithPopup, reauthenticateWithCredential } from 'firebase/auth';
import { useAuthCore } from '@hooks/useAuth';
import { deleteCurrentAccount } from '@hooks/useDeleteAccount';
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

    const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com') ?? false;
    const isEmailUser = user?.providerData.some(p => p.providerId === 'password') ?? false;

    const handleDeleteAccount = async () => {
        setDeleteError('');
        setDeleteLoading(true);
        try {
            if (!user) throw new Error('No authenticated user');

            // Force re-authentication so deleteUser never fails with requires-recent-login
            if (isGoogleUser) {
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
            } else if (isEmailUser) {
                if (!password) {
                    setDeleteError('Please enter your password to confirm deletion.');
                    setDeleteLoading(false);
                    return;
                }
                if (!user.email) {
                    setDeleteError('No email found on this account.');
                    setDeleteLoading(false);
                    return;
                }
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
            }

            await deleteCurrentAccount();
            onAccountDeleted();
        } catch (err: unknown) {
            const code = (err as { code?: string }).code;
            if (code === 'auth/requires-recent-login') {
                setDeleteError('Session expired. Please sign out and sign in again before deleting your account.');
            } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setDeleteError('Incorrect password. Please try again.');
            } else {
                setDeleteError((err as Error).message || 'An error occurred.');
            }
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
                    />
                </div>
            )}
            {deleteError && <p className="settings-feedback settings-feedback--error">{deleteError}</p>}
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
