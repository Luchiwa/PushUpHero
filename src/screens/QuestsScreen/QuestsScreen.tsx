/**
 * QuestsScreen — Full-screen quest journal showing all quests grouped by category.
 * Each quest shows its status: completed (✅), available (playable), or locked (🔒).
 * Accessible from StartScreen and ProfileModal.
 */
import { useMemo } from 'react';
import { PageLayout } from '@components/PageLayout/PageLayout';
import {
    QUEST_CATEGORY_META,
    getQuestStatus,
    getQuestStats,
    getQuestsByCategory,
    getQuestById,
} from '@lib/quests';
import type { QuestDef, QuestProgress, QuestStatus } from '@lib/quests';
import './QuestsScreen.scss';

interface QuestsScreenProps {
    onClose: () => void;
    questProgress: QuestProgress;
    userLevel: number;
    onAcceptQuest?: (questId: string) => void;
}

export function QuestsScreen({ onClose, questProgress, userLevel, onAcceptQuest }: QuestsScreenProps) {
    const stats = useMemo(() => getQuestStats(questProgress), [questProgress]);
    const byCategory = useMemo(() => getQuestsByCategory(), []);

    const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    return (
        <PageLayout title="Quests" onClose={onClose} zIndex={200} bodyClassName="quests-body">
            {/* ── Header stats ────────────────────────────────────── */}
            <div className="quests-header">
                <div className="quests-header-ring">
                    <svg viewBox="0 0 40 40" className="quests-ring-svg">
                        <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.1" />
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
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="quests-ring-text">{stats.completed}/{stats.total}</span>
                </div>
                <div className="quests-header-info">
                    <span className="quests-header-title">Quest Progress</span>
                    <span className="quests-header-sub">
                        {stats.completed === stats.total
                            ? 'All quests completed! 🎉'
                            : `${stats.available} quest${stats.available !== 1 ? 's' : ''} remaining`
                        }
                    </span>
                </div>
            </div>

            {/* ── Quest categories ─────────────────────────────────── */}
            {Array.from(byCategory.entries()).map(([category, quests]) => {
                const meta = QUEST_CATEGORY_META[category];
                const catCompleted = quests.filter(q => questProgress.completed[q.id]).length;
                return (
                    <section key={category} className="quests-category">
                        <div className="quests-category-header">
                            <span
                                className="quests-category-dot"
                                style={{ background: meta.color }}
                            />
                            <span className="quests-category-label">{meta.label}</span>
                            <span className="quests-category-count">{catCompleted}/{quests.length}</span>
                        </div>
                        <div className="quests-list">
                            {quests.map(quest => (
                                <QuestCard
                                    key={quest.id}
                                    quest={quest}
                                    status={getQuestStatus(quest, questProgress, userLevel)}
                                    completedAt={questProgress.completed[quest.id] ?? null}
                                    userLevel={userLevel}
                                    onAccept={onAcceptQuest}
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
    completedAt,
    userLevel,
    onAccept,
}: {
    quest: QuestDef;
    status: QuestStatus;
    completedAt: number | null;
    userLevel: number;
    onAccept?: (questId: string) => void;
}) {
    const lockReason = useMemo(() => {
        if (status !== 'locked') return null;
        const reasons: string[] = [];
        // Check level
        if (quest.requiredLevel > 0 && userLevel < quest.requiredLevel) {
            reasons.push(`Level ${quest.requiredLevel} required`);
        }
        // Check quest prerequisites
        for (const preId of quest.prerequisites) {
            const pre = getQuestById(preId);
            if (pre) reasons.push(`Complete "${pre.title}" first`);
        }
        return reasons.join(' · ') || 'Locked';
    }, [status, quest, userLevel]);

    return (
        <div className={`quest-item quest-item--${status}`}>
            <div className="quest-item-left">
                <span className="quest-item-emoji">
                    {status === 'locked' ? '🔒' : quest.emoji}
                </span>
            </div>
            <div className="quest-item-body">
                <div className="quest-item-top">
                    <span className="quest-item-title">{quest.title}</span>
                    {status === 'completed' && (
                        <span className="quest-item-check">✅</span>
                    )}
                    {status === 'accepted' && (
                        <span className="quest-item-active-badge">Active</span>
                    )}
                </div>
                <p className="quest-item-desc">{quest.description}</p>
                {status === 'locked' && lockReason && (
                    <span className="quest-item-lock-reason">{lockReason}</span>
                )}
                {status === 'completed' && completedAt && (
                    <span className="quest-item-date">
                        Completed {new Date(completedAt).toLocaleDateString()}
                    </span>
                )}
                {status === 'available' && onAccept && (
                    <button
                        type="button"
                        className="quest-item-accept"
                        onClick={() => onAccept(quest.id)}
                    >
                        ✨ Accept
                    </button>
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
