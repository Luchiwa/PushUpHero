import type { WorkoutCheckpoint } from '@services/workoutCheckpointStore';
import { deriveResumePosition } from '@services/workoutCheckpointStore';
import { getExerciseLabel } from '@exercises/types';
import './ResumeBanner.scss';

interface ResumeBannerProps {
    checkpoint: WorkoutCheckpoint;
    isReady: boolean;
    onResume: () => void;
    onDiscard: () => void;
}

function formatTimeAgo(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function ResumeBanner({ checkpoint, isReady, onResume, onDiscard }: ResumeBannerProps) {
    const { blockIndex } = deriveResumePosition(checkpoint.plan, checkpoint.completedSets.length);
    const currentBlock = checkpoint.plan.blocks[blockIndex];
    const totalSets = checkpoint.plan.blocks.reduce((sum, b) => sum + b.numberOfSets, 0);
    const completedCount = checkpoint.completedSets.length;
    const totalReps = checkpoint.completedSets.reduce((sum, s) => sum + s.reps, 0);
    const timeAgo = formatTimeAgo(checkpoint.savedAt);
    const exerciseLabel = getExerciseLabel(currentBlock.exerciseType);

    return (
        <div className="resume-banner">
            {/* Icon */}
            <div className="resume-banner-icon-wrap">
                <svg className="resume-banner-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
            </div>

            {/* Info */}
            <div className="resume-banner-info">
                <span className="resume-banner-title">Workout in progress</span>
                <span className="resume-banner-detail">
                    {completedCount}/{totalSets} sets · {totalReps} reps · {timeAgo}
                </span>
                <span className="resume-banner-next">
                    Next: {exerciseLabel}
                </span>
            </div>

            {/* Actions */}
            <div className="resume-banner-actions">
                <button
                    type="button"
                    className="resume-banner-btn resume-banner-btn--resume"
                    onClick={onResume}
                    disabled={!isReady}
                >
                    Resume
                </button>
                <button
                    type="button"
                    className="resume-banner-btn resume-banner-btn--discard"
                    onClick={onDiscard}
                    title="Discard workout"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
