import { getExerciseLabel, EXERCISE_TYPES, EXERCISE_META } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
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
    return (
        <section className="progression-section">
            <h3 className="progression-section-title">🎮 Levels</h3>

            {/* Global level */}
            <div className="level-card level-card--global">
                <div className="level-card-header">
                    <span className="level-card-label">Global Level</span>
                    <span className="level-card-level">{level}</span>
                </div>
                <div className="level-progress-bar">
                    <div className="level-progress-fill" style={{ width: `${levelProgressPct}%` }} />
                </div>
                <span className="level-progress-text">
                    {xpIntoCurrentLevel.toLocaleString()} / {xpNeededForNextLevel.toLocaleString()} XP
                </span>
            </div>

            {/* Per-exercise levels */}
            <div className="level-cards-grid">
                {EXERCISE_TYPES.map(ex => {
                    const prog = getExerciseLevelProgress(ex);
                    return (
                        <div key={ex} className="level-card level-card--exercise">
                            <div className="level-card-header">
                                <span className="level-card-emoji">{EXERCISE_EMOJIS[ex]}</span>
                                <span className="level-card-label">{getExerciseLabel(ex)}</span>
                                <span className="level-card-level">{prog.level}</span>
                            </div>
                            <div className="level-progress-bar">
                                <div className="level-progress-fill" style={{ width: `${prog.progressPct}%` }} />
                            </div>
                            <span className="level-progress-text">
                                {prog.xpIntoLevel.toLocaleString()} / {prog.xpNeeded.toLocaleString()} XP
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
