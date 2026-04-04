/**
 * WorkoutConfigScreen — Multi-exercise workout builder.
 *
 * Two modes:
 * 1. Block list — shows all added exercise blocks, can add/remove/reorder
 * 2. Block editor — step-by-step wizard for one block (exercise → sets → goal → rest)
 */
import { useState, useCallback, useMemo } from 'react';
import type { WorkoutPlan, WorkoutBlock } from '@exercises/types';
import { createDefaultBlock } from '@exercises/types';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { BlockCard } from './BlockCard/BlockCard';
import { BlockEditor } from './BlockEditor/BlockEditor';
import './WorkoutConfigScreen.scss';

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

    const handleEditRest = useCallback((index: number) => {
        setEditingBlockIndex(index);
        setBlockStep('rest-exercise');
        setIsAddingNew(false);
    }, []);

    // ── Block editor helpers ──────────────────────────────────────

    const editingBlock = editingBlockIndex !== null ? blocks[editingBlockIndex] : null;

    const updateBlock = useCallback((partial: Partial<WorkoutBlock>) => {
        if (editingBlockIndex === null) return;
        const newBlocks = [...blocks];
        newBlocks[editingBlockIndex] = { ...newBlocks[editingBlockIndex], ...partial };
        onPlanChange({ blocks: newBlocks });
    }, [editingBlockIndex, blocks, onPlanChange]);

    const blockSteps = useMemo(
        () => editingBlock ? getBlockSteps(editingBlock) : [],
        [editingBlock],
    );

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
        return (
            <BlockEditor
                editingBlock={editingBlock}
                editingBlockIndex={editingBlockIndex}
                isAddingNew={isAddingNew}
                blockSteps={blockSteps}
                blockStep={blockStep}
                onBack={handleBlockBack}
                onNext={handleBlockNext}
                onUpdateBlock={updateBlock}
            />
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
        <PageLayout title="Workout Setup" onClose={handleTopBack} zIndex={200} bodyClassName="wc-layout" transition="sheet">
            <div className="wc-body wc-body--list">
                {/* Block cards */}
                {blocks.length === 0 && (
                    <div className="wc-empty-state">
                        <span className="wc-empty-icon">🏋️</span>
                        <p className="wc-empty-title">No exercises yet</p>
                        <p className="wc-empty-sub">Add your first exercise to get started</p>
                    </div>
                )}

                {blocks.map((block, i) => (
                    <BlockCard
                        key={`${block.exerciseType}-${block.numberOfSets}-${i}`}
                        block={block}
                        index={i}
                        totalBlocks={blocks.length}
                        onEdit={handleEditBlock}
                        onRemove={handleRemoveBlock}
                        onMove={handleMoveBlock}
                        onEditRest={handleEditRest}
                    />
                ))}

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
                    <div className="wc-summary-divider"><span>Summary</span></div>
                )}
                {blocks.length > 0 && (
                    <div className="wc-summary-grid">
                        <div className="wc-summary-kpi wc-summary-kpi--accent">
                            <span className="wc-summary-kpi-value">{blocks.length}</span>
                            <span className="wc-summary-kpi-label">Exercises</span>
                        </div>
                        <div className="wc-summary-kpi wc-summary-kpi--indigo">
                            <span className="wc-summary-kpi-value">{totalSets}</span>
                            <span className="wc-summary-kpi-label">Total sets</span>
                        </div>
                        {allReps && totalRepsEstimate > 0 && (
                            <div className="wc-summary-kpi wc-summary-kpi--amber">
                                <span className="wc-summary-kpi-value wc-summary-kpi-value--accent">{totalRepsEstimate}</span>
                                <span className="wc-summary-kpi-label">Est. reps</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="wc-bottom-bar">
                <button
                    type="button"
                    className={`btn-primary wc-next-btn${!isReady ? ' wc-next-btn--loading' : ''}`}
                    onClick={onStart}
                    disabled={!isReady || blocks.length === 0}
                >
                    {!isReady
                        ? <><span className="wc-start-spinner" />Getting Ready…</>
                        : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></svg> Start Workout</>
                    }
                </button>
            </div>
        </PageLayout>
    );
}
