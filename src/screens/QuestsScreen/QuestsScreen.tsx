/**
 * QuestsScreen — Full-screen quest journal showing all quests grouped by category.
 * Each quest shows its status: completed, available (playable), accepted (active), or locked.
 * Supports multiple accepted quests (up to MAX_ACCEPTED_QUESTS) and quick-start.
 */
import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { PageLayout } from '@components/PageLayout/PageLayout';
import {
    QUEST_CATEGORY_META,
    getQuestStatus,
    getQuestStats,
    getQuestsByCategory,
    getQuestById,
    getAcceptedQuests,
    getQuestTitle,
    getQuestDescription,
    isQuestQuickStartable,
    isSingleSessionQuest,
    getQuestProgressCount,
    getComplexQuestHint,
    MAX_ACCEPTED_QUESTS,
    formatDate,
    type QuestDef, type QuestProgress, type QuestStatus,
} from '@domain';
import { getExerciseLabelKey } from '@exercises/types';
import './QuestsScreen.scss';

interface QuestsScreenProps {
    onClose: () => void;
    questProgress: QuestProgress;
    userLevel: number;
    onAcceptQuest?: (questId: string) => void;
    onAbandonQuest?: (questId: string) => void;
    onQuestStart?: (quest: QuestDef) => void;
}

export function QuestsScreen({
    onClose,
    questProgress,
    userLevel,
    onAcceptQuest,
    onAbandonQuest,
    onQuestStart,
}: QuestsScreenProps) {
    const { t } = useTranslation('quests');
    const stats = useMemo(() => getQuestStats(questProgress), [questProgress]);
    const byCategory = useMemo(() => getQuestsByCategory(), []);
    const acceptedQuests = useMemo(() => getAcceptedQuests(questProgress, userLevel), [questProgress, userLevel]);
    const slotsUsed = acceptedQuests.length;
    const slotsFull = slotsUsed >= MAX_ACCEPTED_QUESTS;

    const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    const subText = stats.completed === stats.total
        ? t('screen.all_completed')
        : slotsUsed > 0
            ? t('screen.active_remaining', { active: slotsUsed, max: MAX_ACCEPTED_QUESTS, remaining: stats.available })
            : t('screen.remaining', { count: stats.available });

    return (
        <PageLayout title={t('screen.title')} onClose={onClose} zIndex={200} bodyClassName="quests-body">
            {/* ── Header stats ────────────────────────────────────── */}
            <div className="quests-header">
                <div className="quests-header-ring">
                    <svg viewBox="0 0 40 40" className="quests-ring-svg">
                        <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3" className="quests-ring-track" />
                        <circle
                            cx="20" cy="20" r="17"
                            fill="none"
                            stroke="url(#quest-grad)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${progressPct * 1.068} 106.8`}
                            transform="rotate(-90 20 20)"
                        />
                        <defs>
                            <linearGradient id="quest-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" className="quests-ring-stop-start" />
                                <stop offset="100%" className="quests-ring-stop-end" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="quests-ring-text">{stats.completed}/{stats.total}</span>
                </div>
                <div className="quests-header-info">
                    <span className="quests-header-title">{t('screen.header_title')}</span>
                    <span className="quests-header-sub">{subText}</span>
                </div>
            </div>

            {/* ── Quest categories ─────────────────────────────────── */}
            {Array.from(byCategory.entries()).map(([category, quests], catIdx) => {
                const meta = QUEST_CATEGORY_META[category];
                const catCompleted = quests.filter(q => questProgress.completed[q.id]).length;
                return (
                    <section
                        key={category}
                        className="quests-category"
                        style={{ '--category-color': meta.color, '--i': catIdx } as CSSProperties}
                    >
                        <div className="quests-category-header">
                            <span className="quests-category-label">{t(meta.labelKey)}</span>
                            <span className="quests-category-count">{catCompleted}/{quests.length}</span>
                        </div>
                        <div className="quests-list">
                            {quests.map((quest, i) => (
                                <QuestCard
                                    key={quest.id}
                                    quest={quest}
                                    status={getQuestStatus(quest, questProgress, userLevel)}
                                    questProgress={questProgress}
                                    completedAt={questProgress.completed[quest.id] ?? null}
                                    userLevel={userLevel}
                                    slotsFull={slotsFull}
                                    onAccept={onAcceptQuest}
                                    onAbandon={onAbandonQuest}
                                    onStart={onQuestStart}
                                    categoryColor={meta.color}
                                    index={i}
                                    t={t}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </PageLayout>
    );
}

// ── Individual quest card ────────────────────────────────────────

function QuestCard({
    quest,
    status,
    questProgress,
    completedAt,
    userLevel,
    slotsFull,
    onAccept,
    onAbandon,
    onStart,
    categoryColor,
    index,
    t,
}: {
    quest: QuestDef;
    status: QuestStatus;
    questProgress: QuestProgress;
    completedAt: number | null;
    userLevel: number;
    slotsFull: boolean;
    onAccept?: (questId: string) => void;
    onAbandon?: (questId: string) => void;
    onStart?: (quest: QuestDef) => void;
    categoryColor: string;
    index: number;
    t: TFunction<'quests'>;
}) {
    const lockReason = useMemo(() => {
        if (status !== 'locked') return null;
        const reasons: string[] = [];
        if (quest.requiredLevel > 0 && userLevel < quest.requiredLevel) {
            reasons.push(t('card.level_required', { level: quest.requiredLevel }));
        }
        for (const preId of quest.prerequisites) {
            const pre = getQuestById(preId);
            if (pre) reasons.push(t('card.complete_first', { title: getQuestTitle(pre, t) }));
        }
        return reasons.join(' · ') || t('card.locked');
    }, [status, quest, userLevel, t]);

    const quickStartable = isQuestQuickStartable(quest);
    const complexHint = getComplexQuestHint(quest);
    const complexHintLabel = complexHint === 'multi_exercise'
        ? t('complex_hint.multi_exercise')
        : complexHint === 'multi_set'
            ? t('complex_hint.multi_set')
            : null;
    const startLabel = quest.goal.exerciseType
        ? t('card.start_with_exercise', { count: quest.goal.reps, exercise: t(getExerciseLabelKey(quest.goal.exerciseType)) })
        : t('card.start_with_reps', { count: quest.goal.reps });

    return (
        <div
            className={`quest-item quest-item--${status}`}
            style={{ '--category-color': categoryColor, '--i': index } as CSSProperties}
        >
            <div className="quest-item-left">
                <span className="quest-item-emoji">
                    {status === 'locked' ? '🔒' : quest.emoji}
                </span>
            </div>
            <div className="quest-item-body">
                <div className="quest-item-top">
                    <span className="quest-item-title">{getQuestTitle(quest, t)}</span>
                    {status === 'completed' && (
                        <span className="quest-item-check">✅</span>
                    )}
                    {status === 'accepted' && (
                        <span className="quest-item-active-badge">{t('card.active_badge')}</span>
                    )}
                </div>
                <p className="quest-item-desc">{getQuestDescription(quest, t)}</p>
                {status === 'locked' && lockReason && (
                    <span className="quest-item-lock-reason">{lockReason}</span>
                )}
                {status === 'completed' && completedAt && (
                    <span className="quest-item-date">
                        {t('card.completed_on', { date: formatDate(completedAt) })}
                    </span>
                )}
                {/* ── Progress bar (cross-session accepted quests) ── */}
                {status === 'accepted' && !isSingleSessionQuest(quest) && (() => {
                    const current = getQuestProgressCount(quest, questProgress);
                    const goal = quest.goal.reps;
                    const pct = Math.min(100, Math.round((current / goal) * 100));
                    return (
                        <div className="quest-item-progress">
                            <div className="quest-item-progress-bar">
                                <div className="quest-item-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="quest-item-progress-label">{t('card.progress', { current, goal })}</span>
                        </div>
                    );
                })()}
                {/* ── Available: Accept button (disabled if slots full) ── */}
                {status === 'available' && onAccept && (
                    slotsFull ? (
                        <span className="quest-item-slots-full">{t('card.max_active', { max: MAX_ACCEPTED_QUESTS })}</span>
                    ) : (
                        <button
                            type="button"
                            className="quest-item-accept"
                            onClick={() => onAccept(quest.id)}
                        >
                            {t('card.accept')}
                        </button>
                    )
                )}
                {/* ── Accepted: Start / Hint / Abandon ── */}
                {status === 'accepted' && (
                    <div className="quest-item-actions">
                        {quickStartable && onStart ? (
                            <button
                                type="button"
                                className="quest-item-start"
                                onClick={() => onStart(quest)}
                            >
                                {startLabel}
                            </button>
                        ) : complexHintLabel ? (
                            <span className="quest-item-hint">{complexHintLabel}</span>
                        ) : null}
                        {onAbandon && (
                            <button
                                type="button"
                                className="quest-item-abandon"
                                onClick={() => onAbandon(quest.id)}
                            >
                                {t('card.abandon')}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className="quest-item-right">
                <span className={`quest-item-xp quest-item-xp--${status}`}>
                    +{quest.xpReward} XP
                </span>
            </div>
        </div>
    );
}
