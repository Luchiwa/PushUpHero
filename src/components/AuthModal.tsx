import { useState, useRef, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
    const { loginWithGoogle } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const emailInputRef = useRef<HTMLInputElement>(null);
    const usernameInputRef = useRef<HTMLInputElement>(null);

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
            // In a real app we'd also let them pick a username if they are new,
            // but for simplicity we rely on Google displayName or generate one.
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Google Sign-In error');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'register') {
                if (username.trim().length < 3) {
                    throw new Error("Username must be at least 3 characters");
                }
                const cleanUsername = username.trim().toLowerCase();

                // 1. Transaction to claim the username
                await runTransaction(db, async (transaction) => {
                    const usernameRef = doc(db, 'usernames', cleanUsername);
                    const usernameDoc = await transaction.get(usernameRef);

                    if (usernameDoc.exists()) {
                        throw new Error("This username is already taken!");
                    }

                    // Create the user in Auth
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;

                    // Claim username 
                    transaction.set(usernameRef, { uid: user.uid });

                    // Create base DB profile
                    const userRef = doc(db, 'users', user.uid);
                    transaction.set(userRef, {
                        uid: user.uid,
                        displayName: username.trim(),
                        level: 1, // Will be merged from localstorage later
                        totalReps: 0,
                        createdAt: Date.now()
                    });
                });
            } else {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
            }
            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error(err);
            // Translate common firebase errors
            let msg = err.message;
            if (msg.includes('auth/email-already-in-use')) msg = "This email is already in use.";
            if (msg.includes('auth/invalid-credential')) msg = "Incorrect email or password.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-modal-overlay">
            <div className="auth-modal-card">
                <button className="auth-close-btn" onClick={onClose}>×</button>

                <h2 className="auth-title">
                    {mode === 'register' ? 'Create an account' : 'Sign in'}
                </h2>
                <p className="auth-subtitle">
                    {mode === 'register'
                        ? 'Save your sessions and level to the cloud.'
                        : 'Pick up where you left off.'}
                </p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleEmailAuth} className="auth-form">
                    {mode === 'register' && (
                        <div className="input-group">
                            <label>Username</label>
                            <input
                                ref={usernameInputRef}
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Goku99"
                                required
                                minLength={3}
                                maxLength={20}
                            />
                        </div>
                    )}
                    <div className="input-group">
                        <label>Email</label>
                        <input
                            ref={emailInputRef}
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="hero@example.com"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                        {loading ? 'Loading...' : (mode === 'register' ? "Sign up" : "Sign in")}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <button type="button" className="btn-google" onClick={handleGoogle} disabled={loading}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <p className="auth-switch">
                    {mode === 'register' ? 'Already have an account?' : "Don't have an account?"}
                    <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
                        {mode === 'register' ? 'Sign in' : "Sign up"}
                    </button>
                </p>
            </div>
        </div>
    );
}
