/**
 * PositionGuide — Manga-style push-up position image overlay.
 *
 * Shown on the camera feed when the user is not yet in a valid push-up position.
 * Positioned in the lower half of the screen below the stats.
 * Fades out automatically as soon as isValidPosition becomes true.
 */
import './PositionGuide.scss';

interface PositionGuideProps {
  isCalibrated: boolean;
  calibratingPercentage: number;
}

export function PositionGuide({ isCalibrated, calibratingPercentage }: PositionGuideProps) {
  // Guide is hidden permanently once calibrated — no flickering during reps
  const isHidden = isCalibrated;

  return (
    <div className={`position-guide ${isHidden ? 'position-guide-hidden' : ''}`}>
      <div className="position-guide-inner">
        <div className="position-guide-img-wrapper">
          <img
            src="/position-guide.png"
            alt="Neon Goku push-up guide"
            className="position-guide-img"
            draggable={false}
          />
        </div>

        {!isCalibrated ? (
          <div className="calibration-ui">
            <p className="calibration-title">CALIBRATING... HOLD PLANK</p>
            <div className="calibration-bar-track">
              <div className="calibration-bar-fill" style={{ width: `${calibratingPercentage}%` }} />
            </div>
            <p className="calibration-pct">{calibratingPercentage}%</p>
          </div>
        ) : (
          <p className="position-guide-label">MATCH THIS POSITION</p>
        )}
      </div>
    </div>
  );
}
