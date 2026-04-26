/**
 * AchievementToastQueue — Shows a queue of achievement toasts, one at a time.
 * Used on the SummaryScreen to stagger-reveal newly unlocked achievements.
 */
import { useState, useEffect, useCallback } from 'react';
import { AchievementToast } from '../AchievementToast/AchievementToast';
import type { AchievementDef } from '@domain';

interface AchievementToastQueueProps {
    achievements: AchievementDef[];
}

export function AchievementToastQueue({ achievements }: AchievementToastQueueProps) {
    const [currentIndex, setCurrentIndex] = useState(-1); // -1 = waiting for stagger delay

    // Stagger start: wait 1.5s before showing first toast
    useEffect(() => {
        if (achievements.length === 0) return;
        const timer = setTimeout(() => setCurrentIndex(0), 1500);
        return () => clearTimeout(timer);
    }, [achievements]);

    const handleDone = useCallback(() => {
        setCurrentIndex(prev => prev + 1);
    }, []);

    if (currentIndex < 0 || achievements.length === 0) return null;
    if (currentIndex >= achievements.length) return null;

    return (
        <AchievementToast
            key={achievements[currentIndex].id}
            achievement={achievements[currentIndex]}
            onDone={handleDone}
        />
    );
}
