/**
 * PositionGuide — Text-based position hint + calibration progress.
 *
 * Shown on the camera feed when the user is not yet in a valid position.
 * Fades out automatically once calibration completes.
 */
import { memo } from 'react';
import type { ExerciseType } from '@exercises/types';
import { EXERCISE_REGISTRY } from '@exercises/registry';
import './PositionGuide.scss';

interface PositionGuideProps {
  exerciseType: ExerciseType;
  isCalibrated: boolean;
  calibratingPercentage: number;
}

export const PositionGuide = memo(function PositionGuide({ exerciseType, isCalibrated, calibratingPercentage }: PositionGuideProps) {
  const isHidden = isCalibrated;
  const guide = EXERCISE_REGISTRY[exerciseType].positionGuide;

  return (
    <div className={`position-guide${isHidden ? ' position-guide-hidden' : ''}`}>
      <div className="position-guide-card">
        <span className="position-guide-emoji">{guide.emoji}</span>
        <p className="position-guide-title">{guide.title}</p>
        <p className="position-guide-desc">{guide.description}</p>

        {!isCalibrated && (
          <div className="calibration-ui">
            <p className="calibration-title">{guide.calibrationText}</p>
            <div className="calibration-bar-track">
              <div className="calibration-bar-fill" style={{ width: `${calibratingPercentage}%` }} />
            </div>
            <p className="calibration-pct">{calibratingPercentage}%</p>
          </div>
        )}
      </div>
    </div>
  );
});
