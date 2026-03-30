/**
 * useWorkoutSession — Owns the async session save lifecycle, live XP projection,
 * quest completion, and body profile capture.
 *
 * Dispatches SAVE_STARTED / SAVE_COMPLETED / SAVE_FAILED to the workout reducer
 * so the orchestrator can guard against starting a new workout during a save.
 */
import { useState, useRef, useCallback } from 'react';
import type { Dispatch } from 'react';
import type { ExerciseType, SetRecord, WorkoutBlock, WorkoutPlan } from '@exercises/types';
import type { CapturedRatios } from '@exercises/BaseExerciseDetector';
import { useSessionHistory } from '@hooks/useSessionHistory';
import { useAuthCore, useLevel } from '@hooks/useAuth';
import { useFriends } from '@hooks/useFriends';
import { levelFromTotalXp, totalXpForLevel, calculateSessionXp, xpForRep, EXERCISE_DIFFICULTY } from '@lib/xpSystem';
import type { BonusContext, SessionXpResult } from '@lib/xpSystem';
import type { SaveSessionResult } from '@lib/userService';
import type { QuestDef } from '@lib/quests';
import { isBodyProfileQuest, isQuestGoalMet } from '@lib/quests';
import type { BodyProfile } from '@lib/bodyProfile';
import { BODY_PROFILE_VERSION, BODY_PROFILE_MERGE } from '@lib/bodyProfile';
import type { WorkoutAction } from './workoutReducer';
import { durationToSeconds } from './workoutTypes';

// ── Props ────────────────────────────────────────────────────────

interface UseWorkoutSessionProps {
  workoutPlan: WorkoutPlan;
  currentBlock: WorkoutBlock;
  isMultiExercise: boolean;
  completedSets: SetRecord[];
  activeExerciseType: ExerciseType;
  currentSetReps: number;
  workoutStartTimeRef: React.MutableRefObject<number>;
  availableQuests: QuestDef[];
  bodyProfile: BodyProfile;
  onSaveBodyProfile: (profile: BodyProfile) => void;
  onCompleteQuests: (questIds: string[]) => void;
  getCapturedRatios: () => CapturedRatios;
  dispatch: Dispatch<WorkoutAction>;
}

// ── Return type ──────────────────────────────────────────────────

export interface UseWorkoutSessionReturn {
  lastSessionXp: (SessionXpResult & Partial<SaveSessionResult>) | null;
  questCompletedThisSession: QuestDef | null;
  savedLevel: number | null;
  levelBefore: number;
  saveWorkoutSession: (allSets: SetRecord[]) => void;
  resetSessionState: () => void;

  // Live XP projection
  liveLevel: number;
  liveProgressPct: number;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useWorkoutSession({
  workoutPlan,
  currentBlock,
  isMultiExercise,
  completedSets,
  activeExerciseType,
  currentSetReps,
  workoutStartTimeRef,
  availableQuests,
  bodyProfile,
  onSaveBodyProfile,
  onCompleteQuests,
  getCapturedRatios,
  dispatch,
}: UseWorkoutSessionProps): UseWorkoutSessionReturn {
  const { addSession } = useSessionHistory();
  const { dbUser } = useAuthCore();
  const { totalXp } = useLevel();
  const { friends } = useFriends();

  // ── Result state ─────────────────────────────────────────────
  const [lastSessionXp, setLastSessionXp] = useState<(SessionXpResult & Partial<SaveSessionResult>) | null>(null);
  const [questCompletedThisSession, setQuestCompletedThisSession] = useState<QuestDef | null>(null);
  const savedLevelRef = useRef<number | null>(null);
  const sessionSavedRef = useRef(false);
  const levelBeforeRef = useRef(0);
  const [levelBefore, setLevelBefore] = useState(0);

  // ── Live XP projection (fix: use real XP data for completed sets) ──
  const completedXp = completedSets.reduce((sum, set) => {
    const exType = set.exerciseType ?? 'pushup';
    const diff = EXERCISE_DIFFICULTY[exType] ?? 1.0;
    if (set.repHistory.length > 0) {
      return sum + set.repHistory.reduce((s, r) => s + xpForRep(r.score), 0) * diff;
    }
    return sum + set.reps * xpForRep(set.averageScore) * diff;
  }, 0);

  // Current in-progress set: estimate with C-grade (10 XP) * exercise difficulty
  const currentExDifficulty = EXERCISE_DIFFICULTY[activeExerciseType] ?? 1.0;
  const currentSetEstimate = currentSetReps * 10 * currentExDifficulty;

  const liveXpEstimate = totalXp + Math.round(completedXp + currentSetEstimate);
  const liveLevel = levelFromTotalXp(liveXpEstimate);
  const liveLevelBase = totalXpForLevel(liveLevel);
  const liveLevelNext = totalXpForLevel(liveLevel + 1);
  const liveProgressPct = liveLevelNext > liveLevelBase
    ? ((liveXpEstimate - liveLevelBase) / (liveLevelNext - liveLevelBase)) * 100
    : 0;

  // ── Save ─────────────────────────────────────────────────────
  const saveWorkoutSession = useCallback((allSets: SetRecord[]) => {
    if (sessionSavedRef.current) return;
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    if (totalReps === 0) return;

    sessionSavedRef.current = true;
    dispatch({ type: 'SAVE_STARTED' });

    // Compute XP for level-up detection
    const streak = dbUser?.streak ?? 0;
    const totalWorkoutDuration = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    const weightedScoreSum = allSets.reduce((sum, s) => sum + s.averageScore * s.reps, 0);
    const avgScore = totalReps > 0 ? Math.round(weightedScoreSum / totalReps) : 0;

    const allGoalsMet = allSets.every(s => {
      if (s.setMode === 'time') return true;
      return s.goalReps !== undefined ? s.reps >= s.goalReps : true;
    });

    const bonusCtx: BonusContext = {
      streak,
      elapsedTime: totalWorkoutDuration,
      averageScore: avgScore,
      allGoalsMet,
      isMultiExercise,
    };

    // Pre-calculate XP for level-up check
    const xpResult = calculateSessionXp(allSets, bonusCtx);
    const newTotalXp = totalXp + xpResult.totalXp;
    savedLevelRef.current = levelFromTotalXp(newTotalXp);

    // Determine the primary exercise type
    const repsByType: Record<string, number> = {};
    for (const s of allSets) {
      const t = s.exerciseType ?? 'pushup';
      repsByType[t] = (repsByType[t] ?? 0) + s.reps;
    }
    const primaryExercise = (Object.entries(repsByType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'pushup') as ExerciseType;
    const hasMultipleExercises = Object.keys(repsByType).length > 1;

    const restSeconds = isMultiExercise
      ? undefined
      : durationToSeconds(currentBlock.restBetweenSets);

    addSession({
      reps: totalReps,
      averageScore: avgScore,
      goalReps: allSets.reduce((sum, s) => sum + (s.goalReps ?? 0), 0),
      sessionMode: currentBlock.sessionMode,
      exerciseType: primaryExercise,
      elapsedTime: totalWorkoutDuration,
      numberOfSets: allSets.length > 1 ? allSets.length : undefined,
      restDuration: allSets.length > 1 ? restSeconds : undefined,
      sets: allSets.length > 1 ? allSets : undefined,
      totalDuration: allSets.length > 1 ? totalWorkoutDuration : undefined,
      blocks: hasMultipleExercises ? workoutPlan.blocks : undefined,
      isMultiExercise: hasMultipleExercises || undefined,
    }, bonusCtx, friends.length).then(result => {
      setLastSessionXp(result);
      dispatch({ type: 'SAVE_COMPLETED' });

      // ── Quest completion — evaluate ALL available quests ──
      const sessionData = {
        totalReps,
        avgScore,
        exerciseType: primaryExercise,
        isMultiSet: allSets.length > 1,
        isMultiExercise: hasMultipleExercises,
        repsByExercise: repsByType as Partial<Record<ExerciseType, number>>,
      };

      const completedQuests: QuestDef[] = [];
      for (const quest of availableQuests) {
        if (isQuestGoalMet(quest, sessionData)) {
          completedQuests.push(quest);
        }
      }

      if (completedQuests.length > 0) {
        onCompleteQuests(completedQuests.map(q => q.id));
        setQuestCompletedThisSession(completedQuests[0]);
      }

      // ── Body profile capture (data-driven via BODY_PROFILE_MERGE) ──
      const profileQuest = completedQuests.find(q => isBodyProfileQuest(q));
      if (profileQuest) {
        const captured = getCapturedRatios();
        const mergeForExercise = BODY_PROFILE_MERGE[primaryExercise];
        if (mergeForExercise) {
          const patch = mergeForExercise(captured, captured.dynamicCalibration);
          if (Object.keys(patch).length > 0) {
            onSaveBodyProfile({
              ...bodyProfile,
              ...patch,
              capturedAt: Date.now(),
              version: BODY_PROFILE_VERSION,
            });
          }
        }
      }
    }).catch(err => {
      console.error('Failed to save session:', err);
      sessionSavedRef.current = false;
      dispatch({ type: 'SAVE_FAILED' });
    });
  }, [addSession, currentBlock, isMultiExercise, workoutPlan.blocks, totalXp, dbUser, friends.length, availableQuests, bodyProfile, onSaveBodyProfile, onCompleteQuests, getCapturedRatios, workoutStartTimeRef, dispatch]);

  // ── Reset ────────────────────────────────────────────────────
  const resetSessionState = useCallback(() => {
    sessionSavedRef.current = false;
    savedLevelRef.current = null;
    levelBeforeRef.current = liveLevel;
    setLevelBefore(liveLevel);
    setQuestCompletedThisSession(null);
  }, [liveLevel]);

  return {
    lastSessionXp,
    questCompletedThisSession,
    savedLevel: savedLevelRef.current,
    levelBefore,
    saveWorkoutSession,
    resetSessionState,
    liveLevel,
    liveProgressPct,
  };
}
