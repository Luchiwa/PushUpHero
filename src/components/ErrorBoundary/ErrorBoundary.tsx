import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Compact inline fallback for granular error boundaries around sections/modals. */
export function SectionErrorFallback({ onRetry }: { onRetry?: () => void }) {
    const { t } = useTranslation();
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '2rem', textAlign: 'center',
            color: '#1a1a1a', minHeight: '120px',
        }}>
            <p style={{ fontSize: '0.9rem', color: 'rgba(26,26,26,0.6)', marginBottom: '0.75rem' }}>
                {t('error.section_message')}
            </p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    style={{
                        padding: '0.5rem 1rem', background: '#ff7f00', color: '#fff',
                        border: 'none', borderRadius: '8px', fontSize: '0.85rem',
                        fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    {t('action.retry')}
                </button>
            )}
        </div>
    );
}

/** Root-level fallback used when no `fallback` prop is passed. Functional so we
 *  can call `useTranslation` (the surrounding ErrorBoundary is a class). */
function RootErrorFallback({ message, onRetry }: { message: string | undefined; onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100dvh',
            padding: '2rem',
            textAlign: 'center',
            color: '#1a1a1a',
            background: '#ffffff',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                {t('error.root_title')}
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(26,26,26,0.6)', marginBottom: '1.5rem', maxWidth: '320px' }}>
                {message || t('error.root_default')}
            </p>
            <button
                type="button"
                onClick={onRetry}
                style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #ff7f00, #ff9c35)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255,127,0,0.3)',
                }}
            >
                {t('error.btn_try_again')}
            </button>
        </div>
    );
}

interface Props {
    children: ReactNode;
    /** Custom fallback UI. Pass `"section"` for the compact inline fallback. */
    fallback?: ReactNode | 'section';
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback === 'section') {
                return <SectionErrorFallback onRetry={this.handleRetry} />;
            }
            if (this.props.fallback) return this.props.fallback;

            return <RootErrorFallback message={this.state.error?.message} onRetry={this.handleRetry} />;
        }

        return this.props.children;
    }
}
