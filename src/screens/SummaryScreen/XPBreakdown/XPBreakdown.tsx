import { useTranslation } from 'react-i18next';
import { getExerciseLabelKey } from '@exercises/types';
import { formatNumber, type SessionXpResult } from '@domain';
import './XPBreakdown.scss';

interface XPBreakdownProps {
    sessionXp: SessionXpResult;
}

export function XPBreakdown({ sessionXp }: XPBreakdownProps) {
    const { t } = useTranslation('workout');
    return (
        <div className="xp-breakdown">
            <div className="xp-breakdown-header">
                <span className="xp-breakdown-total">{t('summary.xp_total', { xp: formatNumber(sessionXp.totalXp) })}</span>
                {sessionXp.multiplier > 1 && (
                    <span className="xp-breakdown-multiplier">×{sessionXp.multiplier.toFixed(2)}</span>
                )}
            </div>

            {/* Per-exercise XP */}
            {sessionXp.perExercise.length > 0 && (
                <div className="xp-breakdown-exercises">
                    {sessionXp.perExercise.map(ex => (
                        <span key={ex.exerciseType} className="xp-exercise-pill">
                            {t('summary.xp_exercise_pill', { exercise: t(getExerciseLabelKey(ex.exerciseType)), xp: formatNumber(ex.finalXp) })}
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
                            {b.emoji} {t(b.labelKey, b.labelParams)} <strong>+{b.pct}%</strong>
                        </span>
                    ))}
                </div>
            )}

            {/* Raw XP line */}
            {sessionXp.multiplier > 1 && (
                <span className="xp-breakdown-raw">
                    {t('summary.xp_raw', { xp: formatNumber(sessionXp.rawXp) })}
                </span>
            )}
        </div>
    );
}
