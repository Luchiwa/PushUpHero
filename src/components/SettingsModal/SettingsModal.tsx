import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@lib/firebase';
import { useAuth } from '@hooks/useAuth';
import { deleteCurrentAccount } from '@hooks/useDeleteAccount';
import './SettingsModal.scss';

interface SettingsModalProps {
    onClose: () => void;
    onAccountDeleted: () => void;
}

function SettingsAccordion({ title, danger, isOpen, onToggle, children }: {
    title: string;
    danger?: boolean;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className={`settings-accordion${danger ? ' settings-accordion--danger' : ''}${isOpen ? ' settings-accordion--open' : ''}`}>
            <button className="settings-accordion-header" onClick={onToggle}>
                <span className={`settings-accordion-title${danger ? ' settings-accordion-title--danger' : ''}`}>{title}</span>
                <svg
                    className={`settings-accordion-chevron${isOpen ? ' settings-accordion-chevron--open' : ''}`}
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {isOpen && <div className="settings-accordion-body">{children}</div>}
        </div>
    );
}

export function SettingsModal({ onClose, onAccountDeleted }: SettingsModalProps) {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        onAccountDeleted(); // reuse the "close everything" callback
    };

    // ── Password change state ────────────────────────────────────
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);

    // ── Delete account state ─────────────────────────────────────
    const [deleteInput, setDeleteInput] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Detect if user signed in via Google (no password)
    const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com') ?? false;

    const [openSection, setOpenSection] = useState<string | null>(null);
    const toggleSection = (key: string) => setOpenSection(prev => prev === key ? null : key);

    // ── Handlers ─────────────────────────────────────────────────
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
            await updatePassword(auth.currentUser!, newPwd);
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

    const handleDeleteAccount = async () => {
        setDeleteError('');
        setDeleteLoading(true);
        try {
            await deleteCurrentAccount();
            onAccountDeleted();
        } catch (err: unknown) {
            const code = (err as { code?: string }).code;
            if (code === 'auth/requires-recent-login') {
                setDeleteError('Session expired. Please sign out and sign in again before deleting your account.');
            } else {
                setDeleteError((err as Error).message || 'An error occurred.');
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-card" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="settings-header">
                    <h2 className="settings-title">Settings</h2>
                    <button className="btn-icon settings-close-btn" onClick={onClose} aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="settings-body">
                    {/* ── Change Password ───────────────────────── */}
                    {!isGoogleUser && (
                        <SettingsAccordion title="Change Password" isOpen={openSection === 'password'} onToggle={() => toggleSection('password')}>
                            <form className="settings-form" onSubmit={handlePasswordChange}>
                                <div className="input-group">
                                    <label>Current password</label>
                                    <input
                                        type="password"
                                        value={currentPwd}
                                        onChange={e => setCurrentPwd(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>New password</label>
                                    <input
                                        type="password"
                                        value={newPwd}
                                        onChange={e => setNewPwd(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Confirm new password</label>
                                    <input
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
                        </SettingsAccordion>
                    )}

                    {/* ── Danger Zone ───────────────────────────── */}
                    <SettingsAccordion title="Delete Account" danger isOpen={openSection === 'delete'} onToggle={() => toggleSection('delete')}>
                        <p className="settings-danger-desc">
                            Deleting your account is <strong>permanent and irreversible</strong>. All your data (sessions, friends, progress) will be permanently deleted.
                        </p>
                        <div className="input-group">
                            <label>Type <strong>DELETE</strong> to confirm</label>
                            <input
                                type="text"
                                value={deleteInput}
                                onChange={e => setDeleteInput(e.target.value)}
                                placeholder="DELETE"
                                className={deleteInput === 'DELETE' ? 'input--danger-ready' : ''}
                            />
                        </div>
                        {deleteError && <p className="settings-feedback settings-feedback--error">{deleteError}</p>}
                        <button
                            className="btn-danger"
                            onClick={handleDeleteAccount}
                            disabled={deleteInput !== 'DELETE' || deleteLoading}
                        >
                            {deleteLoading ? 'Deleting…' : 'Delete My Account'}
                        </button>
                    </SettingsAccordion>

                    <button className="btn-logout" onClick={handleLogout}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
