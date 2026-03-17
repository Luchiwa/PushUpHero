/**
 * WorkoutConfigScreen — Full-screen preparation screen for multi-set workouts.
 * Configures: number of sets, set mode (reps/time), goal per set, rest duration.
 */
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { MIN_SETS, MAX_SETS, MAX_REST_SECONDS } from '@lib/constants';
import './WorkoutConfigScreen.scss';

export interface WorkoutConfig {
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

export function WorkoutConfigScreen({
    config,
    onConfigChange,
    onStart,
    onBack,
    isReady,
}: WorkoutConfigScreenProps) {
    const { numberOfSets, sessionMode, goalReps, timeGoal, restTime } = config;

    const totalRestSeconds = restTime.minutes * 60 + restTime.seconds;
    const maxRestMinutes = Math.floor(MAX_REST_SECONDS / 60);

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

    return (
        <div className="workout-config-screen">
            <div className="workout-config-card">
                <button className="btn-icon workout-config-back" onClick={onBack} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <h2 className="workout-config-title">Workout Setup</h2>
                <p className="workout-config-subtitle">Configure your multi-set session</p>

                {/* ── Number of sets ── */}
                <div className="config-section">
                    <p className="config-label">Number of sets</p>
                    <DragNumberPicker
                        value={numberOfSets}
                        min={MIN_SETS}
                        max={MAX_SETS}
                        onChange={(v) => onConfigChange({ ...config, numberOfSets: v })}
                        unit="sets"
                    />
                </div>

                <div className="config-divider" />

                {/* ── Set mode ── */}
                <div className="config-section">
                    <p className="config-label">Set type</p>
                    <div className="session-mode-toggle">
                        <button
                            className={`btn-toggle ${sessionMode === 'reps' ? 'active' : ''}`}
                            onClick={() => onConfigChange({ ...config, sessionMode: 'reps' })}
                        >
                            🎯 Reps
                        </button>
                        <button
                            className={`btn-toggle ${sessionMode === 'time' ? 'active' : ''}`}
                            onClick={() => onConfigChange({ ...config, sessionMode: 'time' })}
                        >
                            ⏱ Time
                        </button>
                    </div>
                </div>

                {/* ── Goal per set ── */}
                <div className="config-section">
                    <p className="config-label">Goal per set</p>
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

                {numberOfSets > 1 && (
                    <>
                        <div className="config-divider" />

                        {/* ── Rest between sets ── */}
                        <div className="config-section">
                            <p className="config-label">Rest between sets</p>
                            <TimePicker
                                value={restTime}
                                onChange={(t) => onConfigChange({ ...config, restTime: t })}
                                maxMinutes={maxRestMinutes}
                            />
                        </div>
                    </>
                )}

                <div className="config-divider" />

                {/* ── Summary ── */}
                <div className="workout-summary">
                    <span className="workout-summary-icon">📋</span>
                    <div className="workout-summary-details">
                        <span className="workout-summary-line">
                            {numberOfSets} set{numberOfSets > 1 ? 's' : ''} × {setGoalLabel}
                        </span>
                        {numberOfSets > 1 && (
                            <span className="workout-summary-line workout-summary-rest">
                                {restTime.minutes > 0 ? `${restTime.minutes}min` : ''}{restTime.seconds > 0 ? `${restTime.seconds}s` : restTime.minutes === 0 ? '0s' : ''} rest
                            </span>
                        )}
                        {totalRepsEstimate !== null && (
                            <span className="workout-summary-total">
                                {totalRepsEstimate} total reps
                            </span>
                        )}
                        {totalTimeEstimate !== null && (
                            <span className="workout-summary-total">
                                ~{formatEstimate(totalTimeEstimate)} total
                            </span>
                        )}
                    </div>
                </div>

                <button className="btn-primary" onClick={onStart} disabled={!isReady}>
                    {isReady ? '🚀 Start Workout' : 'Getting Ready…'}
                </button>
            </div>
        </div>
    );
}
