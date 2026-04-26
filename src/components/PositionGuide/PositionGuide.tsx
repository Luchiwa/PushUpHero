/**
 * PositionGuide — Text-based position hint + calibration progress.
 *
 * Shown on the camera feed when the user is not yet in a valid position.
 * Fades out automatically once calibration completes.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseType } from '@exercises/types';
import { EXERCISE_REGISTRY } from '@exercises/registry';
import './PositionGuide.scss';

interface PositionGuideProps {
  exerciseType: ExerciseType;
  isCalibrated: boolean;
  calibratingPercentage: number;
}

export const PositionGuide = memo(function PositionGuide({ exerciseType, isCalibrated, calibratingPercentage }: PositionGuideProps) {
  const { t } = useTranslation('dashboard');
  const isHidden = isCalibrated;
  const guide = EXERCISE_REGISTRY[exerciseType].positionGuide;

  return (
    <div className={`position-guide${isHidden ? ' position-guide-hidden' : ''}`}>
      <div className="position-guide-card">
        <span className="position-guide-emoji" aria-hidden="true">{guide.emoji}</span>
        <p className="position-guide-title">{t(guide.titleKey)}</p>
        <p className="position-guide-desc">{t(guide.descriptionKey)}</p>

        {!isCalibrated && (
          <div className="calibration-ui" role="progressbar" aria-valuenow={calibratingPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={t('position_guide.calibration_progress_aria')}>
            <p className="calibration-title">{t(guide.calibrationKey)}</p>
            <div className="calibration-bar-track">
              <div className="calibration-bar-fill" style={{ width: `${calibratingPercentage}%` }} />
            </div>
            <p className="calibration-pct" aria-live="polite">{calibratingPercentage}%</p>
          </div>
        )}
      </div>
    </div>
  );
});
