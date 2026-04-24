import { memo, useEffect, useRef, useState } from 'react';
import './Dashboard.scss';
import { getExerciseLabel, getInvalidPositionMessage } from '@exercises/types';
import { useWorkout } from '@app/WorkoutContext';
import { useExerciseState } from '@app/ExerciseStateContext';
import { useBackButton } from '@hooks/shared/useBackButton';
import { useDashboardLogic } from './useDashboardLogic';
import { nextCombo, computeGoalProgress } from '@domain/scoring';

import { FloatyNumbers } from '@components/FloatyNumbers/FloatyNumbers';
import { GradePop } from './GradePop/GradePop';
import { ComboMeter } from './ComboMeter/ComboMeter';
import { ScoreRing } from './ScoreRing/ScoreRing';
import { CoachHint } from './CoachHint/CoachHint';

interface DashboardProps {
    facingMode: 'user' | 'environment';
    onFlipCamera: () => void;
}

export const Dashboard = memo(function Dashboard({ facingMode, onFlipCamera }: DashboardProps) {
    const {
        exerciseType, goalReps, sessionMode, timeGoal,
        handleStop, handleTimerEnd, elapsedTimeRef, soundEnabled, setSoundEnabled,
        flatSetIndex, totalSetsAllBlocks, isMultiExercise, currentBlockIndex, totalBlocks,
    } = useWorkout();

    const { repCount, averageScore, lastRepResult, isValidPosition, isCalibrated, incompleteRepFeedback, poseRejectedByLock } = useExerciseState();

    // Android / system back button → behaves like the stop button.
    useBackButton(true, handleStop);

    // Derived display values
    const currentSet = flatSetIndex + 1;
    const totalSets = totalSetsAllBlocks;
    const currentBlock = isMultiExercise ? currentBlockIndex + 1 : undefined;
    const displayTotalBlocks = isMultiExercise ? totalBlocks : undefined;

    const { showInvalidBanner, timeRemaining, coachPhrase } = useDashboardLogic({
        exerciseType,
        repCount,
        isCalibrated,
        isValidPosition,
        soundEnabled,
        sessionMode,
        timeGoal,
        elapsedTimeRef,
        onTimerEnd: handleTimerEnd,
        lastRepResult,
        incompleteRepFeedback,
    });

    // Combo: count consecutive reps with score >= COMBO_THRESHOLD (B or above)
    const comboRef = useRef(0);
    const [combo, setCombo] = useState(0);

    useEffect(() => {
        if (lastRepResult) {
            comboRef.current = nextCombo(comboRef.current, lastRepResult.score);
            setCombo(comboRef.current);
        }
    }, [lastRepResult]);

    // Goal progress for reps mode
    const goal = computeGoalProgress(repCount, goalReps);
    const goalPct = sessionMode === 'reps' ? goal.pct : 0;
    const goalDone = goal.done;

    return (
        <div className="dashboard">
            {/* ══════════ TOP ROW ══════════ */}
            <div className="dashboard-top">
                {/* ── Left: rep counter + avg score ── */}
                <div className="hud-left">
                    <div className="hud-rep-block" aria-live="polite" aria-atomic="true">
                        <FloatyNumbers repCount={repCount} />
                        <span className="hud-rep-count">{repCount}</span>
                        <span className="hud-rep-label">{getExerciseLabel(exerciseType)}</span>
                    </div>

                    {isCalibrated && (
                        <div className="hud-avg">
                            <ScoreRing score={averageScore} />
                            <span className="hud-avg-label">AVG</span>
                        </div>
                    )}
                </div>

                {/* ── Right: actions + goal/timer ── */}
                <div className="hud-right">
                    {/* Set indicator */}
                    {totalSets != null && totalSets > 1 && currentSet != null && (
                        <span className="set-indicator">
                            {currentBlock != null && displayTotalBlocks != null && displayTotalBlocks > 1
                                ? `${currentBlock}/${displayTotalBlocks} · ${currentSet}/${totalSets}`
                                : `Set ${currentSet}/${totalSets}`}
                        </span>
                    )}

                    {/* Goal or timer */}
                    {sessionMode === 'time' && (
                        <span className="hud-timer">
                            {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:
                            {String(timeRemaining % 60).padStart(2, '0')}
                        </span>
                    )}

                    {sessionMode === 'reps' && (
                        <div className="hud-goal">
                            <div className="hud-goal-track">
                                <div
                                    className={`hud-goal-fill${goalDone ? ' hud-goal-fill--done' : ''}`}
                                    style={{ width: `${goalPct}%` }}
                                />
                            </div>
                            <span className="hud-goal-count">{repCount}/{goalReps}</span>
                        </div>
                    )}

                    <div className="dashboard-actions">
                        <button
                            type="button"
                            className="btn-icon"
                            onClick={onFlipCamera}
                            title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1l2-3h6l2 3h1a2 2 0 0 1 2 2v1" />
                                <circle cx="9" cy="13" r="3" />
                                <path d="M17 15v6M14 18l3-3 3 3" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className={`btn-icon ${soundEnabled ? '' : 'btn-icon--muted'}`}
                            onClick={() => setSoundEnabled(s => !s)}
                            title={soundEnabled ? 'Mute' : 'Unmute'}
                        >
                            {soundEnabled ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <line x1="23" y1="9" x2="17" y2="15" />
                                    <line x1="17" y1="9" x2="23" y2="15" />
                                </svg>
                            )}
                        </button>
                        <button className="btn-stop" onClick={handleStop} type="button" aria-label="Stop workout">■</button>
                    </div>
                </div>
            </div>

            {/* ══════════ CENTER (grade pop — only briefly visible) ══════════ */}
            {lastRepResult && (
                <div className="dashboard-center">
                    <GradePop score={lastRepResult.score} repKey={repCount} />
                    <ComboMeter combo={combo} />
                </div>
            )}

            {/* ══════════ BOTTOM (coach hint + invalid banner) ══════════ */}
            <div className="dashboard-bottom">
                <CoachHint text={coachPhrase} />

                {showInvalidBanner && (
                    <div className={`invalid-position-banner${poseRejectedByLock ? ' invalid-position-banner--lock' : ''}`} role="alert">
                        {poseRejectedByLock
                            ? '👤 Wrong person detected — get back in frame'
                            : getInvalidPositionMessage(exerciseType)}
                    </div>
                )}
            </div>
        </div>
    );
});
