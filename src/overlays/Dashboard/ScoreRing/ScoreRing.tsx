import { memo } from 'react';
import { getGradeColor } from '@domain';
import './ScoreRing.scss';

export interface ScoreRingProps {
    score: number;
}

export const ScoreRing = memo(function ScoreRing({ score }: ScoreRingProps) {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getGradeColor(score);

    return (
        <svg className="score-ring" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
            <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle
                cx="22" cy="22" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
            />
            <text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="900" fill="white">
                {score}
            </text>
        </svg>
    );
});
