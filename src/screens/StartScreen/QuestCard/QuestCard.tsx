import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import type { QuestDef, QuestProgress } from '@domain/quests';
import { isSingleSessionQuest, getQuestProgressCount } from '@domain/quests';
import { getExerciseLabel } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import './QuestCard.scss';

interface QuestCardProps {
    activeQuest: QuestDef;
    questAccepted: boolean;
    questProgress: QuestProgress;
    catMeta: { label: string; color: string } | null;
    isReady: boolean;
    exerciseType: ExerciseType;
    changeExerciseType: (type: ExerciseType) => void;
    onAcceptQuest: () => void;
    onQuestStart: () => void;
}

export function QuestCard({
    activeQuest,
    questAccepted,
    questProgress,
    catMeta,
    isReady,
    exerciseType,
    changeExerciseType,
    onAcceptQuest,
    onQuestStart,
}: QuestCardProps) {
    if (!questAccepted) {
        return (
            <div className="quest-card" style={{ '--quest-color': catMeta?.color ?? '#6366f1' } as React.CSSProperties}>
                <div className="quest-card-header">
                    <span className="quest-card-badge" style={{ background: catMeta?.color }}>{catMeta?.label}</span>
                    <span className="quest-card-xp">+{activeQuest.xpReward} XP</span>
                </div>
                <div className="quest-card-main">
                    <span className="quest-card-emoji">{activeQuest.emoji}</span>
                    <div className="quest-card-text">
                        <h3 className="quest-card-title">{activeQuest.title}</h3>
                        <p className="quest-card-desc">{activeQuest.description}</p>
                    </div>
                </div>
                <button type="button" className="quest-card-accept" onClick={onAcceptQuest} disabled={!isReady}>
                    ✨ Accept Quest
                </button>
            </div>
        );
    }

    // Accepted + quick-startable → show Start button
    const hasSpecificExercise = !!activeQuest.goal.exerciseType;
    const isCrossSession = !isSingleSessionQuest(activeQuest);
    const currentReps = isCrossSession ? getQuestProgressCount(activeQuest, questProgress) : 0;
    const goalReps = activeQuest.goal.reps;
    const remaining = Math.max(0, goalReps - currentReps);

    const repsLabel = hasSpecificExercise
        ? getExerciseLabel(activeQuest.goal.exerciseType!)
        : 'reps';
    const startLabel = isCrossSession && currentReps > 0
        ? `🚀 Start — ${remaining} ${repsLabel} left`
        : `🚀 Start — ${goalReps} ${repsLabel}`;

    const progressPct = isCrossSession ? Math.min(100, Math.round((currentReps / goalReps) * 100)) : 0;

    return (
        <div className="quest-card quest-card--active" style={{ '--quest-color': catMeta?.color ?? '#6366f1' } as React.CSSProperties}>
            <div className="quest-card-header">
                <span className="quest-card-badge" style={{ background: catMeta?.color }}>{catMeta?.label}</span>
                <span className="quest-card-xp">+{activeQuest.xpReward} XP</span>
            </div>
            <div className="quest-card-main">
                <span className="quest-card-emoji">{activeQuest.emoji}</span>
                <div className="quest-card-text">
                    <h3 className="quest-card-title">{activeQuest.title}</h3>
                    <p className="quest-card-desc">{activeQuest.description}</p>
                </div>
            </div>

            {isCrossSession && currentReps > 0 && (
                <div className="quest-card-progress">
                    <div className="quest-card-progress-bar">
                        <div className="quest-card-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="quest-card-progress-label">{currentReps}/{goalReps} {repsLabel}</span>
                </div>
            )}

            {!hasSpecificExercise && (
                <div className="quest-card-config">
                    <ExercisePicker value={exerciseType} onChange={changeExerciseType} />
                </div>
            )}

            <button type="button" className="quest-card-start" onClick={onQuestStart} disabled={!isReady}>
                {isReady ? startLabel : 'Getting Ready…'}
            </button>
        </div>
    );
}
