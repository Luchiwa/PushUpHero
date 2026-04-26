/**
 * AchievementToast — Animated toast that slides in from top when an achievement unlocks.
 * Used on the camera overlay during active workout.
 */
import { useEffect, useState } from 'react';
import { TIER_COLORS, type AchievementDef } from '@domain';
import './AchievementToast.scss';

interface AchievementToastProps {
    achievement: AchievementDef;
    onDone: () => void;
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

export function AchievementToast({ achievement, onDone }: AchievementToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Slide in
        const showTimer = setTimeout(() => setVisible(true), 50);
        // Auto-dismiss after 3s
        const hideTimer = setTimeout(() => setVisible(false), 3000);
        // Remove from DOM after exit animation
        const removeTimer = setTimeout(onDone, 3500);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
            clearTimeout(removeTimer);
        };
    }, [onDone]);

    return (
        <div className={`achievement-toast ${visible ? 'achievement-toast--visible' : ''}`} aria-live="assertive" role="alert">
            <div
                className="achievement-toast-ring"
                style={{ borderColor: TIER_COLORS[achievement.tier] }}
            >
                <span className="achievement-toast-tier">{tierEmoji(achievement.tier)}</span>
            </div>
            <div className="achievement-toast-content">
                <span className="achievement-toast-label">🏆 Achievement Unlocked!</span>
                <span className="achievement-toast-title">{achievement.title}</span>
            </div>
        </div>
    );
}
