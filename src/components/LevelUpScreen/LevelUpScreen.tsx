import { useEffect, useState } from 'react';
import './LevelUpScreen.scss';

interface LevelUpScreenProps {
    previousLevel: number;
    newLevel: number;
    onContinue: () => void;
}

const MOTIVATIONAL_MESSAGES = [
    'Keep pushing! 💪',
    'You\'re on fire! 🔥',
    'Unstoppable! 🚀',
    'Beast mode activated! 🦾',
    'Nothing can stop you now! ⚡',
    'Legend in the making! 🏆',
];

export function LevelUpScreen({ previousLevel, newLevel, onContinue }: LevelUpScreenProps) {
    const [phase, setPhase] = useState<'enter' | 'roll' | 'land' | 'show'>('enter');
    const message = MOTIVATIONAL_MESSAGES[(newLevel - 1) % MOTIVATIONAL_MESSAGES.length];

    // Animation sequence
    useEffect(() => {
        // Phase 1 : le titre et le cadre entrent (300ms)
        const t1 = setTimeout(() => setPhase('roll'), 400);
        // Phase 2 : le défilement commence (durée du roll)
        const t2 = setTimeout(() => setPhase('land'), 400 + rollDuration(previousLevel, newLevel));
        // Phase 3 : chiffre atterrit → particules + pulse
        const t3 = setTimeout(() => setPhase('show'), 400 + rollDuration(previousLevel, newLevel) + 120);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [previousLevel, newLevel]);

    // Build the list of level numbers to render in the slot
    // e.g. prev=3 new=5 → [3, 4, 5]
    const levels = Array.from({ length: newLevel - previousLevel + 1 }, (_, i) => previousLevel + i);
    const duration = rollDuration(previousLevel, newLevel);

    return (
        <div className="levelup-screen">
            {/* Burst particles — rendered when landing */}
            {phase !== 'enter' && phase !== 'roll' && (
                <div className="levelup-particles" aria-hidden="true">
                    {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i} className={`levelup-particle levelup-particle--${i % 4}`} style={{ '--i': i } as React.CSSProperties} />
                    ))}
                </div>
            )}

            <div className={`levelup-card levelup-card--${phase}`}>
                {/* Header */}
                <p className="levelup-label">LEVEL UP</p>

                {/* Rolling number slot */}
                <div className="levelup-slot-viewport">
                    <div
                        className={`levelup-slot-track levelup-slot-track--${phase}`}
                        style={{
                            '--level-count': levels.length,
                            '--roll-duration': `${duration}ms`,
                        } as React.CSSProperties}
                    >
                        {levels.map((lvl) => (
                            <span key={lvl} className="levelup-slot-number">
                                {lvl}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Motivational subtitle */}
                <p className={`levelup-message levelup-message--${phase}`}>{message}</p>

                {/* Continue button */}
                <button
                    className={`btn-primary levelup-btn levelup-btn--${phase}`}
                    onClick={onContinue}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

/** Duration of the roll animation in ms, scales with the number of levels crossed */
function rollDuration(prev: number, next: number): number {
    const levels = next - prev;
    // Base 600ms + 200ms per extra level, capped at 2000ms
    return Math.min(600 + (levels - 1) * 200, 2000);
}
