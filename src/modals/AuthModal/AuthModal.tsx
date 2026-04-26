import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './AuthModal.scss';
import { loginWithEmail, registerWithEmail, translateAuthError } from '@services/authService';
import { useAuthCore } from '@hooks/useAuth';
import { useModalClose } from '@hooks/shared/useModalClose';
import { useFocusTrap } from '@hooks/shared/useFocusTrap';

interface AuthModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    /** Force the modal to open in 'login' or 'register' mode (default: 'login') */
    initialMode?: 'login' | 'register';
    /** Optional promotional banner shown above the form */
    promoBanner?: React.ReactNode;
}

export function AuthModal({ onClose, onSuccess, initialMode = 'login', promoBanner }: AuthModalProps) {
    const { t } = useTranslation('modals');
    const { loginWithGoogle } = useAuthCore();
    const [mode, setMode] = useState<'login' | 'register'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { closing, handleClose, handleAnimationEnd } = useModalClose(onClose);
    const modalRef = useRef<HTMLDivElement>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);
    const usernameInputRef = useRef<HTMLInputElement>(null);
    useFocusTrap(modalRef);

    // Focus on the appropriate first field when mode changes or modal opens
    useEffect(() => {
        if (mode === 'register' && usernameInputRef.current) {
            usernameInputRef.current.focus();
        } else if (mode === 'login' && emailInputRef.current) {
            emailInputRef.current.focus();
        }
    }, [mode]);

    const handleGoogle = async () => {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
            onSuccess?.();
            onClose();
        } catch (err: unknown) {
            setError(t(translateAuthError(err)));
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (mode === 'register' && username.trim().length < 3) {
            setError(t('auth.username_too_short'));
            return;
        }

        setLoading(true);
        try {
            if (mode === 'register') {
                await registerWithEmail(email, password, username);
            } else {
                await loginWithEmail(email, password);
            }
            onSuccess?.();
            onClose();
        } catch (err: unknown) {
            console.error(err);
            setError(t(translateAuthError(err)));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            ref={modalRef}
            className={`auth-modal-overlay${closing ? ' auth-modal-overlay--exit' : ''}`}
            onAnimationEnd={handleAnimationEnd}
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'register' ? t('auth.title_register') : t('auth.title_login')}
        >
            <div className={`auth-modal-card${closing ? ' auth-modal-card--exit' : ''}`}>
                <button className="auth-close-btn" onClick={handleClose} aria-label={t('auth.close_aria')}>×</button>

                <h2 className="auth-title">
                    {mode === 'register' ? t('auth.title_register') : t('auth.title_login')}
                </h2>
                <p className="auth-subtitle">
                    {mode === 'register' ? t('auth.subtitle_register') : t('auth.subtitle_login')}
                </p>

                {promoBanner && mode === 'register' && (
                    <div className="auth-promo-banner">{promoBanner}</div>
                )}

                {error && <div id="auth-form-error" className="auth-error" role="alert">{error}</div>}

                <form onSubmit={handleEmailAuth} className="auth-form">
                    {mode === 'register' && (
                        <div className="input-group">
                            <label htmlFor="auth-username">{t('auth.label_username')}</label>
                            <input
                                id="auth-username"
                                ref={usernameInputRef}
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={t('auth.username_placeholder')}
                                required
                                minLength={3}
                                maxLength={20}
                                aria-describedby={error ? 'auth-form-error' : undefined}
                                aria-invalid={!!error || undefined}
                            />
                        </div>
                    )}
                    <div className="input-group">
                        <label htmlFor="auth-email">{t('auth.label_email')}</label>
                        <input
                            id="auth-email"
                            ref={emailInputRef}
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder={t('auth.email_placeholder')}
                            required
                            aria-describedby={error ? 'auth-form-error' : undefined}
                            aria-invalid={!!error || undefined}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="auth-password">{t('auth.label_password')}</label>
                        <input
                            id="auth-password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={t('auth.password_placeholder')}
                            required
                            minLength={6}
                            aria-describedby={error ? 'auth-form-error' : undefined}
                            aria-invalid={!!error || undefined}
                        />
                    </div>

                    <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                        {loading ? t('auth.btn_loading') : (mode === 'register' ? t('auth.btn_signup') : t('auth.btn_signin'))}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>{t('auth.or')}</span>
                </div>

                <button type="button" className="btn-google" onClick={handleGoogle} disabled={loading}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t('auth.google_continue')}
                </button>

                <p className="auth-switch">
                    {mode === 'register' ? t('auth.switch_to_login') : t('auth.switch_to_register')}
                    <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
                        {mode === 'register' ? t('auth.btn_signin') : t('auth.btn_signup')}
                    </button>
                </p>
            </div>
        </div>
    );
}
