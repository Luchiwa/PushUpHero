import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@lib/firebase';
import { useAuthCore } from '@hooks/useAuth';
import './PasswordChangeSection.scss';

export function PasswordChangeSection() {
    const { user } = useAuthCore();

    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError('');
        setPwdSuccess(false);

        if (newPwd.length < 6) {
            setPwdError('New password must be at least 6 characters.');
            return;
        }
        if (newPwd !== confirmPwd) {
            setPwdError('Passwords do not match.');
            return;
        }

        setPwdLoading(true);
        try {
            if (!user || !user.email) throw new Error('No authenticated user');
            const credential = EmailAuthProvider.credential(user.email, currentPwd);
            await reauthenticateWithCredential(user, credential);
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error('No authenticated user');
            await updatePassword(currentUser, newPwd);
            setPwdSuccess(true);
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
        } catch (err: unknown) {
            const code = (err as { code?: string }).code;
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setPwdError('Current password is incorrect.');
            } else if (code === 'auth/requires-recent-login') {
                setPwdError('Session expired. Please sign out and sign in again.');
            } else {
                setPwdError((err as Error).message || 'An error occurred.');
            }
        } finally {
            setPwdLoading(false);
        }
    };

    return (
        <form className="settings-form" onSubmit={handlePasswordChange}>
            <div className="input-group">
                <label htmlFor="settings-current-pwd">Current password</label>
                <input
                    id="settings-current-pwd"
                    type="password"
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                />
            </div>
            <div className="input-group">
                <label htmlFor="settings-new-pwd">New password</label>
                <input
                    id="settings-new-pwd"
                    type="password"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                />
            </div>
            <div className="input-group">
                <label htmlFor="settings-confirm-pwd">Confirm new password</label>
                <input
                    id="settings-confirm-pwd"
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                />
            </div>
            {pwdError && <p className="settings-feedback settings-feedback--error">{pwdError}</p>}
            {pwdSuccess && <p className="settings-feedback settings-feedback--success">Password updated successfully!</p>}
            <button type="submit" className="btn-primary settings-submit" disabled={pwdLoading}>
                {pwdLoading ? 'Updating…' : 'Update Password'}
            </button>
        </form>
    );
}
