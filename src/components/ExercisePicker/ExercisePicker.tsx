import { useRef, useEffect } from 'react';
import type { ExerciseType } from '@exercises/types';
import { EXERCISE_META } from '@exercises/types';
import './ExercisePicker.scss';

interface ExercisePickerProps {
    value: ExerciseType;
    onChange: (type: ExerciseType) => void;
}

export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the selected card when selection changes
    const prevValue = useRef(value);
    useEffect(() => {
        if (prevValue.current === value) return;
        prevValue.current = value;
        const container = scrollRef.current;
        if (!container) return;
        const selected = container.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (selected) {
            selected.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });

    return (
        <div className="exercise-picker" ref={scrollRef}>
            {EXERCISE_META.map((ex) => (
                <button
                    key={ex.type}
                    type="button"
                    className={`exercise-picker-card${value === ex.type ? ' exercise-picker-card--selected' : ''}`}
                    onClick={() => onChange(ex.type)}
                    aria-pressed={value === ex.type}
                >
                    <span className="exercise-picker-emoji">{ex.emoji}</span>
                    <span className="exercise-picker-label">{ex.label}</span>
                </button>
            ))}
        </div>
    );
}
