/**
 * RestScreen — Countdown timer shown between sets.
 * Displays the previous set's stats and a countdown to the next set.
 * User can skip rest early.
 */
import { useEffect, useState, useRef } from 'react';
import { getGradeLetter, getGradeClass } from '@lib/constants';
import type { SetRecord } from '@exercises/types';
import './RestScreen.scss';

interface RestScreenProps {
    /** Duration of rest in seconds */
    restDuration: number;
    /** Current set number (the one just completed, 1-based) */
    completedSet: number;
    /** Total number of sets */
    totalSets: number;
    /** The set that was just completed */
    lastSetResult: SetRecord;
    /** Called when rest is over (countdown ends or user skips) */
    onRestComplete: () => void;
    /** Label for the current exercise (e.g. "Push-ups") */
    exerciseLabel?: string;
    /** True when this rest is between two different exercises (not between sets) */
    isExerciseTransition?: boolean;
    /** Label for the next exercise (e.g. "Squats") */
    nextExerciseLabel?: string;
}

export function RestScreen({
    restDuration,
    completedSet,
    totalSets,
    lastSetResult,
    onRestComplete,
    exerciseLabel,
    isExerciseTransition = false,
    nextExerciseLabel,
}: RestScreenProps) {
    const [remaining, setRemaining] = useState(restDuration);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const progressPct = ((restDuration - remaining) / restDuration) * 100;

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Trigger next set when countdown reaches 0
    useEffect(() => {
        if (remaining === 0) {
            onRestComplete();
        }
    }, [remaining, onRestComplete]);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;

    return (
        <div className="rest-screen">
            <div className="rest-card">
                {/* Set completed feedback */}
                <div className="rest-set-feedback">
                    <span className="rest-set-badge">
                        {isExerciseTransition
                            ? `✅ Exercise ${completedSet}/${totalSets} done`
                            : `✅ Set ${completedSet}/${totalSets}`}
                    </span>
                    {exerciseLabel && (
                        <span className="rest-exercise-label">{exerciseLabel}</span>
                    )}
                    <div className="rest-set-stats">
                        <div className="rest-stat">
                            <span className="rest-stat-value">{lastSetResult.reps}</span>
                            <span className="rest-stat-label">Reps</span>
                        </div>
                        <div className="rest-stat-divider" />
                        <div className="rest-stat">
                            <span className={`rest-stat-value grade ${getGradeClass(lastSetResult.averageScore)}`}>
                                {getGradeLetter(lastSetResult.averageScore)}
                            </span>
                            <span className="rest-stat-label">Grade</span>
                        </div>
                        <div className="rest-stat-divider" />
                        <div className="rest-stat">
                            <span className="rest-stat-value">{lastSetResult.averageScore}</span>
                            <span className="rest-stat-label">Score</span>
                        </div>
                    </div>
                </div>

                {/* Countdown */}
                <div className="rest-countdown-section">
                    <p className="rest-countdown-label">
                        {isExerciseTransition ? 'Next exercise in' : 'Next set in'}
                    </p>
                    <div className="rest-countdown-timer">
                        <span className="rest-countdown-digits">
                            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </span>
                    </div>
                    <div className="rest-countdown-bar">
                        <div
                            className="rest-countdown-fill"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="rest-up-next">
                        {isExerciseTransition && nextExerciseLabel
                            ? `Up next: ${nextExerciseLabel}`
                            : `Up next: Set ${completedSet + 1}/${totalSets}`}
                    </p>
                </div>

                <button type="button" className="btn-primary" onClick={onRestComplete}>
                    ⏭ Skip Rest
                </button>
            </div>
        </div>
    );
}
