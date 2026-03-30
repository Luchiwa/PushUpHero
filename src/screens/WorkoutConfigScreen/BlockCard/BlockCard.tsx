import { getExerciseLabel } from '@exercises/types';
import type { WorkoutBlock } from '@exercises/types';
import { EXERCISE_EMOJI, formatDuration } from '../helpers';
import './BlockCard.scss';

interface BlockCardProps {
    block: WorkoutBlock;
    index: number;
    totalBlocks: number;
    onEdit: (index: number) => void;
    onRemove: (index: number) => void;
    onMove: (index: number, direction: -1 | 1) => void;
    onEditRest: (index: number) => void;
}

export function BlockCard({ block, index, totalBlocks, onEdit, onRemove, onMove, onEditRest }: BlockCardProps) {
    const goalLabel = block.sessionMode === 'reps'
        ? `${block.goalReps} rep${block.goalReps > 1 ? 's' : ''}`
        : `${String(block.timeGoal.minutes).padStart(2, '0')}:${String(block.timeGoal.seconds).padStart(2, '0')}`;

    return (
        <div
            key={`${block.exerciseType}-${block.numberOfSets}-${index}`}
            className="wc-block-card"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div className="wc-block-card-header">
                <div className="wc-block-card-left">
                    <span className="wc-block-num">{index + 1}</span>
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
                    {totalBlocks > 1 && (
                        <>
                            <button
                                type="button"
                                className="wc-block-action"
                                onClick={() => onMove(index, -1)}
                                disabled={index === 0}
                                aria-label="Move up"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                            </button>
                            <button
                                type="button"
                                className="wc-block-action"
                                onClick={() => onMove(index, 1)}
                                disabled={index === totalBlocks - 1}
                                aria-label="Move down"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        className="wc-block-action"
                        onClick={() => onEdit(index)}
                        aria-label="Edit"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button
                        type="button"
                        className="wc-block-action wc-block-action--danger"
                        onClick={() => onRemove(index)}
                        aria-label="Remove"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </button>
                </div>
            </div>
            {/* Rest after block indicator — tap to edit */}
            {index < totalBlocks - 1 && (
                <button
                    type="button"
                    className="wc-block-rest-indicator wc-block-rest-indicator--btn"
                    onClick={() => onEditRest(index)}
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
}
