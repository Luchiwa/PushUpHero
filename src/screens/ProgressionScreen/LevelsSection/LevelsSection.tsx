import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@domain';
import { EXERCISE_META, EXERCISE_TYPES, getExerciseLabelKey, type ExerciseType } from '@exercises/types';
import './LevelsSection.scss';

const EXERCISE_EMOJIS: Record<ExerciseType, string> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m.emoji]),
) as Record<ExerciseType, string>;

interface ExerciseLevelProgress {
    level: number;
    xpIntoLevel: number;
    xpNeeded: number;
    progressPct: number;
}

interface LevelsSectionProps {
    level: number;
    levelProgressPct: number;
    xpIntoCurrentLevel: number;
    xpNeededForNextLevel: number;
    getExerciseLevelProgress: (ex: ExerciseType) => ExerciseLevelProgress;
}

export function LevelsSection({
    level,
    levelProgressPct,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    getExerciseLevelProgress,
}: LevelsSectionProps) {
    const { t } = useTranslation('stats');
    return (
        <section className="progression-section">
            <h3 className="progression-section-title">{t('progression.section_levels')}</h3>

            {/* Global level — hero card */}
            <div className="level-card level-card--global">
                <div className="level-card-header">
                    <span className="level-card-label">{t('progression.global_level_label')}</span>
                    <div className="level-card-hero">
                        <span className="level-card-hero-label">{t('progression.level_kicker')}</span>
                        <span className="level-card-hero-value">{level}</span>
                    </div>
                </div>
                <div className="level-progress-bar">
                    <div className="level-progress-fill" style={{ width: `${levelProgressPct}%` }} />
                </div>
                <span className="level-progress-text">
                    {t('progression.xp_progress', { current: formatNumber(xpIntoCurrentLevel), total: formatNumber(xpNeededForNextLevel) })}
                </span>
            </div>

            {/* Per-exercise levels — 2x2 grid */}
            <div className="level-cards-grid">
                {EXERCISE_TYPES.map((ex, i) => {
                    const prog = getExerciseLevelProgress(ex);
                    return (
                        <div
                            key={ex}
                            className="level-card level-card--exercise"
                            style={{ '--i': i } as CSSProperties}
                        >
                            <div className="level-card-header">
                                <span className="level-card-emoji">{EXERCISE_EMOJIS[ex]}</span>
                                <span className="level-card-label">{t(getExerciseLabelKey(ex))}</span>
                                <span className="level-card-level">{prog.level}</span>
                            </div>
                            <div className="level-progress-bar">
                                <div className="level-progress-fill" style={{ width: `${prog.progressPct}%` }} />
                            </div>
                            <span className="level-progress-text">
                                {t('progression.xp_progress', { current: prog.xpIntoLevel.toLocaleString(), total: prog.xpNeeded.toLocaleString() })}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
