import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { SegmentedToggle } from '@components/SegmentedToggle/SegmentedToggle';
import { MIN_SETS, MAX_SETS, MAX_REST_SECONDS, MAX_EXERCISE_REST_SECONDS } from '@domain/constants';
import { getExerciseLabel } from '@exercises/types';
import type { WorkoutBlock } from '@exercises/types';
import { PageLayout } from '@components/PageLayout/PageLayout';
import './BlockEditor.scss';

type BlockStep = 'exercise' | 'sets' | 'goal' | 'rest-sets' | 'rest-exercise';

interface BlockEditorProps {
    editingBlock: WorkoutBlock;
    editingBlockIndex: number;
    isAddingNew: boolean;
    blockSteps: BlockStep[];
    blockStep: BlockStep;
    onBack: () => void;
    onNext: () => void;
    onUpdateBlock: (partial: Partial<WorkoutBlock>) => void;
}

export function BlockEditor({
    editingBlock,
    editingBlockIndex,
    isAddingNew,
    blockSteps,
    blockStep,
    onBack,
    onNext,
    onUpdateBlock,
}: BlockEditorProps) {
    const { exerciseType, numberOfSets, sessionMode, goalReps, timeGoal, restBetweenSets, restAfterBlock } = editingBlock;
    const maxRestMinutes = Math.floor(MAX_REST_SECONDS / 60);
    const maxExerciseRestMinutes = Math.floor(MAX_EXERCISE_REST_SECONDS / 60);
    const blockStepIndex = blockSteps.indexOf(blockStep);

    return (
        <PageLayout
            title={isAddingNew ? 'Add Exercise' : `Edit Exercise ${editingBlockIndex + 1}`}
            onClose={onBack}
            // At non-first wizard steps, "back" navigates within the same mounted
            // BlockEditor (just changes blockStep). Bypass PageLayout's exit
            // animation so it doesn't end up stuck in its post-exit state.
            // At step 0, "back" actually unmounts BlockEditor, so the animated
            // close path is the right one.
            onBack={blockStepIndex > 0 ? onBack : undefined}
            zIndex={200}
            bodyClassName="wc-layout"
            transition="sheet"
        >
            <div className="wc-progress">
                <div className="wc-progress-track">
                    {blockSteps.map((s, i) => (
                        <div
                            key={s}
                            className={`wc-progress-seg${i <= blockStepIndex ? ' wc-progress-seg--done' : ''}`}
                        />
                    ))}
                    <div
                        className="wc-progress-indicator"
                        style={{
                            width: `calc(${100 / blockSteps.length}% - 4px)`,
                            left: `calc(${(blockStepIndex / blockSteps.length) * 100}% + 2px)`,
                        }}
                    />
                </div>
                <span className="wc-progress-label">{blockStepIndex + 1} / {blockSteps.length}</span>
            </div>

            <div className="wc-body">
                {blockStep === 'exercise' && (
                    <div className="wc-step" key="exercise">
                        <div className="wc-step-header">
                            <span className="wc-step-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" y1="20" x2="20" y2="20" /></svg>
                            </span>
                            <h2 className="wc-step-title">Choose exercise</h2>
                            <p className="wc-step-subtitle">Select the exercise for this block</p>
                        </div>
                        <div className="wc-step-content">
                            <ExercisePicker
                                value={exerciseType}
                                onChange={(t) => onUpdateBlock({ exerciseType: t })}
                            />
                        </div>
                    </div>
                )}

                {blockStep === 'sets' && (
                    <div className="wc-step" key="sets">
                        <div className="wc-step-header">
                            <span className="wc-step-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                            </span>
                            <h2 className="wc-step-title">How many sets?</h2>
                            <p className="wc-step-subtitle">Number of sets for {getExerciseLabel(exerciseType)}</p>
                        </div>
                        <div className="wc-step-content">
                            <DragNumberPicker
                                value={numberOfSets}
                                min={MIN_SETS}
                                max={MAX_SETS}
                                onChange={(v) => onUpdateBlock({ numberOfSets: v })}
                                unit="sets"
                            />
                        </div>
                    </div>
                )}

                {blockStep === 'goal' && (
                    <div className="wc-step" key="goal">
                        <div className="wc-step-header">
                            <span className="wc-step-icon">
                                {sessionMode === 'reps'
                                    ? <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                    : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                }
                            </span>
                            <h2 className="wc-step-title">Set your goal</h2>
                            <p className="wc-step-subtitle">Target for each set of {getExerciseLabel(exerciseType)}</p>
                        </div>
                        <div className="wc-step-content">
                            <SegmentedToggle
                                value={sessionMode}
                                onChange={(v) => onUpdateBlock({ sessionMode: v })}
                                aria-label="Session mode"
                                options={[
                                    {
                                        value: 'reps',
                                        label: 'Reps',
                                        icon: (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                        ),
                                    },
                                    {
                                        value: 'time',
                                        label: 'Time',
                                        icon: (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        ),
                                    },
                                ]}
                            />
                            {sessionMode === 'reps' ? (
                                <DragNumberPicker
                                    value={goalReps}
                                    min={1}
                                    max={100}
                                    onChange={(v) => onUpdateBlock({ goalReps: v })}
                                />
                            ) : (
                                <TimePicker
                                    value={timeGoal}
                                    onChange={(t) => onUpdateBlock({ timeGoal: t })}
                                />
                            )}
                        </div>
                    </div>
                )}

                {blockStep === 'rest-sets' && (
                    <div className="wc-step" key="rest-sets">
                        <div className="wc-step-header">
                            <span className="wc-step-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                            </span>
                            <h2 className="wc-step-title">Rest between sets</h2>
                            <p className="wc-step-subtitle">How long between each set of {getExerciseLabel(exerciseType)}?</p>
                        </div>
                        <div className="wc-step-content">
                            <TimePicker
                                value={restBetweenSets}
                                onChange={(t) => onUpdateBlock({ restBetweenSets: t })}
                                maxMinutes={maxRestMinutes}
                            />
                        </div>
                    </div>
                )}

                {blockStep === 'rest-exercise' && (
                    <div className="wc-step" key="rest-exercise">
                        <div className="wc-step-header">
                            <span className="wc-step-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            </span>
                            <h2 className="wc-step-title">Rest before next exercise</h2>
                            <p className="wc-step-subtitle">Recovery time after {getExerciseLabel(exerciseType)}</p>
                        </div>
                        <div className="wc-step-content">
                            <TimePicker
                                value={restAfterBlock}
                                onChange={(t) => onUpdateBlock({ restAfterBlock: t })}
                                maxMinutes={maxExerciseRestMinutes}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="wc-bottom-bar">
                <button type="button" className="btn-primary wc-next-btn" onClick={onNext}>
                    {blockStepIndex >= blockSteps.length - 1
                        ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Done</>
                        : <>Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></>}
                </button>
            </div>

            <div className="wc-footer">
                <span className="wc-step-counter">
                    Step {blockStepIndex + 1} of {blockSteps.length}
                </span>
            </div>
        </PageLayout>
    );
}
