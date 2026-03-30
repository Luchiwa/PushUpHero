import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import type { QuestDef } from '@lib/quests';
import type { ExerciseType } from '@exercises/types';
import './QuestCard.scss';

interface QuestCardProps {
    activeQuest: QuestDef;
    questAccepted: boolean;
    isCalibrationQuest: boolean;
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
    isCalibrationQuest,
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

    if (isCalibrationQuest) {
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

                <div className="quest-card-config">
                    <ExercisePicker value={exerciseType} onChange={changeExerciseType} />
                </div>

                <button type="button" className="quest-card-start" onClick={onQuestStart} disabled={!isReady}>
                    {isReady ? `🚀 Start — ${activeQuest.goal.reps} reps` : 'Getting Ready…'}
                </button>
            </div>
        );
    }

    return (
        <div className="quest-card quest-card--active" style={{ '--quest-color': catMeta?.color ?? '#6366f1' } as React.CSSProperties}>
            <div className="quest-card-header">
                <span className="quest-card-badge" style={{ background: catMeta?.color }}>{catMeta?.label}</span>
                <span className="quest-card-status">In progress</span>
                <span className="quest-card-xp">+{activeQuest.xpReward} XP</span>
            </div>
            <div className="quest-card-main">
                <span className="quest-card-emoji">{activeQuest.emoji}</span>
                <div className="quest-card-text">
                    <h3 className="quest-card-title">{activeQuest.title}</h3>
                    <p className="quest-card-desc">{activeQuest.description}</p>
                </div>
            </div>
            <p className="quest-card-hint">Complete a session to progress this quest.</p>
        </div>
    );
}
