import type { CSSProperties } from 'react';
import { QuestCard as ArenaQuestCard } from '@components/QuestCard/QuestCard';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import type { QuestDef, QuestProgress, QuestCategory } from '@domain/quests';
import { isSingleSessionQuest, getQuestProgressCount, computeQuestProgressPct } from '@domain/quests';
import { getExerciseLabel } from '@exercises/types';
import type { ExerciseType } from '@exercises/types';
import './QuestCard.scss';

interface QuestCardProps {
    activeQuest: QuestDef;
    questAccepted: boolean;
    questProgress: QuestProgress;
    catMeta: { label: string; color: string } | null;
    exerciseType: ExerciseType;
    changeExerciseType: (type: ExerciseType) => void;
    onAcceptQuest: () => void;
    onQuestStart: () => void;
}

type Tone = 'ember' | 'gold' | 'purple' | 'ice' | 'good';

// Map category → Arena semantic tone. Tone is a hint only — ember stays primary.
const CATEGORY_TONE: Record<QuestCategory, Tone> = {
    onboarding: 'ember',
    exercise:   'good',
    mastery:    'gold',
    endurance:  'ember',
    variety:    'ice',
};

export function QuestCard({
    activeQuest,
    questAccepted,
    questProgress,
    catMeta,
    exerciseType,
    changeExerciseType,
    onAcceptQuest,
    onQuestStart,
}: QuestCardProps) {
    const tone: Tone = CATEGORY_TONE[activeQuest.category] ?? 'ember';
    const rewardNode = (
        <span className="home-quest-reward">
            <span className="home-quest-reward-plus">+</span>
            {activeQuest.xpReward}
            <span className="home-quest-reward-unit">XP</span>
        </span>
    );
    const kicker = catMeta?.label?.toUpperCase();

    if (!questAccepted) {
        return (
            <ArenaQuestCard
                kicker={kicker}
                title={<><span className="home-quest-emoji" aria-hidden="true">{activeQuest.emoji}</span>{activeQuest.title}</>}
                description={activeQuest.description}
                reward={rewardNode}
                tone={tone}
                footer={
                    <PrimaryCTA
                        variant="solid"
                        size="md"
                        block
                        icon="✨"
                        onClick={onAcceptQuest}
                    >
                        Accept Quest
                    </PrimaryCTA>
                }
            />
        );
    }

    const hasSpecificExercise = !!activeQuest.goal.exerciseType;
    const isCrossSession = !isSingleSessionQuest(activeQuest);
    const currentReps = isCrossSession ? getQuestProgressCount(activeQuest, questProgress) : 0;
    const goalReps = activeQuest.goal.reps;
    const remaining = Math.max(0, goalReps - currentReps);

    const repsLabel = hasSpecificExercise
        ? getExerciseLabel(activeQuest.goal.exerciseType!)
        : 'reps';
    const startLabel = isCrossSession && currentReps > 0
        ? `Start — ${remaining} ${repsLabel} left`
        : `Start — ${goalReps} ${repsLabel}`;

    const progressPct = computeQuestProgressPct(currentReps, goalReps, isCrossSession);

    return (
        <ArenaQuestCard
            kicker={kicker}
            title={<><span className="home-quest-emoji" aria-hidden="true">{activeQuest.emoji}</span>{activeQuest.title}</>}
            description={activeQuest.description}
            reward={rewardNode}
            tone={tone}
            footer={
                <PrimaryCTA
                    variant="solid"
                    size="md"
                    block
                    icon="🚀"
                    onClick={onQuestStart}
                >
                    {startLabel}
                </PrimaryCTA>
            }
        >
            {isCrossSession && currentReps > 0 && (
                <div
                    className="home-quest-progress"
                    style={{ '--home-quest-progress': `${progressPct}%` } as CSSProperties}
                >
                    <div className="home-quest-progress-track">
                        <span className="home-quest-progress-fill" />
                    </div>
                    <span className="home-quest-progress-label">
                        {currentReps}/{goalReps} {repsLabel}
                    </span>
                </div>
            )}

            {!hasSpecificExercise && (
                <div className="home-quest-picker">
                    <ExercisePicker value={exerciseType} onChange={changeExerciseType} />
                </div>
            )}
        </ArenaQuestCard>
    );
}
