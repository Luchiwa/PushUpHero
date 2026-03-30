import { memo } from 'react';
import { getGradeLetter, getGradeColor } from '@lib/constants';
import './GradePop.scss';

export interface GradePopProps {
    score: number;
    repKey: number;
}

export const GradePop = memo(function GradePop({ score, repKey }: GradePopProps) {
    const letter = getGradeLetter(score);
    const color = getGradeColor(score);
    return (
        <div className="grade-pop" key={repKey} style={{ color }}>
            <span className="grade-letter">{letter}</span>
            <span className="grade-score">{score}</span>
        </div>
    );
});
