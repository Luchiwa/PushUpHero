import { useEffect, useRef, useState } from 'react';
import './CoachHint.scss';

export interface CoachHintProps {
    text: string | null;
}

export function CoachHint({ text }: CoachHintProps) {
    const [visible, setVisible] = useState(false);
    const [displayText, setDisplayText] = useState('');
    const [prevText, setPrevText] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Derive state from prop changes during render (getDerivedStateFromProps pattern)
    if (text !== prevText) {
        setPrevText(text);
        if (text) {
            setDisplayText(text);
            setVisible(true);
        }
    }

    // Auto-hide after 3 seconds (setTimeout callback — not synchronous setState)
    useEffect(() => {
        if (!visible) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), 3000);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [visible, text]);

    if (!visible || !displayText) return null;
    return (
        <div className="coach-hint" aria-live="polite" role="status">
            <span className="coach-icon" aria-hidden="true">🎙️</span>
            <span className="coach-text">{displayText}</span>
        </div>
    );
}
