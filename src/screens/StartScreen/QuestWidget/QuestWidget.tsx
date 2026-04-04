import type { QuestDef } from '@domain/quests';
import './QuestWidget.scss';

interface QuestWidgetProps {
    activeQuest?: QuestDef | null;
    acceptedCount: number;
    allQuestsCompleted: boolean;
    availableCount: number;
    completedCount: number;
    onOpen: () => void;
}

export function QuestWidget({
    activeQuest,
    acceptedCount,
    allQuestsCompleted,
    availableCount,
    completedCount,
    onOpen,
}: QuestWidgetProps) {
    return (
        <button type="button" className="quest-widget" onClick={onOpen}>
            <div className="quest-widget-shine" />

            {/* Scroll icon */}
            <div className="quest-widget-icon-wrap">
                <svg className="quest-widget-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                {availableCount > 0 && (
                    <span className="quest-widget-notif">{availableCount}</span>
                )}
            </div>

            {/* Info */}
            <div className="quest-widget-info">
                <div className="quest-widget-top">
                    <span className="quest-widget-title">Quests</span>
                    {allQuestsCompleted ? (
                        <span className="quest-widget-badge quest-widget-badge--done">✓ All done</span>
                    ) : acceptedCount > 0 && availableCount > 0 ? (
                        <span className="quest-widget-badge">{acceptedCount} active · {availableCount} available</span>
                    ) : acceptedCount > 0 ? (
                        <span className="quest-widget-badge">{acceptedCount} active</span>
                    ) : availableCount > 0 ? (
                        <span className="quest-widget-badge">{availableCount} available</span>
                    ) : null}
                </div>
                <div className="quest-widget-preview">
                    {activeQuest && acceptedCount > 0 ? (
                        <>
                            <span className="quest-widget-quest-emoji">{activeQuest.emoji}</span>
                            <span className="quest-widget-quest-name">{activeQuest.title}</span>
                            {acceptedCount > 1 && (
                                <span className="quest-widget-quest-more">+{acceptedCount - 1} more</span>
                            )}
                            {acceptedCount === 1 && (
                                <span className="quest-widget-quest-status"><span className="quest-widget-quest-dot" />In progress</span>
                            )}
                        </>
                    ) : allQuestsCompleted ? (
                        <span className="quest-widget-completed">🏆 {completedCount} quests conquered</span>
                    ) : (
                        <span className="quest-widget-browse">Browse available quests →</span>
                    )}
                </div>
            </div>

            {/* Chevron */}
            <svg className="quest-widget-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
    );
}
