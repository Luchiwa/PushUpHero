import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { deriveResumePosition, type WorkoutCheckpoint } from '@services/workoutCheckpointStore';
import { getExerciseLabelKey } from '@exercises/types';
import './ResumeBanner.scss';

interface ResumeBannerProps {
    checkpoint: WorkoutCheckpoint;
    onResume: () => void;
    onDiscard: () => void;
}

function formatTimeAgo(timestamp: number, t: TFunction<'start'>): string {
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return t('resume.ago_just_now');
    if (mins < 60) return t('resume.ago_minutes', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('resume.ago_hours', { count: hours });
    const days = Math.floor(hours / 24);
    return t('resume.ago_days', { count: days });
}

export function ResumeBanner({ checkpoint, onResume, onDiscard }: ResumeBannerProps) {
    const { t } = useTranslation('start');
    const { blockIndex } = deriveResumePosition(checkpoint.plan, checkpoint.completedSets.length);
    const currentBlock = checkpoint.plan.blocks[blockIndex];
    const totalSets = checkpoint.plan.blocks.reduce((sum, b) => sum + b.numberOfSets, 0);
    const completedCount = checkpoint.completedSets.length;
    const totalReps = checkpoint.completedSets.reduce((sum, s) => sum + s.reps, 0);
    const timeAgo = formatTimeAgo(checkpoint.savedAt, t);
    const exerciseLabel = t(getExerciseLabelKey(currentBlock.exerciseType));

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
                <span className="resume-banner-title">{t('resume.title')}</span>
                <span className="resume-banner-detail">
                    {t('resume.detail', { completed: completedCount, total: totalSets, reps: totalReps, ago: timeAgo })}
                </span>
                <span className="resume-banner-next">
                    {t('resume.next', { exercise: exerciseLabel })}
                </span>
            </div>

            {/* Actions */}
            <div className="resume-banner-actions">
                <button
                    type="button"
                    className="resume-banner-btn resume-banner-btn--resume"
                    onClick={onResume}
                >
                    {t('resume.btn_resume')}
                </button>
                <button
                    type="button"
                    className="resume-banner-btn resume-banner-btn--discard"
                    onClick={onDiscard}
                    title={t('resume.btn_discard_aria')}
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
