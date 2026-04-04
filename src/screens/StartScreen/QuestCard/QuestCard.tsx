import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import type { QuestDef } from '@domain/quests';
import { getExerciseLabel } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import './QuestCard.scss';

interface QuestCardProps {
    activeQuest: QuestDef;
    questAccepted: boolean;
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
    const startLabel = hasSpecificExercise
        ? `🚀 Start — ${activeQuest.goal.reps} ${getExerciseLabel(activeQuest.goal.exerciseType!)}`
        : `🚀 Start — ${activeQuest.goal.reps} reps`;

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
