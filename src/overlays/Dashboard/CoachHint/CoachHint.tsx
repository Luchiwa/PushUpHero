import { useEffect, useRef, useState } from 'react';
import './CoachHint.scss';

export interface CoachHintProps {
    text: string | null;
}

export function CoachHint({ text }: CoachHintProps) {
    const [visible, setVisible] = useState(false);
    const [displayText, setDisplayText] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (text) {
            setDisplayText(text);
            setVisible(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setVisible(false), 3000);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [text]);

    if (!visible || !displayText) return null;
    return (
        <div className="coach-hint" aria-live="polite" role="status">
            <span className="coach-icon" aria-hidden="true">🎙️</span>
            <span className="coach-text">{displayText}</span>
        </div>
    );
}
