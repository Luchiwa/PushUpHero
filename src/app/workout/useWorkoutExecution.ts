/**
 * useWorkoutExecution — Side-effect handlers for the workout machine.
 *
 * Receives the core (state + dispatch + plan + session) and the platform
 * orchestration props (camera, detector, exercise-type sync, sound) and
 * exposes the handlers that coordinate camera / detector / checkpoint /
 * sound around reducer dispatches, the level-up + rep-goal effects, and
 * the ref-synced config setters that keep handleStart safe from stale
 * closures.
 */
import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useRefSync } from '@hooks/shared/useRefSync';
import { useSoundEffect } from '@hooks/useSoundEffect';
import { createDefaultBlock, type ExerciseState, type ExerciseType, type SetRecord, type TimeDuration, type WorkoutBlock } from '@exercises/types';
import { warmUpSpeech } from '@infra/speechEngine';
import { resetCoach, speakSetComplete, speakLevelUp } from '@infra/coachEngine';
import {
    saveWorkoutCheckpoint,
    clearWorkoutCheckpoint,
    getWorkoutCheckpoint,
    deriveResumePosition,
} from '@services/workoutCheckpointStore';
import type { SessionMode } from './workoutTypes';
import type { UseWorkoutMachineCoreReturn } from './useWorkoutMachineCore';

interface UseWorkoutExecutionProps {
    core: UseWorkoutMachineCoreReturn;
    exerciseState: ExerciseState;
    resetDetector: () => void;
    startCamera: (mode?: 'user' | 'environment') => void;
    onExerciseTypeChange: (type: ExerciseType) => void;
}

export interface UseWorkoutExecutionReturn {
    setGoalReps: Dispatch<SetStateAction<number>>;
    setSessionMode: Dispatch<SetStateAction<SessionMode>>;
    setTimeGoal: Dispatch<SetStateAction<TimeDuration>>;
    handleStart: (exerciseTypeOverride?: ExerciseType) => void;
    handleWorkoutStart: () => void;
    handleStop: () => void;
    handleTimerEnd: () => void;
    handleRestComplete: () => void;
    handleExerciseRestComplete: () => void;
    handleSkipBlock: () => void;
    handleReset: () => void;
    handleLevelUpContinue: () => void;
    handleResumeWorkout: () => void;
    handleDiscardCheckpoint: () => void;
}

/** Wrap a setState so each write also lands in `ref` synchronously. */
function useRefSyncedSetter<T>(
    setState: Dispatch<SetStateAction<T>>,
    ref: MutableRefObject<T>,
): (v: SetStateAction<T>) => void {
    return useCallback((v: SetStateAction<T>) => {
        if (typeof v === 'function') {
            setState((prev) => {
                const next = (v as (prev: T) => T)(prev);
                ref.current = next;
                return next;
            });
        } else {
            ref.current = v;
            setState(v);
        }
    }, [setState, ref]);
}

export function useWorkoutExecution({
    core,
    exerciseState,
    resetDetector,
    startCamera,
    onExerciseTypeChange,
}: UseWorkoutExecutionProps): UseWorkoutExecutionReturn {
    const { state, dispatch, plan, session } = core;
    const { initAudio, playLevelUpSound } = useSoundEffect();
    const prevLevelRef = useRef(0);

    // ── Ref-synced config setters (handleStart reads the freshest value, even
    // when called in the same event handler that just changed config) ──
    const goalRepsRef = useRefSync(plan.goalReps);
    const sessionModeRef = useRefSync(plan.sessionMode);
    const timeGoalRef = useRefSync(plan.timeGoal);

    const setGoalReps = useRefSyncedSetter(plan.setGoalReps, goalRepsRef);
    const setSessionMode = useRefSyncedSetter(plan.setSessionMode, sessionModeRef);
    const setTimeGoal = useRefSyncedSetter(plan.setTimeGoal, timeGoalRef);

    // ── Handlers ───────────────────────────────────────────────

    const handleStart = useCallback((exerciseTypeOverride?: ExerciseType) => {
        if (state.isSaving) return;
        clearWorkoutCheckpoint();
        session.resetSessionState();
        plan.resetTimingRefs();
        warmUpSpeech();
        resetCoach();
        const resolvedExercise = exerciseTypeOverride ?? plan.workoutPlan.blocks[0]?.exerciseType ?? 'pushup';
        const block: WorkoutBlock = {
            ...createDefaultBlock(resolvedExercise),
            numberOfSets: 1,
            sessionMode: sessionModeRef.current,
            goalReps: goalRepsRef.current,
            timeGoal: timeGoalRef.current,
        };
        plan.setWorkoutPlan({ blocks: [block] });
        onExerciseTypeChange(block.exerciseType);
        startCamera();
        dispatch({ type: 'START_WORKOUT' });
    }, [state.isSaving, session, plan, dispatch, onExerciseTypeChange, startCamera, sessionModeRef, goalRepsRef, timeGoalRef]);

    const handleWorkoutStart = useCallback(() => {
        if (state.isSaving) return;
        clearWorkoutCheckpoint();
        session.resetSessionState();
        plan.resetTimingRefs();
        warmUpSpeech();
        resetCoach();
        const firstBlock = plan.workoutPlan.blocks[0];
        plan.syncConfigFromBlock(firstBlock);
        onExerciseTypeChange(firstBlock.exerciseType);
        startCamera();
        dispatch({ type: 'START_WORKOUT' });
    }, [state.isSaving, session, plan, dispatch, onExerciseTypeChange, startCamera]);

    const handleSetComplete = useCallback(() => {
        const setRecord = plan.buildCurrentSetRecord();
        const totalReps = state.completedSets.reduce((sum, s) => sum + s.reps, 0) + setRecord.reps;
        const isLastSetInBlock = state.currentSetIndex >= plan.totalSetsInBlock - 1;
        const isLastBlock = state.currentBlockIndex >= plan.totalBlocks - 1;
        const elapsedTime = Math.round((Date.now() - plan.workoutStartTimeRef.current) / 1000);

        const goalReached =
            (plan.currentBlock.sessionMode === 'reps' && exerciseState.repCount >= plan.currentBlock.goalReps)
            || plan.currentBlock.sessionMode === 'time';

        if (isLastSetInBlock && isLastBlock && totalReps > 0) {
            session.saveWorkoutSession([...state.completedSets, setRecord]);
            clearWorkoutCheckpoint();
        }

        if (!isLastSetInBlock || !isLastBlock) {
            resetDetector();
        }

        dispatch({
            type: 'SET_COMPLETE',
            setRecord,
            isLastSetInBlock,
            isLastBlock,
            goalReached,
            elapsedTime,
            totalReps,
        });

        // speakSetComplete only at workout end — for non-final sets, RestScreen's
        // speakRestStart owns the boundary cue (Chrome's speechSynthesis cancels
        // the in-flight utterance on the next speak(), so back-to-back calls
        // silence the first).
        if (plan.soundEnabled && isLastSetInBlock && isLastBlock) speakSetComplete();

        if (!(isLastSetInBlock && isLastBlock)) {
            saveWorkoutCheckpoint({
                version: 1,
                plan: plan.workoutPlan,
                completedSets: [...state.completedSets, setRecord],
                elapsedMs: elapsedTime * 1000,
                savedAt: Date.now(),
            });
        }
    }, [plan, state.completedSets, state.currentSetIndex, state.currentBlockIndex, exerciseState.repCount, session, resetDetector, dispatch]);

    const handleSetCompleteRef = useRefSync(handleSetComplete);

    const handleStop = useCallback(() => {
        const setRecord = plan.buildCurrentSetRecord();
        const allSets = [...state.completedSets, setRecord];
        const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
        const elapsedTime = Math.round((Date.now() - plan.workoutStartTimeRef.current) / 1000);

        if (totalReps > 0) {
            session.saveWorkoutSession(allSets);
        }
        clearWorkoutCheckpoint();

        dispatch({ type: 'MANUAL_STOP', setRecord, elapsedTime, totalReps });
    }, [plan, state.completedSets, session, dispatch]);

    const { workoutStartTimeRef, stampSetStartTime, syncConfigFromBlock } = plan;

    const handleTimerEnd = useCallback(() => {
        const elapsedTime = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
        dispatch({ type: 'TIMER_END', elapsedTime });
        handleSetCompleteRef.current();
    }, [workoutStartTimeRef, handleSetCompleteRef, dispatch]);

    const handleRestComplete = useCallback(() => {
        resetDetector();
        stampSetStartTime();
        startCamera();
        dispatch({ type: 'REST_COMPLETE' });
    }, [resetDetector, startCamera, stampSetStartTime, dispatch]);

    const handleExerciseRestComplete = useCallback(() => {
        resetDetector();
        const nextBlockIndex = state.currentBlockIndex + 1;
        const nextBlock = plan.workoutPlan.blocks[nextBlockIndex];
        stampSetStartTime();
        syncConfigFromBlock(nextBlock);
        onExerciseTypeChange(nextBlock.exerciseType);
        startCamera();
        dispatch({ type: 'EXERCISE_REST_COMPLETE', nextBlockIndex });
    }, [resetDetector, state.currentBlockIndex, plan.workoutPlan.blocks, stampSetStartTime, syncConfigFromBlock, onExerciseTypeChange, startCamera, dispatch]);

    const handleSkipBlock = useCallback(() => {
        const remainingSets = plan.totalSetsInBlock - state.currentSetIndex;
        const skippedSets: SetRecord[] = Array.from({ length: remainingSets }, () => ({
            reps: 0,
            averageScore: 0,
            repHistory: [],
            duration: 0,
            setMode: plan.currentBlock.sessionMode,
            exerciseType: plan.currentBlock.exerciseType,
        }));
        const allSets = [...state.completedSets, ...skippedSets];
        const isLastBlock = state.currentBlockIndex >= plan.totalBlocks - 1;
        const elapsedTime = Math.round((Date.now() - workoutStartTimeRef.current) / 1000);
        const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);

        if (isLastBlock && totalReps > 0) {
            session.saveWorkoutSession(allSets);
            clearWorkoutCheckpoint();
        }

        if (!isLastBlock) {
            resetDetector();
        }

        dispatch({ type: 'SKIP_BLOCK', skippedSets, isLastBlock, elapsedTime, totalReps });

        if (!isLastBlock) {
            saveWorkoutCheckpoint({
                version: 1,
                plan: plan.workoutPlan,
                completedSets: allSets,
                elapsedMs: elapsedTime * 1000,
                savedAt: Date.now(),
            });
        }
    }, [plan, workoutStartTimeRef, state.completedSets, state.currentSetIndex, state.currentBlockIndex, session, resetDetector, dispatch]);

    const handleReset = useCallback(() => {
        const effectiveLevel = session.savedLevel ?? session.liveLevel;
        if (effectiveLevel > session.levelBefore) {
            dispatch({ type: 'SHOW_LEVEL_UP' });
            return;
        }
        resetDetector();
        dispatch({ type: 'RESET_TO_IDLE' });
    }, [session.savedLevel, session.liveLevel, session.levelBefore, resetDetector, dispatch]);

    const handleLevelUpContinue = useCallback(() => {
        resetDetector();
        dispatch({ type: 'RESET_TO_IDLE' });
    }, [resetDetector, dispatch]);

    const handleResumeWorkout = useCallback(() => {
        if (state.isSaving) return;
        const checkpoint = getWorkoutCheckpoint();
        if (!checkpoint) return;

        const { blockIndex, setIndex } = deriveResumePosition(
            checkpoint.plan,
            checkpoint.completedSets.length,
        );

        session.resetSessionState();
        plan.setWorkoutPlan(checkpoint.plan);

        const resumeBlock = checkpoint.plan.blocks[blockIndex];
        syncConfigFromBlock(resumeBlock);
        onExerciseTypeChange(resumeBlock.exerciseType);

        workoutStartTimeRef.current = Date.now() - checkpoint.elapsedMs;
        stampSetStartTime();

        warmUpSpeech();
        resetCoach();
        startCamera();

        const elapsedTimeSec = Math.round(checkpoint.elapsedMs / 1000);
        dispatch({
            type: 'RESUME_WORKOUT',
            completedSets: checkpoint.completedSets,
            blockIndex,
            setIndex,
            elapsedTime: elapsedTimeSec,
        });
    }, [state.isSaving, session, plan, syncConfigFromBlock, onExerciseTypeChange, workoutStartTimeRef, stampSetStartTime, startCamera, dispatch]);

    const handleDiscardCheckpoint = useCallback(() => {
        const checkpoint = getWorkoutCheckpoint();
        if (!checkpoint) return;

        const totalReps = checkpoint.completedSets.reduce((sum, s) => sum + s.reps, 0);

        if (totalReps > 0) {
            session.resetSessionState();
            plan.setWorkoutPlan(checkpoint.plan);
            workoutStartTimeRef.current = Date.now() - checkpoint.elapsedMs;
            session.saveWorkoutSession(checkpoint.completedSets);

            const elapsedTimeSec = Math.round(checkpoint.elapsedMs / 1000);
            dispatch({
                type: 'DISCARD_CHECKPOINT',
                completedSets: checkpoint.completedSets,
                elapsedTime: elapsedTimeSec,
            });
        }

        clearWorkoutCheckpoint();
    }, [session, plan, workoutStartTimeRef, dispatch]);

    // ── Effects ─────────────────────────────────────────────────

    useEffect(() => {
        if (state.screen === 'active' && session.liveLevel > prevLevelRef.current) {
            initAudio();
            if (plan.soundEnabled) {
                playLevelUpSound();
                speakLevelUp();
            }
        }
        prevLevelRef.current = session.liveLevel;
    }, [session.liveLevel, state.screen, plan.soundEnabled, playLevelUpSound, initAudio]);

    useEffect(() => {
        if (
            state.screen === 'active'
            && plan.currentBlock.sessionMode === 'reps'
            && exerciseState.repCount >= plan.currentBlock.goalReps
        ) {
            handleSetCompleteRef.current();
        }
    }, [exerciseState.repCount, state.screen, plan.currentBlock.sessionMode, plan.currentBlock.goalReps, handleSetCompleteRef]);

    return {
        setGoalReps,
        setSessionMode,
        setTimeGoal,
        handleStart,
        handleWorkoutStart,
        handleStop,
        handleTimerEnd,
        handleRestComplete,
        handleExerciseRestComplete,
        handleSkipBlock,
        handleReset,
        handleLevelUpContinue,
        handleResumeWorkout,
        handleDiscardCheckpoint,
    };
}
