import type { ExerciseType } from '@exercises/types';
import './ExercisePicker.scss';

interface ExerciseOption {
    type: ExerciseType;
    label: string;
    emoji: string;
}

const EXERCISES: ExerciseOption[] = [
    { type: 'pushup', label: 'Push-ups', emoji: '\u{1F4AA}' },
    { type: 'squat', label: 'Squats', emoji: '\u{1F9B5}' },
];

interface ExercisePickerProps {
    value: ExerciseType;
    onChange: (type: ExerciseType) => void;
}

export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
    return (
        <div className="exercise-picker">
            {EXERCISES.map((ex) => (
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
