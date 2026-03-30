import { useState, useCallback } from 'react';
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { useWorkout } from '@app/WorkoutContext';
import './QuickSessionModal.scss';

interface QuickSessionModalProps {
    onClose: () => void;
    isReady: boolean;
}

export function QuickSessionModal({ onClose, isReady }: QuickSessionModalProps) {
    const {
        exerciseType, changeExerciseType,
        sessionMode, setSessionMode,
        goalReps, setGoalReps,
        timeGoal, setTimeGoal,
        handleStart,
    } = useWorkout();

    const [closing, setClosing] = useState(false);

    const handleClose = useCallback(() => {
        setClosing(true);
    }, []);

    const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
        if (closing && e.currentTarget === e.target) onClose();
    }, [closing, onClose]);

    return (
        <div
            className={`qs-overlay${closing ? ' qs-overlay--exit' : ''}`}
            onClick={handleClose}
            onAnimationEnd={handleAnimationEnd}
        >
            <div className={`qs-card${closing ? ' qs-card--exit' : ''}`} onClick={e => e.stopPropagation()}>
                <button type="button" className="qs-close-btn" onClick={handleClose}>×</button>

                <h2 className="qs-title">⚡ Quick Session</h2>

                <ExercisePicker value={exerciseType} onChange={changeExerciseType} />

                <div className="session-mode-toggle">
                    <button
                        type="button"
                        className={`btn-toggle ${sessionMode === 'reps' ? 'active' : ''}`}
                        onClick={() => setSessionMode('reps')}
                    >
                        🎯 Reps
                    </button>
                    <button
                        type="button"
                        className={`btn-toggle ${sessionMode === 'time' ? 'active' : ''}`}
                        onClick={() => setSessionMode('time')}
                    >
                        ⏱ Time
                    </button>
                </div>

                <div className="goal-section">
                    <p className="goal-label">{sessionMode === 'reps' ? 'Set your goal' : 'Time limit'}</p>
                    {sessionMode === 'reps' ? (
                        <DragNumberPicker
                            value={goalReps}
                            min={1}
                            max={100}
                            onChange={setGoalReps}
                        />
                    ) : (
                        <TimePicker
                            value={timeGoal}
                            onChange={setTimeGoal}
                        />
                    )}
                </div>

                <button type="button" className="btn-primary" onClick={() => { onClose(); handleStart(); }} disabled={!isReady || closing}>
                    {isReady ? (
                        sessionMode === 'reps'
                            ? `Start — ${goalReps} rep${goalReps > 1 ? 's' : ''}`
                            : `Start — ${String(timeGoal.minutes).padStart(2, '0')}:${String(timeGoal.seconds).padStart(2, '0')}`
                    ) : 'Getting Ready…'}
                </button>
            </div>
        </div>
    );
}
