/**
 * AchievementToastQueue — Shows a queue of achievement toasts, one at a time.
 * Used on the SummaryScreen to stagger-reveal newly unlocked achievements.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AchievementToast } from '../AchievementToast/AchievementToast';
import type { AchievementDef } from '@lib/achievements';

interface AchievementToastQueueProps {
    achievements: AchievementDef[];
}

export function AchievementToastQueue({ achievements }: AchievementToastQueueProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const startedRef = useRef(false);

    // Stagger start: wait 1s before showing first toast
    useEffect(() => {
        if (achievements.length === 0) return;
        const timer = setTimeout(() => { startedRef.current = true; setCurrentIndex(0); }, 1000);
        return () => clearTimeout(timer);
    }, [achievements.length]);

    const handleDone = useCallback(() => {
        setCurrentIndex(prev => prev + 1);
    }, []);

    if (!startedRef.current || achievements.length === 0) return null;
    if (currentIndex >= achievements.length) return null;

    return (
        <AchievementToast
            key={achievements[currentIndex].id}
            achievement={achievements[currentIndex]}
            onDone={handleDone}
        />
    );
}
