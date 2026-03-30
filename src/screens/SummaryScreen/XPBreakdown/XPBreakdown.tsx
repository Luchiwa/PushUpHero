import { getExerciseLabel } from '@exercises/types';
import type { SessionXpResult } from '@lib/xpSystem';
import './XPBreakdown.scss';

interface XPBreakdownProps {
    sessionXp: SessionXpResult;
}

export function XPBreakdown({ sessionXp }: XPBreakdownProps) {
    return (
        <div className="xp-breakdown">
            <div className="xp-breakdown-header">
                <span className="xp-breakdown-total">+{sessionXp.totalXp.toLocaleString()} XP</span>
                {sessionXp.multiplier > 1 && (
                    <span className="xp-breakdown-multiplier">×{sessionXp.multiplier.toFixed(2)}</span>
                )}
            </div>

            {/* Per-exercise XP */}
            {sessionXp.perExercise.length > 0 && (
                <div className="xp-breakdown-exercises">
                    {sessionXp.perExercise.map(ex => (
                        <span key={ex.exerciseType} className="xp-exercise-pill">
                            {getExerciseLabel(ex.exerciseType)} +{ex.finalXp.toLocaleString()}
                            {ex.difficultyCoefficient > 1.0 && (
                                <span className="xp-difficulty-badge">×{ex.difficultyCoefficient.toFixed(1)}</span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Bonus tags */}
            {sessionXp.bonuses.length > 0 && (
                <div className="xp-breakdown-bonuses">
                    {sessionXp.bonuses.map(b => (
                        <span key={b.key} className="xp-bonus-tag">
                            {b.emoji} {b.label} <strong>+{b.pct}%</strong>
                        </span>
                    ))}
                </div>
            )}

            {/* Raw XP line */}
            {sessionXp.multiplier > 1 && (
                <span className="xp-breakdown-raw">
                    XP brute : {sessionXp.rawXp.toLocaleString()}
                </span>
            )}
        </div>
    );
}
