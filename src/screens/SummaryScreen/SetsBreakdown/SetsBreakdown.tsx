import { useTranslation } from 'react-i18next';
import { getExerciseLabelKey, type SetRecord, type WorkoutPlan } from '@exercises/types';
import { getGradeClass, getGradeLetter, weightedAverageScore } from '@domain';
import './SetsBreakdown.scss';

function ScoreGrade({ score }: { score: number }) {
    return <span className={`grade ${getGradeClass(score)}`}>{getGradeLetter(score)}</span>;
}

interface SetsBreakdownProps {
    isMultiExercise: boolean;
    isMultiSet: boolean;
    workoutPlan: WorkoutPlan;
    completedSets: SetRecord[];
}

export function SetsBreakdown({ isMultiExercise, isMultiSet, workoutPlan, completedSets }: SetsBreakdownProps) {
    const { t } = useTranslation('workout');
    if (!isMultiSet) return null;

    if (isMultiExercise) {
        const blockGroups: { block: WorkoutPlan['blocks'][number]; sets: SetRecord[] }[] = [];
        let setIdx = 0;
        for (const block of workoutPlan.blocks) {
            const blockSets = completedSets.slice(setIdx, setIdx + block.numberOfSets);
            blockGroups.push({ block, sets: blockSets });
            setIdx += block.numberOfSets;
        }
        return (
            <div className="sets-breakdown">
                <p className="sets-breakdown-title">{t('summary.exercise_breakdown')}</p>
                {blockGroups.map((group, bi) => {
                    const blockReps = group.sets.reduce((s, set) => s + set.reps, 0);
                    const blockAvg = weightedAverageScore(group.sets);
                    return (
                        <div key={`block-${group.block.exerciseType}-${bi}`} className="set-item">
                            <div className="set-item-header">
                                <span className="set-item-num">{t(getExerciseLabelKey(group.block.exerciseType))}</span>
                                <span className="set-item-stats">
                                    {t('common:unit.rep', { count: blockReps })} · {t('common:unit.set', { count: group.sets.length })} · <ScoreGrade score={blockAvg} />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="sets-breakdown">
            <p className="sets-breakdown-title">{t('summary.sets_breakdown')}</p>
            {completedSets.map((set, i) => (
                <div key={`set-${set.reps}-${i}`} className="set-item">
                    <div className="set-item-header">
                        <span className="set-item-num">{t('summary.set_n', { n: i + 1 })}</span>
                        <span className="set-item-stats">
                            {t('common:unit.rep', { count: set.reps })} · <ScoreGrade score={set.averageScore} /> · {set.averageScore}%
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
