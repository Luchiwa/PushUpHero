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
import { projectLiveXp } from '@domain/xpSystem';
import type { SessionXpResult } from '@domain/xpSystem';
import type { SaveSessionResult } from '@services/sessionService';
import type { QuestDef, QuestProgress } from '@domain/quests';
import { isSingleSessionQuest, getSessionQuestContribution } from '@domain/quests';
import type { BodyProfile } from '@domain/bodyProfile';
import type { WorkoutAction } from './workoutReducer';
import { durationToSeconds } from './workoutTypes';
import { computeFinalXp, derivePrimaryExercise } from './xpProjection';
import { maybeCaptureBodyProfile } from './bodyProfileCapture';

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
  questProgress: QuestProgress;
  bodyProfile: BodyProfile;
  onSaveBodyProfile: (profile: BodyProfile) => void;
  onCompleteQuests: (questIds: string[]) => void;
  onAddProgress: (questId: string, contribution: number) => number;
  getCapturedRatios: () => CapturedRatios;
  dispatch: Dispatch<WorkoutAction>;
}

// ── Return type ──────────────────────────────────────────────────

export interface UseWorkoutSessionReturn {
  lastSessionXp: (SessionXpResult & Partial<SaveSessionResult>) | null;
  questCompletedThisSession: QuestDef[];
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
  questProgress,
  bodyProfile,
  onSaveBodyProfile,
  onCompleteQuests,
  onAddProgress,
  getCapturedRatios,
  dispatch,
}: UseWorkoutSessionProps): UseWorkoutSessionReturn {
  const { addSession } = useSessionHistory();
  const { dbUser } = useAuthCore();
  const { totalXp } = useLevel();
  const { friends } = useFriends();

  // ── Result state ─────────────────────────────────────────────
  const [lastSessionXp, setLastSessionXp] = useState<(SessionXpResult & Partial<SaveSessionResult>) | null>(null);
  const [questCompletedThisSession, setQuestCompletedThisSession] = useState<QuestDef[]>([]);
  const [savedLevel, setSavedLevel] = useState<number | null>(null);
  const sessionSavedRef = useRef(false);
  const levelBeforeRef = useRef(0);
  const [levelBefore, setLevelBefore] = useState(0);

  // ── Live XP projection (pure domain function) ──
  const { liveLevel, liveProgressPct } = projectLiveXp(
    totalXp, completedSets, currentSetReps, activeExerciseType,
  );

  // ── Save ─────────────────────────────────────────────────────
  const saveWorkoutSession = useCallback((allSets: SetRecord[]) => {
    if (sessionSavedRef.current) return;
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    if (totalReps === 0) return;

    sessionSavedRef.current = true;
    dispatch({ type: 'SAVE_STARTED' });

    const totalWorkoutDuration = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
    const { bonusCtx, avgScore, computedLevel } = computeFinalXp({
      allSets,
      totalReps,
      totalWorkoutDuration,
      streak: dbUser?.streak ?? 0,
      isMultiExercise,
      totalXp,
    });
    setSavedLevel(computedLevel);

    const { primaryExercise, repsByType, hasMultipleExercises } = derivePrimaryExercise(allSets);

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

      // ── Quest progress — accumulate qualifying reps across sessions ──
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
        const contribution = getSessionQuestContribution(quest, sessionData);
        if (contribution <= 0) continue;

        if (isSingleSessionQuest(quest)) {
          // Single-session: contribution > 0 means all conditions met
          completedQuests.push(quest);
        } else {
          // Cross-session: accumulate progress, check if goal reached
          const currentProgress = (questProgress.progress[quest.id] ?? 0);
          const newTotal = currentProgress + contribution;
          onAddProgress(quest.id, contribution);
          if (newTotal >= quest.goal.reps) {
            completedQuests.push(quest);
          }
        }
      }

      if (completedQuests.length > 0) {
        onCompleteQuests(completedQuests.map(q => q.id));
        setQuestCompletedThisSession(completedQuests);
      }

      const updatedProfile = maybeCaptureBodyProfile({
        completedQuests,
        primaryExercise,
        bodyProfile,
        getCapturedRatios,
      });
      if (updatedProfile) onSaveBodyProfile(updatedProfile);
    }).catch(err => {
      console.error('Failed to save session:', err);
      sessionSavedRef.current = false;
      dispatch({ type: 'SAVE_FAILED' });
    });
  }, [addSession, currentBlock, isMultiExercise, workoutPlan.blocks, totalXp, dbUser, friends.length, availableQuests, questProgress, bodyProfile, onSaveBodyProfile, onCompleteQuests, onAddProgress, getCapturedRatios, workoutStartTimeRef, dispatch]);

  // ── Reset ────────────────────────────────────────────────────
  const resetSessionState = useCallback(() => {
    sessionSavedRef.current = false;
    setSavedLevel(null);
    levelBeforeRef.current = liveLevel;
    setLevelBefore(liveLevel);
    setQuestCompletedThisSession([]);
  }, [liveLevel]);

  return {
    lastSessionXp,
    questCompletedThisSession,
    savedLevel,
    levelBefore,
    saveWorkoutSession,
    resetSessionState,
    liveLevel,
    liveProgressPct,
  };
}
