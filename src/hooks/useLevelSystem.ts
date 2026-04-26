/**
 * useLevelSystem.ts
 *
 * Manages the XP-based level system: global level + per-exercise levels.
 * Pure state holder — Firestore sync is handled by useSyncCloud.
 *
 * @see src/lib/xpSystem.ts        for pure XP calculation functions
 * @see src/lib/LEVEL_DESIGN.md    for the full design document
 */
import { useState, useCallback } from 'react';
import { useAuthCore } from './useAuth';
import { levelFromTotalXp, totalXpForLevel } from '@domain/xpSystem';
import { read, write, STORAGE_KEYS } from '@infra/storage';
import type { ExerciseType, ExerciseXpMap } from '@exercises/types';
import type { XpAmount } from '@domain/brands';
import { createXpAmount, createLevel } from '@domain/brands';

export function useLevelSystem() {
    const { user } = useAuthCore();

    // ── Global XP ────────────────────────────────────────────────────────────
    const [totalXp, setTotalXpState] = useState<XpAmount>(
        () => createXpAmount(read(STORAGE_KEYS.totalXp, 0)),
    );

    // ── Per-exercise XP ──────────────────────────────────────────────────────
    const [exerciseXp, setExerciseXpState] = useState<ExerciseXpMap>(
        () => read<ExerciseXpMap>(STORAGE_KEYS.exerciseXp, {}),
    );

    // Setters for useSyncCloud to wire into
    const setTotalXp = useCallback((xp: XpAmount) => {
        setTotalXpState(xp);
    }, []);

    const setExerciseXp = useCallback((map: ExerciseXpMap) => {
        setExerciseXpState(map);
    }, []);

    // ── Guest mode: add XP locally ──────────────────────────────────────────
    const addGuestXp = useCallback((globalXp: number, perExercise: { exerciseType: ExerciseType; xp: number }[]) => {
        if (user) return;

        setTotalXpState(prev => {
            const next = createXpAmount(prev + globalXp);
            write(STORAGE_KEYS.totalXp, next);
            return next;
        });

        setExerciseXpState(prev => {
            const next = { ...prev };
            for (const { exerciseType, xp } of perExercise) {
                next[exerciseType] = (next[exerciseType] ?? 0) + xp;
            }
            write(STORAGE_KEYS.exerciseXp, next);
            return next;
        });
    }, [user]);

    // ── Derived global level values ──────────────────────────────────────────
    // Always derive level from totalXp — it's the source of truth.
    // (dbUser.stats.level is denormalised / may be stale from the old rep-based system)
    const level = levelFromTotalXp(totalXp);
    const currentLevelBaseXp = totalXpForLevel(level);
    const nextLevelTotalReq = totalXpForLevel(createLevel(level + 1));
    const xpIntoCurrentLevel = totalXp - currentLevelBaseXp;
    const xpNeededForNextLevel = nextLevelTotalReq - currentLevelBaseXp;
    const levelProgressPct = xpNeededForNextLevel > 0
        ? (xpIntoCurrentLevel / xpNeededForNextLevel) * 100
        : 0;

    // ── Per-exercise derived levels ──────────────────────────────────────────
    const getExerciseLevel = useCallback((type: ExerciseType) => {
        const xp = createXpAmount(exerciseXp[type] ?? 0);
        return levelFromTotalXp(xp);
    }, [exerciseXp]);

    const getExerciseXp = useCallback((type: ExerciseType) => {
        return exerciseXp[type] ?? 0;
    }, [exerciseXp]);

    const getExerciseLevelProgress = useCallback((type: ExerciseType) => {
        const xp = createXpAmount(exerciseXp[type] ?? 0);
        const lvl = levelFromTotalXp(xp);
        const base = totalXpForLevel(lvl);
        const next = totalXpForLevel(createLevel(lvl + 1));
        const needed = next - base;
        return {
            level: lvl,
            xp,
            xpIntoLevel: xp - base,
            xpNeeded: needed,
            progressPct: needed > 0 ? ((xp - base) / needed) * 100 : 0,
        };
    }, [exerciseXp]);

    return {
        // Global XP
        totalXp,
        setTotalXp,
        level,
        xpIntoCurrentLevel,
        xpNeededForNextLevel,
        levelProgressPct,

        // Per-exercise XP
        exerciseXp,
        setExerciseXp,
        getExerciseLevel,
        getExerciseXp,
        getExerciseLevelProgress,

        // Guest mode
        addGuestXp,
    };
}
