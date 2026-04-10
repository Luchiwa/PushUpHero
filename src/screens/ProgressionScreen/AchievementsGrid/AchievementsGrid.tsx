import type { CSSProperties } from 'react';
import { ACHIEVEMENTS_BY_CATEGORY, CATEGORY_META, TIER_COLORS } from '@domain/achievements';
import type { AchievementCategory, AchievementDef } from '@domain/achievements';
import { getAchievementProgress } from '@domain/achievementEngine';
import type { UserStats, AchievementMap } from '@domain/achievementEngine';
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
                        <div
                            key={category}
                            className="achievement-category"
                            style={{ '--category-color': meta.color } as CSSProperties}
                        >
                            <div className="achievement-category-header">
                                <span className="achievement-category-emoji">{meta.emoji}</span>
                                <span className="achievement-category-label">{meta.label}</span>
                                <span className="achievement-category-count">{categoryUnlocked}/{defs.length}</span>
                            </div>
                            <div className="achievement-grid">
                                {defs.map((ach, i) => {
                                    const prog = getAchievementProgress(ach, stats, achievements);
                                    return (
                                        <div
                                            key={ach.id}
                                            className={`achievement-badge ${prog.unlocked ? 'achievement-badge--unlocked' : 'achievement-badge--locked'}`}
                                            style={{
                                                '--tier-color': TIER_COLORS[ach.tier],
                                                '--i': i,
                                            } as CSSProperties}
                                        >
                                            <div className="achievement-badge-ring">
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
