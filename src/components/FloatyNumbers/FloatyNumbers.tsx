import { useState, useEffect, useRef, memo } from 'react';
import './FloatyNumbers.scss';

interface FloatyNumbersProps {
    repCount: number;
}

interface FloatyLabel {
    id: number;
    amount: number;
}

export const FloatyNumbers = memo(function FloatyNumbers({ repCount }: FloatyNumbersProps) {
    const [labels, setLabels] = useState<FloatyLabel[]>([]);
    const prevRepsRef = useRef(repCount);

    useEffect(() => {
        const prevReps = prevRepsRef.current;
        if (repCount > prevReps) {
            const added = repCount - prevReps;
            const newLabel = { id: Date.now(), amount: added };
            setTimeout(() => {
                setLabels(prev => [...prev, newLabel]);
                // Remove it after the animation ends (1000ms in CSS)
                setTimeout(() => {
                    setLabels(prev => prev.filter(l => l.id !== newLabel.id));
                }, 1000);
            }, 0);
        }
        prevRepsRef.current = repCount;
    }, [repCount]);

    return (
        <div className="floaty-numbers-container">
            {labels.map(l => (
                <div key={l.id} className="floaty-label">
                    +{l.amount}
                </div>
            ))}
        </div>
    );
});
