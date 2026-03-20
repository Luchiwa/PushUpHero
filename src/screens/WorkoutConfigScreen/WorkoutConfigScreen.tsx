/**
 * WorkoutConfigScreen — Multi-exercise workout builder.
 *
 * Two modes:
 * 1. Block list — shows all added exercise blocks, can add/remove/reorder
 * 2. Block editor — step-by-step wizard for one block (exercise → sets → goal → rest)
 */
import { useState, useCallback } from 'react';
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { TimePicker } from '@components/TimePicker/TimePicker';
import { ExercisePicker } from '@components/ExercisePicker/ExercisePicker';
import { MIN_SETS, MAX_SETS, MAX_REST_SECONDS, MAX_EXERCISE_REST_SECONDS } from '@lib/constants';
import { getExerciseLabel } from '@exercises/types';
import type { WorkoutPlan, WorkoutBlock } from '@exercises/types';
import { createDefaultBlock } from '@exercises/types';
import './WorkoutConfigScreen.scss';

// ── Helpers ──────────────────────────────────────────────────────

const EXERCISE_EMOJI: Record<string, string> = {
    pushup: '💪',
    squat: '🦵',
};

function formatDuration(d: { minutes: number; seconds: number }): string {
    if (d.minutes > 0 && d.seconds > 0) return `${d.minutes}min${d.seconds}s`;
    if (d.minutes > 0) return `${d.minutes}min`;
    return `${d.seconds}s`;
}

// ── Props ────────────────────────────────────────────────────────

interface WorkoutConfigScreenProps {
    plan: WorkoutPlan;
    onPlanChange: (plan: WorkoutPlan) => void;
    onStart: () => void;
    onBack: () => void;
    isReady: boolean;
}

// ── Block editor steps ───────────────────────────────────────────

type BlockStep = 'exercise' | 'sets' | 'goal' | 'rest-sets' | 'rest-exercise';

function getBlockSteps(block: WorkoutBlock): BlockStep[] {
    const steps: BlockStep[] = ['exercise', 'sets', 'goal'];
    if (block.numberOfSets > 1) steps.push('rest-sets');
    steps.push('rest-exercise');
    return steps;
}

// ── Component ────────────────────────────────────────────────────

export function WorkoutConfigScreen({
    plan,
    onPlanChange,
    onStart,
    onBack,
    isReady,
}: WorkoutConfigScreenProps) {
    // null = block list mode, number = editing block at that index
    const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
    const [blockStep, setBlockStep] = useState<BlockStep>('exercise');
    // Track if we're adding a new block (vs editing existing)
    const [isAddingNew, setIsAddingNew] = useState(false);

    const blocks = plan.blocks;

    // ── Block list helpers ────────────────────────────────────────

    const handleAddBlock = useCallback(() => {
        const newBlock = createDefaultBlock('pushup');
        const updated = { blocks: [...blocks, newBlock] };
        onPlanChange(updated);
        setEditingBlockIndex(blocks.length);
        setBlockStep('exercise');
        setIsAddingNew(true);
    }, [blocks, onPlanChange]);

    const handleEditBlock = useCallback((index: number) => {
        setEditingBlockIndex(index);
        setBlockStep('exercise');
        setIsAddingNew(false);
    }, []);

    const handleRemoveBlock = useCallback((index: number) => {
        const updated = { blocks: blocks.filter((_, i) => i !== index) };
        onPlanChange(updated);
    }, [blocks, onPlanChange]);

    const handleMoveBlock = useCallback((index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= blocks.length) return;
        const newBlocks = [...blocks];
        [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
        onPlanChange({ blocks: newBlocks });
    }, [blocks, onPlanChange]);

    // ── Block editor helpers ──────────────────────────────────────

    const editingBlock = editingBlockIndex !== null ? blocks[editingBlockIndex] : null;

    const updateBlock = useCallback((partial: Partial<WorkoutBlock>) => {
        if (editingBlockIndex === null) return;
        const newBlocks = [...blocks];
        newBlocks[editingBlockIndex] = { ...newBlocks[editingBlockIndex], ...partial };
        onPlanChange({ blocks: newBlocks });
    }, [editingBlockIndex, blocks, onPlanChange]);

    const blockSteps = editingBlock ? getBlockSteps(editingBlock) : [];
    const blockStepIndex = blockSteps.indexOf(blockStep);

    const handleBlockNext = useCallback(() => {
        const idx = blockSteps.indexOf(blockStep);
        if (idx < blockSteps.length - 1) {
            setBlockStep(blockSteps[idx + 1]);
        } else {
            // Done editing this block → back to list
            setEditingBlockIndex(null);
            setIsAddingNew(false);
        }
    }, [blockStep, blockSteps]);

    const handleBlockBack = useCallback(() => {
        const idx = blockSteps.indexOf(blockStep);
        if (idx > 0) {
            setBlockStep(blockSteps[idx - 1]);
        } else if (isAddingNew) {
            // Cancel adding: remove the block
            handleRemoveBlock(editingBlockIndex as number);
            setEditingBlockIndex(null);
            setIsAddingNew(false);
        } else {
            // Back to list
            setEditingBlockIndex(null);
        }
    }, [blockStep, blockSteps, isAddingNew, editingBlockIndex, handleRemoveBlock]);

    const handleTopBack = useCallback(() => {
        if (editingBlockIndex !== null) {
            handleBlockBack();
        } else {
            onBack();
        }
    }, [editingBlockIndex, handleBlockBack, onBack]);

    // ── Render: Block Editor ──────────────────────────────────────

    if (editingBlock && editingBlockIndex !== null) {
        const { exerciseType, numberOfSets, sessionMode, goalReps, timeGoal, restBetweenSets, restAfterBlock } = editingBlock;
        const maxRestMinutes = Math.floor(MAX_REST_SECONDS / 60);
        const maxExerciseRestMinutes = Math.floor(MAX_EXERCISE_REST_SECONDS / 60);

        return (
            <div className="workout-config-screen">
                <div className="wc-topbar">
                    <button type="button" className="btn-icon wc-back-btn" onClick={handleBlockBack} aria-label="Back">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <title>Back</title>
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <span className="wc-topbar-title">
                        {isAddingNew ? 'Add Exercise' : `Edit Exercise ${editingBlockIndex + 1}`}
                    </span>
                    <div style={{ width: 40 }} />
                </div>

                <div className="wc-progress">
                    {blockSteps.map((s, i) => (
                        <div
                            key={s}
                            className={`wc-progress-dot${i <= blockStepIndex ? ' wc-progress-dot--active' : ''}`}
                        />
                    ))}
                </div>

                <div className="wc-body">
                    {blockStep === 'exercise' && (
                        <div className="wc-step" key="exercise">
                            <div className="wc-step-header">
                                <span className="wc-step-emoji">🏋️</span>
                                <h2 className="wc-step-title">Choose exercise</h2>
                                <p className="wc-step-subtitle">Select the exercise for this block</p>
                            </div>
                            <div className="wc-step-content">
                                <ExercisePicker
                                    value={exerciseType}
                                    onChange={(t) => updateBlock({ exerciseType: t })}
                                />
                            </div>
                        </div>
                    )}

                    {blockStep === 'sets' && (
                        <div className="wc-step" key="sets">
                            <div className="wc-step-header">
                                <span className="wc-step-emoji">🔢</span>
                                <h2 className="wc-step-title">How many sets?</h2>
                                <p className="wc-step-subtitle">Number of sets for {getExerciseLabel(exerciseType)}</p>
                            </div>
                            <div className="wc-step-content">
                                <DragNumberPicker
                                    value={numberOfSets}
                                    min={MIN_SETS}
                                    max={MAX_SETS}
                                    onChange={(v) => updateBlock({ numberOfSets: v })}
                                    unit="sets"
                                />
                            </div>
                        </div>
                    )}

                    {blockStep === 'goal' && (
                        <div className="wc-step" key="goal">
                            <div className="wc-step-header">
                                <span className="wc-step-emoji">{sessionMode === 'reps' ? '🎯' : '⏱'}</span>
                                <h2 className="wc-step-title">Set your goal</h2>
                                <p className="wc-step-subtitle">Target for each set of {getExerciseLabel(exerciseType)}</p>
                            </div>
                            <div className="wc-step-content">
                                <div className="session-mode-toggle">
                                    <button
                                        type="button"
                                        className={`btn-toggle ${sessionMode === 'reps' ? 'active' : ''}`}
                                        onClick={() => updateBlock({ sessionMode: 'reps' })}
                                    >
                                        🎯 Reps
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn-toggle ${sessionMode === 'time' ? 'active' : ''}`}
                                        onClick={() => updateBlock({ sessionMode: 'time' })}
                                    >
                                        ⏱ Time
                                    </button>
                                </div>
                                {sessionMode === 'reps' ? (
                                    <DragNumberPicker
                                        value={goalReps}
                                        min={1}
                                        max={100}
                                        onChange={(v) => updateBlock({ goalReps: v })}
                                    />
                                ) : (
                                    <TimePicker
                                        value={timeGoal}
                                        onChange={(t) => updateBlock({ timeGoal: t })}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {blockStep === 'rest-sets' && (
                        <div className="wc-step" key="rest-sets">
                            <div className="wc-step-header">
                                <span className="wc-step-emoji">💤</span>
                                <h2 className="wc-step-title">Rest between sets</h2>
                                <p className="wc-step-subtitle">How long between each set of {getExerciseLabel(exerciseType)}?</p>
                            </div>
                            <div className="wc-step-content">
                                <TimePicker
                                    value={restBetweenSets}
                                    onChange={(t) => updateBlock({ restBetweenSets: t })}
                                    maxMinutes={maxRestMinutes}
                                />
                            </div>
                        </div>
                    )}

                    {blockStep === 'rest-exercise' && (
                        <div className="wc-step" key="rest-exercise">
                            <div className="wc-step-header">
                                <span className="wc-step-emoji">⏸️</span>
                                <h2 className="wc-step-title">Rest before next exercise</h2>
                                <p className="wc-step-subtitle">Recovery time after {getExerciseLabel(exerciseType)}</p>
                            </div>
                            <div className="wc-step-content">
                                <TimePicker
                                    value={restAfterBlock}
                                    onChange={(t) => updateBlock({ restAfterBlock: t })}
                                    maxMinutes={maxExerciseRestMinutes}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="wc-bottom-bar">
                    <button type="button" className="btn-primary wc-next-btn" onClick={handleBlockNext}>
                        {blockStepIndex >= blockSteps.length - 1 ? '✅ Done' : 'Next →'}
                    </button>
                </div>

                <div className="wc-footer">
                    <span className="wc-step-counter">
                        Step {blockStepIndex + 1} of {blockSteps.length}
                    </span>
                </div>
            </div>
        );
    }

    // ── Render: Block List ────────────────────────────────────────

    const totalSets = blocks.reduce((sum, b) => sum + b.numberOfSets, 0);
    const totalRepsEstimate = blocks.reduce((sum, b) => {
        if (b.sessionMode === 'reps') return sum + b.goalReps * b.numberOfSets;
        return sum;
    }, 0);
    const allReps = blocks.every(b => b.sessionMode === 'reps');

    return (
        <div className="workout-config-screen">
            <div className="wc-topbar">
                <button type="button" className="btn-icon wc-back-btn" onClick={handleTopBack} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <title>Back</title>
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="wc-topbar-title">Workout Setup</span>
                <div style={{ width: 40 }} />
            </div>

            <div className="wc-body wc-body--list">
                {/* Block cards */}
                {blocks.length === 0 && (
                    <div className="wc-empty-state">
                        <span className="wc-empty-icon">🏋️</span>
                        <p className="wc-empty-text">Add your first exercise to get started</p>
                    </div>
                )}

                {blocks.map((block, i) => {
                    const goalLabel = block.sessionMode === 'reps'
                        ? `${block.goalReps} rep${block.goalReps > 1 ? 's' : ''}`
                        : `${String(block.timeGoal.minutes).padStart(2, '0')}:${String(block.timeGoal.seconds).padStart(2, '0')}`;

                    return (
                        <div key={`${block.exerciseType}-${block.numberOfSets}-${i}`} className="wc-block-card">
                            <div className="wc-block-card-header">
                                <div className="wc-block-card-left">
                                    <span className="wc-block-num">{i + 1}</span>
                                    <div className="wc-block-info">
                                        <span className="wc-block-name">
                                            {EXERCISE_EMOJI[block.exerciseType]} {getExerciseLabel(block.exerciseType)}
                                        </span>
                                        <span className="wc-block-details">
                                            {block.numberOfSets} set{block.numberOfSets > 1 ? 's' : ''} × {goalLabel}
                                            {block.numberOfSets > 1 && ` · ${formatDuration(block.restBetweenSets)} rest`}
                                        </span>
                                    </div>
                                </div>
                                <div className="wc-block-card-actions">
                                    {blocks.length > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                className="btn-icon wc-block-action"
                                                onClick={() => handleMoveBlock(i, -1)}
                                                disabled={i === 0}
                                                aria-label="Move up"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-icon wc-block-action"
                                                onClick={() => handleMoveBlock(i, 1)}
                                                disabled={i === blocks.length - 1}
                                                aria-label="Move down"
                                            >
                                                ↓
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-icon wc-block-action"
                                        onClick={() => handleEditBlock(i)}
                                        aria-label="Edit"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-icon wc-block-action wc-block-action--danger"
                                        onClick={() => handleRemoveBlock(i)}
                                        aria-label="Remove"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                            {/* Rest after block indicator — tap to edit */}
                            {i < blocks.length - 1 && (
                                <button
                                    type="button"
                                    className="wc-block-rest-indicator wc-block-rest-indicator--btn"
                                    onClick={() => {
                                        setEditingBlockIndex(i);
                                        setBlockStep('rest-exercise');
                                        setIsAddingNew(false);
                                    }}
                                >
                                    <span className="wc-block-rest-line" />
                                    <span className="wc-block-rest-label">
                                        ⏸️ {formatDuration(block.restAfterBlock)} rest
                                    </span>
                                    <span className="wc-block-rest-line" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Add exercise button */}
                <button
                    type="button"
                    className="wc-add-block-btn"
                    onClick={handleAddBlock}
                >
                    <span className="wc-add-block-icon">+</span>
                    <span>Add Exercise</span>
                </button>

                {/* Workout summary */}
                {blocks.length > 0 && (
                    <div className="wc-workout-summary">
                        <div className="wc-workout-summary-row">
                            <span>Exercises</span>
                            <span className="wc-workout-summary-value">{blocks.length}</span>
                        </div>
                        <div className="wc-workout-summary-row">
                            <span>Total sets</span>
                            <span className="wc-workout-summary-value">{totalSets}</span>
                        </div>
                        {allReps && totalRepsEstimate > 0 && (
                            <div className="wc-workout-summary-row">
                                <span>Est. total reps</span>
                                <span className="wc-workout-summary-value wc-workout-summary-value--accent">{totalRepsEstimate}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="wc-bottom-bar">
                <button
                    type="button"
                    className="btn-primary wc-next-btn"
                    onClick={onStart}
                    disabled={!isReady || blocks.length === 0}
                >
                    {!isReady ? 'Getting Ready…' : `🚀 Start Workout`}
                </button>
            </div>
        </div>
    );
}
