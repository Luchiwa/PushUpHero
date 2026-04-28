/**
 * RestScreen — Countdown timer shown between sets.
 * Displays the previous set's stats and a countdown to the next set.
 * User can skip rest early.
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getGradeLetter, getGradeClass } from '@domain';
import { getExerciseLabelKey, type ExerciseType, type SetRecord } from '@exercises/types';
import { useWorkout } from '@app/WorkoutContext';
import { useBackButton } from '@hooks/shared/useBackButton';
import { speakRestStart, speakRestEnding } from '@infra/coachEngine';
import './RestScreen.scss';

/** Fire `speakRestEnding` when N seconds remain (gives the user time to hear it). */
const REST_ENDING_AT_REMAINING = 5;

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
    /** Current exercise — drives the i18n label */
    exerciseType?: ExerciseType;
    /** True when this rest is between two different exercises (not between sets) */
    isExerciseTransition?: boolean;
    /** Next exercise — drives the i18n "Up next" label */
    nextExerciseType?: ExerciseType;
}

export function RestScreen({
    restDuration,
    completedSet,
    totalSets,
    lastSetResult,
    onRestComplete,
    exerciseType,
    isExerciseTransition = false,
    nextExerciseType,
}: RestScreenProps) {
    const { t } = useTranslation('workout');
    const [remaining, setRemaining] = useState(restDuration);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Android / system back button → stops the workout, mirroring the active screen.
    const { handleStop, soundEnabled } = useWorkout();
    useBackButton(true, handleStop);

    const progressPct = ((restDuration - remaining) / restDuration) * 100;

    // ── Coach speech: rest_start once on mount, rest_ending once at the 5 s mark ──
    const restEndingFiredRef = useRef(false);

    useEffect(() => {
        if (soundEnabled) speakRestStart();
        // Mount-only: a mid-rest sound toggle does not re-fire the cue.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // rest_ending cue + rest_complete dispatch driven by the countdown
    useEffect(() => {
        if (
            remaining === REST_ENDING_AT_REMAINING
            && !restEndingFiredRef.current
            && soundEnabled
        ) {
            restEndingFiredRef.current = true;
            speakRestEnding();
        }
        if (remaining === 0) {
            onRestComplete();
        }
    }, [remaining, onRestComplete, soundEnabled]);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;

    const exerciseLabel = exerciseType ? t(getExerciseLabelKey(exerciseType)) : null;
    const nextExerciseLabel = nextExerciseType ? t(getExerciseLabelKey(nextExerciseType)) : null;

    return (
        <div className="rest-screen" role="status">
            <div className="rest-card">
                {/* Set completed feedback */}
                <div className="rest-set-feedback">
                    <span className="rest-set-badge">
                        {isExerciseTransition
                            ? t('rest.exercise_done', { current: completedSet, total: totalSets })
                            : t('rest.set_done', { current: completedSet, total: totalSets })}
                    </span>
                    {exerciseLabel && (
                        <span className="rest-exercise-label">{exerciseLabel}</span>
                    )}
                    <div className="rest-set-stats">
                        <div className="rest-stat">
                            <span className="rest-stat-value">{lastSetResult.reps}</span>
                            <span className="rest-stat-label">{t('rest.stat_reps')}</span>
                        </div>
                        <div className="rest-stat-divider" />
                        <div className="rest-stat">
                            <span className={`rest-stat-value grade ${getGradeClass(lastSetResult.averageScore)}`}>
                                {getGradeLetter(lastSetResult.averageScore)}
                            </span>
                            <span className="rest-stat-label">{t('rest.stat_grade')}</span>
                        </div>
                        <div className="rest-stat-divider" />
                        <div className="rest-stat">
                            <span className="rest-stat-value">{lastSetResult.averageScore}</span>
                            <span className="rest-stat-label">{t('rest.stat_score')}</span>
                        </div>
                    </div>
                </div>

                {/* Countdown */}
                <div className="rest-countdown-section">
                    <p className="rest-countdown-label">
                        {isExerciseTransition ? t('rest.next_exercise_in') : t('rest.next_set_in')}
                    </p>
                    <div className="rest-countdown-timer">
                        <span className="rest-countdown-digits" aria-hidden="true">
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
                            ? t('rest.up_next_exercise', { exercise: nextExerciseLabel })
                            : t('rest.up_next_set', { current: completedSet + 1, total: totalSets })}
                    </p>
                </div>

                <button type="button" className="btn-primary" onClick={onRestComplete}>
                    {t('rest.skip_rest')}
                </button>
            </div>
        </div>
    );
}
