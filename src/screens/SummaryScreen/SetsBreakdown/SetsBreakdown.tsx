import type { SetRecord, WorkoutPlan } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';
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
                <p className="sets-breakdown-title">Exercise breakdown</p>
                {blockGroups.map((group, bi) => {
                    const blockReps = group.sets.reduce((s, set) => s + set.reps, 0);
                    const blockAvg = weightedAverageScore(group.sets);
                    return (
                        <div key={`block-${group.block.exerciseType}-${bi}`} className="set-item">
                            <div className="set-item-header">
                                <span className="set-item-num">{getExerciseLabel(group.block.exerciseType)}</span>
                                <span className="set-item-stats">
                                    {blockReps} reps · {group.sets.length} set{group.sets.length > 1 ? 's' : ''} · <ScoreGrade score={blockAvg} />
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
            <p className="sets-breakdown-title">Sets breakdown</p>
            {completedSets.map((set, i) => (
                <div key={`set-${set.reps}-${i}`} className="set-item">
                    <div className="set-item-header">
                        <span className="set-item-num">Set {i + 1}</span>
                        <span className="set-item-stats">
                            {set.reps} reps · <ScoreGrade score={set.averageScore} /> · {set.averageScore}%
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
