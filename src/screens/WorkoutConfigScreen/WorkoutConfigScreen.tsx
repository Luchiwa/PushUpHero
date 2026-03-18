/**
 * WorkoutConfigScreen — Full-screen step-by-step wizard for multi-set workouts.
 * Steps: Sets → Type + Goal → Rest (if >1 set) → Summary.
 */
import { useState, useCallback } from 'react';
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { MIN_SETS, MAX_SETS, MAX_REST_SECONDS } from '@lib/constants';
import './WorkoutConfigScreen.scss';

import type { ExerciseType } from '@exercises/types';

export interface WorkoutConfig {
    exerciseType: ExerciseType;
    numberOfSets: number;
    sessionMode: 'reps' | 'time';
    goalReps: number;
    timeGoal: { minutes: number; seconds: number };
    restTime: { minutes: number; seconds: number };
}

interface WorkoutConfigScreenProps {
    config: WorkoutConfig;
    onConfigChange: (config: WorkoutConfig) => void;
    onStart: () => void;
    onBack: () => void;
    isReady: boolean;
}

type Step = 'exercise' | 'sets' | 'goal' | 'rest' | 'summary';

function getSteps(numberOfSets: number): Step[] {
    const steps: Step[] = ['exercise', 'sets', 'goal'];
    if (numberOfSets > 1) steps.push('rest');
    steps.push('summary');
    return steps;
}

export function WorkoutConfigScreen({
    config,
    onConfigChange,
    onStart,
    onBack,
    isReady,
}: WorkoutConfigScreenProps) {
    const { exerciseType, numberOfSets, sessionMode, goalReps, timeGoal, restTime } = config;
    const [currentStep, setCurrentStep] = useState<Step>('exercise');

    const steps = getSteps(numberOfSets);
    const stepIndex = steps.indexOf(currentStep);
    const totalSteps = steps.length;

    const maxRestMinutes = Math.floor(MAX_REST_SECONDS / 60);
    const totalRestSeconds = restTime.minutes * 60 + restTime.seconds;

    const setGoalLabel = sessionMode === 'reps'
        ? `${goalReps} rep${goalReps > 1 ? 's' : ''}`
        : `${String(timeGoal.minutes).padStart(2, '0')}:${String(timeGoal.seconds).padStart(2, '0')}`;

    const totalRepsEstimate = sessionMode === 'reps' ? goalReps * numberOfSets : null;
    const totalTimeEstimate = sessionMode === 'time'
        ? (timeGoal.minutes * 60 + timeGoal.seconds) * numberOfSets + totalRestSeconds * (numberOfSets - 1)
        : null;

    const formatEstimate = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (secs === 0) return `${mins}min`;
        return `${mins}min${secs.toString().padStart(2, '0')}s`;
    };

    const handleNext = useCallback(() => {
        const idx = steps.indexOf(currentStep);
        if (idx < steps.length - 1) {
            setCurrentStep(steps[idx + 1]);
        }
    }, [currentStep, steps]);

    const handleStepBack = useCallback(() => {
        const idx = steps.indexOf(currentStep);
        if (idx > 0) {
            setCurrentStep(steps[idx - 1]);
        } else {
            onBack();
        }
    }, [currentStep, steps, onBack]);

    return (
        <div className="workout-config-screen">
            {/* ── Top bar ── */}
            <div className="wc-topbar">
                <button type="button" className="btn-icon wc-back-btn" onClick={handleStepBack} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <title>Back</title>
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="wc-topbar-title">Workout Setup</span>
                {/* Spacer for centering */}
                <div style={{ width: 40 }} />
            </div>

            {/* ── Progress dots ── */}
            <div className="wc-progress">
                {steps.map((s, i) => (
                    <div
                        key={s}
                        className={`wc-progress-dot${i <= stepIndex ? ' wc-progress-dot--active' : ''}`}
                    />
                ))}
            </div>

            {/* ── Body ── */}
            <div className="wc-body">
                {/* ── Step: Exercise ── */}
                {currentStep === 'exercise' && (
                    <div className="wc-step" key="exercise">
                        <div className="wc-step-header">
                            <span className="wc-step-emoji">🏋️</span>
                            <h2 className="wc-step-title">Choose your exercise</h2>
                            <p className="wc-step-subtitle">Select the exercise for this workout</p>
                        </div>
                        <div className="wc-step-content">
                            <ExercisePicker
                                value={exerciseType}
                                onChange={(t) => onConfigChange({ ...config, exerciseType: t })}
                            />
                        </div>
                    </div>
                )}

                {/* ── Step: Sets ── */}
                {currentStep === 'sets' && (
                    <div className="wc-step" key="sets">
                        <div className="wc-step-header">
                            <span className="wc-step-emoji">🔢</span>
                            <h2 className="wc-step-title">How many sets?</h2>
                            <p className="wc-step-subtitle">Choose the number of sets for your workout</p>
                        </div>
                        <div className="wc-step-content">
                            <DragNumberPicker
                                value={numberOfSets}
                                min={MIN_SETS}
                                max={MAX_SETS}
                                onChange={(v) => onConfigChange({ ...config, numberOfSets: v })}
                                unit="sets"
                            />
                        </div>
                    </div>
                )}

                {/* ── Step: Type + Goal ── */}
                {currentStep === 'goal' && (
                    <div className="wc-step" key="goal">
                        <div className="wc-step-header">
                            <span className="wc-step-emoji">{sessionMode === 'reps' ? '🎯' : '⏱'}</span>
                            <h2 className="wc-step-title">Set your goal</h2>
                            <p className="wc-step-subtitle">Choose the type and target for each set</p>
                        </div>
                        <div className="wc-step-content">
                            <div className="session-mode-toggle">
                                <button
                                    type="button"
                                    className={`btn-toggle ${sessionMode === 'reps' ? 'active' : ''}`}
                                    onClick={() => onConfigChange({ ...config, sessionMode: 'reps' })}
                                >
                                    🎯 Reps
                                </button>
                                <button
                                    type="button"
                                    className={`btn-toggle ${sessionMode === 'time' ? 'active' : ''}`}
                                    onClick={() => onConfigChange({ ...config, sessionMode: 'time' })}
                                >
                                    ⏱ Time
                                </button>
                            </div>

                            {sessionMode === 'reps' ? (
                                <DragNumberPicker
                                    value={goalReps}
                                    min={1}
                                    max={100}
                                    onChange={(v) => onConfigChange({ ...config, goalReps: v })}
                                />
                            ) : (
                                <TimePicker
                                    value={timeGoal}
                                    onChange={(t) => onConfigChange({ ...config, timeGoal: t })}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step: Rest ── */}
                {currentStep === 'rest' && (
                    <div className="wc-step" key="rest">
                        <div className="wc-step-header">
                            <span className="wc-step-emoji">💤</span>
                            <h2 className="wc-step-title">Rest between sets</h2>
                            <p className="wc-step-subtitle">How long do you want to rest between each set?</p>
                        </div>
                        <div className="wc-step-content">
                            <TimePicker
                                value={restTime}
                                onChange={(t) => onConfigChange({ ...config, restTime: t })}
                                maxMinutes={maxRestMinutes}
                            />
                        </div>
                    </div>
                )}

                {/* ── Step: Summary ── */}
                {currentStep === 'summary' && (
                    <div className="wc-step" key="summary">
                        <div className="wc-step-header">
                            <span className="wc-step-emoji">📋</span>
                            <h2 className="wc-step-title">Ready to go!</h2>
                            <p className="wc-step-subtitle">Review your workout</p>
                        </div>

                        <div className="wc-summary">
                            <div className="wc-summary-row">
                                <span className="wc-summary-label">Exercise</span>
                                <span className="wc-summary-value">{exerciseType === 'pushup' ? '🧑‍💻 Push-ups' : '🦵 Squats'}</span>
                            </div>
                            <div className="wc-summary-divider" />
                            <div className="wc-summary-row">
                                <span className="wc-summary-label">Sets</span>
                                <span className="wc-summary-value">{numberOfSets}</span>
                            </div>
                            <div className="wc-summary-divider" />
                            <div className="wc-summary-row">
                                <span className="wc-summary-label">Goal per set</span>
                                <span className="wc-summary-value">{setGoalLabel}</span>
                            </div>
                            {numberOfSets > 1 && (
                                <>
                                    <div className="wc-summary-divider" />
                                    <div className="wc-summary-row">
                                        <span className="wc-summary-label">Rest</span>
                                        <span className="wc-summary-value">
                                            {restTime.minutes > 0 ? `${restTime.minutes}min ` : ''}{restTime.seconds > 0 ? `${restTime.seconds}s` : restTime.minutes === 0 ? '0s' : ''}
                                        </span>
                                    </div>
                                </>
                            )}
                            <div className="wc-summary-divider" />
                            <div className="wc-summary-row wc-summary-row--total">
                                <span className="wc-summary-label">Total</span>
                                <span className="wc-summary-value wc-summary-value--accent">
                                    {totalRepsEstimate !== null && `${totalRepsEstimate} reps`}
                                    {totalTimeEstimate !== null && `~${formatEstimate(totalTimeEstimate)}`}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom action bar (always pinned above footer) ── */}
            <div className="wc-bottom-bar">
                {currentStep === 'summary' ? (
                    <button type="button" className="btn-primary wc-next-btn" onClick={onStart} disabled={!isReady}>
                        {isReady ? '🚀 Start Workout' : 'Getting Ready…'}
                    </button>
                ) : (
                    <button type="button" className="btn-primary wc-next-btn" onClick={handleNext}>
                        Next →
                    </button>
                )}
            </div>

            {/* ── Step counter ── */}
            <div className="wc-footer">
                <span className="wc-step-counter">
                    Step {stepIndex + 1} of {totalSteps}
                </span>
            </div>
        </div>
    );
}
