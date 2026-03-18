/**
 * PositionGuide — Text-based position hint + calibration progress.
 *
 * Shown on the camera feed when the user is not yet in a valid position.
 * Fades out automatically once calibration completes.
 */
import type { ExerciseType } from '@exercises/types';
import './PositionGuide.scss';

interface PositionGuideProps {
  exerciseType: ExerciseType;
  isCalibrated: boolean;
  calibratingPercentage: number;
}

const GUIDE_CONFIG: Record<ExerciseType, { emoji: string; title: string; description: string; calibrationText: string }> = {
  pushup: {
    emoji: '🧑‍💻',
    title: 'Get in plank position',
    description: 'Place your phone so the camera can see your full body in push-up stance.',
    calibrationText: 'Hold plank…',
  },
  squat: {
    emoji: '🦵',
    title: 'Stand facing the camera',
    description: 'Step back so your full body is visible from head to feet.',
    calibrationText: 'Stand still…',
  },
};

export function PositionGuide({ exerciseType, isCalibrated, calibratingPercentage }: PositionGuideProps) {
  const isHidden = isCalibrated;
  const guide = GUIDE_CONFIG[exerciseType];

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
}
