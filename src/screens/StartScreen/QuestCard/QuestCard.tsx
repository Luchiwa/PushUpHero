import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestCard as ArenaQuestCard } from '@components/QuestCard/QuestCard';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { computeQuestProgressPct, getQuestProgressCount, getQuestTitle, getQuestDescription, isSingleSessionQuest, type QuestCategory, type QuestDef, type QuestProgress } from '@domain';
import { getExerciseLabelKey, type ExerciseType } from '@exercises/types';
import './QuestCard.scss';

interface QuestCardProps {
    activeQuest: QuestDef;
    questAccepted: boolean;
    questProgress: QuestProgress;
    catMeta: { labelKey: string; color: string } | null;
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
    const { t } = useTranslation('quests');
    const tone: Tone = CATEGORY_TONE[activeQuest.category] ?? 'ember';
    const rewardNode = (
        <span className="home-quest-reward">
            <span className="home-quest-reward-plus">+</span>
            {activeQuest.xpReward}
            <span className="home-quest-reward-unit">XP</span>
        </span>
    );
    const kicker = catMeta ? t(catMeta.labelKey).toUpperCase() : t('summary_card.kicker_default');
    const questTitle = getQuestTitle(activeQuest, t);
    const questDescription = getQuestDescription(activeQuest, t);

    if (!questAccepted) {
        return (
            <ArenaQuestCard
                kicker={kicker}
                title={<><span className="home-quest-emoji" aria-hidden="true">{activeQuest.emoji}</span>{questTitle}</>}
                description={questDescription}
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
                        {t('summary_card.accept')}
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
        ? t(getExerciseLabelKey(activeQuest.goal.exerciseType!))
        : t('summary_card.reps_label');
    const startLabel = isCrossSession && currentReps > 0
        ? t('summary_card.start_remaining', { count: remaining, exercise: repsLabel })
        : t('summary_card.start_total', { count: goalReps, exercise: repsLabel });

    const progressPct = computeQuestProgressPct(currentReps, goalReps, isCrossSession);

    return (
        <ArenaQuestCard
            kicker={kicker}
            title={<><span className="home-quest-emoji" aria-hidden="true">{activeQuest.emoji}</span>{questTitle}</>}
            description={questDescription}
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
                        {t('summary_card.progress_count', { current: currentReps, goal: goalReps, exercise: repsLabel })}
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
