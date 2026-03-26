import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import type { ExerciseType } from '@exercises/types';
import './QuickSessionModal.scss';

interface QuickSessionModalProps {
    exerciseType: ExerciseType;
    onExerciseTypeChange: (type: ExerciseType) => void;
    sessionMode: 'reps' | 'time';
    onSessionModeChange: (mode: 'reps' | 'time') => void;
    goalReps: number;
    onGoalChange: (value: number) => void;
    timeGoal: { minutes: number; seconds: number };
    onTimeGoalChange: (time: { minutes: number; seconds: number }) => void;
    onStart: () => void;
    onClose: () => void;
    isReady: boolean;
}

export function QuickSessionModal({
    exerciseType,
    onExerciseTypeChange,
    sessionMode,
    onSessionModeChange,
    goalReps,
    onGoalChange,
    timeGoal,
    onTimeGoalChange,
    onStart,
    onClose,
    isReady,
}: QuickSessionModalProps) {
    return (
        <div className="qs-overlay" onClick={onClose}>
            <div className="qs-card" onClick={e => e.stopPropagation()}>
                <button type="button" className="qs-close-btn" onClick={onClose}>×</button>

                <h2 className="qs-title">⚡ Quick Session</h2>

                <ExercisePicker value={exerciseType} onChange={onExerciseTypeChange} />

                <div className="session-mode-toggle">
                    <button
                        type="button"
                        className={`btn-toggle ${sessionMode === 'reps' ? 'active' : ''}`}
                        onClick={() => onSessionModeChange('reps')}
                    >
                        🎯 Reps
                    </button>
                    <button
                        type="button"
                        className={`btn-toggle ${sessionMode === 'time' ? 'active' : ''}`}
                        onClick={() => onSessionModeChange('time')}
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
                            onChange={onGoalChange}
                        />
                    ) : (
                        <TimePicker
                            value={timeGoal}
                            onChange={onTimeGoalChange}
                        />
                    )}
                </div>

                <button type="button" className="btn-primary" onClick={() => { onClose(); onStart(); }} disabled={!isReady}>
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
