import { ACHIEVEMENTS_BY_CATEGORY, CATEGORY_META, TIER_COLORS } from '@lib/achievements';
import type { AchievementCategory, AchievementDef } from '@lib/achievements';
import { getAchievementProgress } from '@lib/achievementEngine';
import type { UserStats, AchievementMap } from '@lib/achievementEngine';
import './AchievementsGrid.scss';

interface AchievementsGridProps {
    stats: UserStats;
    achievements: AchievementMap;
    unlockedCount: number;
    totalAchievements: number;
}

export function AchievementsGrid({
    stats,
    achievements,
    unlockedCount,
    totalAchievements,
}: AchievementsGridProps) {
    return (
        <section className="progression-section">
            <div className="progression-section-header">
                <h3 className="progression-section-title">🏆 Achievements</h3>
                <span className="progression-section-count">{unlockedCount}/{totalAchievements}</span>
            </div>

            {(Object.entries(ACHIEVEMENTS_BY_CATEGORY) as [AchievementCategory, AchievementDef[]][]).map(
                ([category, defs]) => {
                    const meta = CATEGORY_META[category];
                    const categoryUnlocked = defs.filter(a => achievements[a.id]).length;
                    return (
                        <div key={category} className="achievement-category">
                            <div className="achievement-category-header">
                                <span className="achievement-category-emoji">{meta.emoji}</span>
                                <span className="achievement-category-label">{meta.label}</span>
                                <span className="achievement-category-count">{categoryUnlocked}/{defs.length}</span>
                            </div>
                            <div className="achievement-grid">
                                {defs.map(ach => {
                                    const prog = getAchievementProgress(ach, stats, achievements);
                                    return (
                                        <div
                                            key={ach.id}
                                            className={`achievement-badge ${prog.unlocked ? 'achievement-badge--unlocked' : 'achievement-badge--locked'}`}
                                        >
                                            <div
                                                className="achievement-badge-ring"
                                                style={{
                                                    borderColor: prog.unlocked ? TIER_COLORS[ach.tier] : undefined,
                                                }}
                                            >
                                                <span className="achievement-badge-tier">{tierEmoji(ach.tier)}</span>
                                            </div>
                                            <span className="achievement-badge-title">{ach.title}</span>
                                            {!prog.unlocked && (
                                                <div className="achievement-badge-progress">
                                                    <div className="achievement-badge-bar">
                                                        <div
                                                            className="achievement-badge-bar-fill"
                                                            style={{ width: `${prog.progressPct}%` }}
                                                        />
                                                    </div>
                                                    <span className="achievement-badge-progress-text">
                                                        {prog.current}/{ach.threshold}
                                                    </span>
                                                </div>
                                            )}
                                            {prog.unlocked && prog.unlockedAt && (
                                                <span className="achievement-badge-date">
                                                    {new Date(prog.unlockedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                },
            )}
        </section>
    );
}

function tierEmoji(tier: string): string {
    switch (tier) {
        case 'bronze': return '🥉';
        case 'silver': return '🥈';
        case 'gold': return '🥇';
        case 'platinum': return '💎';
        default: return '🏅';
    }
}
