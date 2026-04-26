import { useState } from 'react';
import { changePassword, translateAuthError } from '@services/authService';
import './PasswordChangeSection.scss';

export function PasswordChangeSection() {
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
            await changePassword(currentPwd, newPwd);
            setPwdSuccess(true);
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
        } catch (err: unknown) {
            setPwdError(translateAuthError(err));
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
                    aria-describedby={pwdError ? 'password-change-error' : undefined}
                    aria-invalid={!!pwdError || undefined}
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
                    aria-describedby={pwdError ? 'password-change-error' : undefined}
                    aria-invalid={!!pwdError || undefined}
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
                    aria-describedby={pwdError ? 'password-change-error' : undefined}
                    aria-invalid={!!pwdError || undefined}
                />
            </div>
            {pwdError && <p id="password-change-error" className="settings-feedback settings-feedback--error" role="alert">{pwdError}</p>}
            {pwdSuccess && <p className="settings-feedback settings-feedback--success">Password updated successfully!</p>}
            <button type="submit" className="btn-primary settings-submit" disabled={pwdLoading}>
                {pwdLoading ? 'Updating…' : 'Update Password'}
            </button>
        </form>
    );
}
