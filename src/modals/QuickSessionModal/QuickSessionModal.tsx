import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { SegmentedToggle } from '@components/SegmentedToggle/SegmentedToggle';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import { useWorkout } from '@app/WorkoutContext';
import { useModalClose } from '@hooks/shared/useModalClose';
import { useFocusTrap } from '@hooks/shared/useFocusTrap';
import './QuickSessionModal.scss';

interface QuickSessionModalProps {
    onClose: () => void;
}

export function QuickSessionModal({ onClose }: QuickSessionModalProps) {
    const { t } = useTranslation('modals');
    const {
        exerciseType, changeExerciseType,
        sessionMode, setSessionMode,
        goalReps, setGoalReps,
        timeGoal, setTimeGoal,
        handleStart,
    } = useWorkout();

    const { closing, handleClose, handleAnimationEnd } = useModalClose(onClose);
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef);

    return (
        <div
            ref={modalRef}
            className={`qs-overlay${closing ? ' qs-overlay--exit' : ''}`}
            onClick={handleClose}
            onAnimationEnd={handleAnimationEnd}
            role="dialog"
            aria-modal="true"
            aria-label={t('quicksession.label_aria')}
        >
            <div className={`qs-card${closing ? ' qs-card--exit' : ''}`} onClick={e => e.stopPropagation()}>
                <button type="button" className="qs-close-btn" onClick={handleClose} aria-label={t('quicksession.close_aria')}>×</button>

                <div className="qs-header">
                    <span className="qs-kicker">{t('quicksession.kicker')}</span>
                    <h2 className="qs-title">{t('quicksession.title')}</h2>
                </div>

                <ExercisePicker value={exerciseType} onChange={changeExerciseType} />

                <SegmentedToggle
                    value={sessionMode}
                    onChange={setSessionMode}
                    aria-label={t('quicksession.session_mode_aria')}
                    options={[
                        {
                            value: 'reps',
                            label: t('quicksession.mode_reps'),
                            icon: (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            ),
                        },
                        {
                            value: 'time',
                            label: t('quicksession.mode_time'),
                            icon: (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            ),
                        },
                    ]}
                />

                <div className="qs-goal-section">
                    <p className="qs-goal-label">{sessionMode === 'reps' ? t('quicksession.goal_set') : t('quicksession.goal_time')}</p>
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

                <PrimaryCTA
                    variant="solid"
                    size="lg"
                    block
                    icon="⚡"
                    onClick={() => { onClose(); handleStart(); }}
                    disabled={closing}
                >
                    {sessionMode === 'reps'
                        ? t('quicksession.start_reps', { count: goalReps })
                        : t('quicksession.start_time', { minutes: String(timeGoal.minutes).padStart(2, '0'), seconds: String(timeGoal.seconds).padStart(2, '0') })
                    }
                </PrimaryCTA>
            </div>
        </div>
    );
}
