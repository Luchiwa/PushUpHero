/**
 * useSoundEffect — Thin React hook wrapper around the soundEngine module.
 * Provides stable callback references for components.
 */
import { useCallback } from 'react';
import * as engine from '@lib/soundEngine';

export function useSoundEffect() {
    const initAudio = useCallback(() => engine.initAudio(), []);
    const playRepSound = useCallback(() => engine.playRepSound(), []);
    const playLevelUpSound = useCallback(() => engine.playLevelUpSound(), []);
    const playVictorySound = useCallback(() => engine.playVictorySound(), []);
    const playStartReadySound = useCallback(() => engine.playStartReadySound(), []);
    const playAchievementSound = useCallback(() => engine.playAchievementSound(), []);

    return { initAudio, playRepSound, playLevelUpSound, playVictorySound, playStartReadySound, playAchievementSound };
}