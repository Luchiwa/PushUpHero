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
import { levelFromTotalXp, totalXpForLevel } from '@lib/xpSystem';
import type { ExerciseType, ExerciseXpMap } from '@exercises/types';

// ─── Re-export pure functions & types so existing imports keep working ───────
export { levelFromTotalXp, totalXpForLevel } from '@lib/xpSystem';
export type { ExerciseXpMap } from '@exercises/types';

// ─── LocalStorage keys (XP-based) ───────────────────────────────────────────
const STORAGE_TOTAL_XP = 'pushup_hero_total_xp';
const STORAGE_EXERCISE_XP = 'pushup_hero_exercise_xp';

export function useLevelSystem() {
    const { user } = useAuthCore();

    // ── Global XP ────────────────────────────────────────────────────────────
    const [totalXp, setTotalXpState] = useState<number>(() => {
        const stored = localStorage.getItem(STORAGE_TOTAL_XP);
        return stored ? parseInt(stored, 10) : 0;
    });

    // ── Per-exercise XP ──────────────────────────────────────────────────────
    const [exerciseXp, setExerciseXpState] = useState<ExerciseXpMap>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_EXERCISE_XP);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    });

    // Setters for useSyncCloud to wire into
    const setTotalXp = useCallback((xp: number) => {
        setTotalXpState(xp);
    }, []);

    const setExerciseXp = useCallback((map: ExerciseXpMap) => {
        setExerciseXpState(map);
    }, []);

    // ── Guest mode: add XP locally ──────────────────────────────────────────
    const addGuestXp = useCallback((globalXp: number, perExercise: { exerciseType: ExerciseType; xp: number }[]) => {
        if (user) return;

        setTotalXpState(prev => {
            const next = prev + globalXp;
            localStorage.setItem(STORAGE_TOTAL_XP, next.toString());
            return next;
        });

        setExerciseXpState(prev => {
            const next = { ...prev };
            for (const { exerciseType, xp } of perExercise) {
                next[exerciseType] = (next[exerciseType] ?? 0) + xp;
            }
            localStorage.setItem(STORAGE_EXERCISE_XP, JSON.stringify(next));
            return next;
        });
    }, [user]);

    // ── Derived global level values ──────────────────────────────────────────
    // Always derive level from totalXp — it's the source of truth.
    // (dbUser.level is denormalised / may be stale from the old rep-based system)
    const level = levelFromTotalXp(totalXp);
    const currentLevelBaseXp = totalXpForLevel(level);
    const nextLevelTotalReq = totalXpForLevel(level + 1);
    const xpIntoCurrentLevel = totalXp - currentLevelBaseXp;
    const xpNeededForNextLevel = nextLevelTotalReq - currentLevelBaseXp;
    const levelProgressPct = xpNeededForNextLevel > 0
        ? (xpIntoCurrentLevel / xpNeededForNextLevel) * 100
        : 0;

    // ── Per-exercise derived levels ──────────────────────────────────────────
    const getExerciseLevel = useCallback((type: ExerciseType) => {
        const xp = exerciseXp[type] ?? 0;
        return levelFromTotalXp(xp);
    }, [exerciseXp]);

    const getExerciseXp = useCallback((type: ExerciseType) => {
        return exerciseXp[type] ?? 0;
    }, [exerciseXp]);

    const getExerciseLevelProgress = useCallback((type: ExerciseType) => {
        const xp = exerciseXp[type] ?? 0;
        const lvl = levelFromTotalXp(xp);
        const base = totalXpForLevel(lvl);
        const next = totalXpForLevel(lvl + 1);
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
