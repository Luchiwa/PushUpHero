import { useState, useEffect } from 'react';

interface FloatyNumbersProps {
    repCount: number;
}

interface FloatyLabel {
    id: number;
    amount: number;
}

export function FloatyNumbers({ repCount }: FloatyNumbersProps) {
    const [labels, setLabels] = useState<FloatyLabel[]>([]);
    const [prevReps, setPrevReps] = useState(repCount);

    useEffect(() => {
        if (repCount > prevReps) {
            const added = repCount - prevReps;
            const newLabel = { id: Date.now(), amount: added };
            setLabels(prev => [...prev, newLabel]);

            // Remove it after the animation ends (1000ms in CSS)
            setTimeout(() => {
                setLabels(prev => prev.filter(l => l.id !== newLabel.id));
            }, 1000);
        }
        setPrevReps(repCount);
    }, [repCount, prevReps]);

    return (
        <div className="floaty-numbers-container">
            {labels.map(l => (
                <div key={l.id} className="floaty-label">
                    +{l.amount}
                </div>
            ))}
        </div>
    );
}
