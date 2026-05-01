/**
 * WorkoutConfigScreen — Multi-exercise workout builder.
 *
 * Two modes:
 * 1. Block list — shows all added exercise blocks, can add/remove/reorder
 * 2. Block editor — step-by-step wizard for one block (exercise → sets → goal → rest)
 */
import { lazy, Suspense, useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { createDefaultBlock, type WorkoutBlock, type WorkoutPlan } from '@exercises/types';
import { estimatePlanXpBaseline, formatNumber, getTotalSets } from '@domain';
import { useAuthCore } from '@hooks/useAuth';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import { ModalFallback } from '@components/ModalFallback/ModalFallback';
import { BlockCard } from './BlockCard/BlockCard';
import { BlockEditor } from './BlockEditor/BlockEditor';
import './WorkoutConfigScreen.scss';

// Lazy: only parsed when the user opens the saved workouts overlay.
const SavedWorkoutsScreen = lazy(() =>
    import('@screens/SavedWorkoutsScreen/SavedWorkoutsScreen').then(m => ({ default: m.SavedWorkoutsScreen })),
);

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

const KPI_COLOR = {
    ember: 'var(--ember)',
    ice: 'var(--ice)',
    gold: 'var(--gold)',
};

// ── Component ────────────────────────────────────────────────────

export function WorkoutConfigScreen({
    plan,
    onPlanChange,
    onStart,
    onBack,
    isReady,
}: WorkoutConfigScreenProps) {
    const { t } = useTranslation('workout');
    const { user } = useAuthCore();
    // null = block list mode, number = editing block at that index
    const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
    const [blockStep, setBlockStep] = useState<BlockStep>('exercise');
    // Track if we're adding a new block (vs editing existing)
    const [isAddingNew, setIsAddingNew] = useState(false);
    // Saved workouts overlay (auth-only). Entry point will move to ProfileScreen in PUS-22.
    const [loadOpen, setLoadOpen] = useState(false);

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

    // ── Summary KPIs (block-list mode) ────────────────────────────

    const totalSets = useMemo(() => getTotalSets({ blocks }), [blocks]);
    const { baselineXp, isPartial } = useMemo(
        () => estimatePlanXpBaseline({ blocks }),
        [blocks],
    );

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

    return (
        <>
        <PageLayout title={t('config.title')} onClose={handleTopBack} zIndex={200} bodyClassName="wc-layout" transition="sheet">
            <div className="wc-body wc-body--list">
                {/* Saved workouts entry point (auth-only). */}
                {user && (
                    <button
                        type="button"
                        className="wc-load-saved-btn"
                        onClick={() => setLoadOpen(true)}
                    >
                        <span>{t('config.load_saved')}</span>
                    </button>
                )}

                {/* Block cards */}
                {blocks.length === 0 && (
                    <div className="wc-empty-state">
                        <span className="wc-empty-icon">🏋️</span>
                        <p className="wc-empty-title">{t('config.empty_title')}</p>
                        <p className="wc-empty-sub">{t('config.empty_sub')}</p>
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
                    <span>{t('config.add_exercise')}</span>
                </button>

                {/* Workout summary */}
                {blocks.length > 0 && (
                    <div className="wc-summary-divider"><span>{t('config.summary_divider')}</span></div>
                )}
                {blocks.length > 0 && (
                    <>
                        <div className="wc-summary-grid">
                            <div className="wc-summary-kpi" style={{ '--kpi-color': KPI_COLOR.ember } as CSSProperties}>
                                <span className="wc-summary-kpi-value">{blocks.length}</span>
                                <span className="wc-summary-kpi-label">{t('config.kpi_exercises')}</span>
                            </div>
                            <div className="wc-summary-kpi" style={{ '--kpi-color': KPI_COLOR.ice } as CSSProperties}>
                                <span className="wc-summary-kpi-value">{totalSets}</span>
                                <span className="wc-summary-kpi-label">{t('config.kpi_total_sets')}</span>
                            </div>
                            <div
                                className="wc-summary-kpi wc-summary-kpi--xp"
                                style={{ '--kpi-color': KPI_COLOR.gold } as CSSProperties}
                                aria-label={t('config.kpi_baseline_xp_aria', { xp: baselineXp })}
                            >
                                <span className="wc-summary-kpi-value">
                                    {formatNumber(baselineXp)}
                                    {isPartial && <span aria-hidden="true">*</span>}
                                </span>
                                <span className="wc-summary-kpi-label">{t('config.kpi_baseline_xp')}</span>
                            </div>
                        </div>
                        {isPartial && (
                            <p className="wc-summary-xp-partial-note">{t('config.kpi_xp_partial_note')}</p>
                        )}
                    </>
                )}
            </div>

            <div className="wc-bottom-bar">
                <PrimaryCTA
                    variant="solid"
                    size="lg"
                    block
                    icon={!isReady
                        ? <span className="wc-start-spinner" />
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></svg>}
                    onClick={onStart}
                    disabled={!isReady || blocks.length === 0}
                >
                    {!isReady ? t('config.getting_ready') : t('config.start_workout')}
                </PrimaryCTA>
            </div>
        </PageLayout>
        <Suspense fallback={<ModalFallback />}>
            {loadOpen && user && (
                <SavedWorkoutsScreen
                    uid={user.uid}
                    onClose={() => setLoadOpen(false)}
                    onPick={(plan) => {
                        onPlanChange(plan);
                        setLoadOpen(false);
                    }}
                />
            )}
        </Suspense>
        </>
    );
}
