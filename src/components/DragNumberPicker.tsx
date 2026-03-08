import { useRef, useState, useCallback } from 'react';

interface DragNumberPickerProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}

/**
 * A drag/swipe number picker.
 * Drag UP to increase, drag DOWN to decrease.
 * Works with both mouse and touch events.
 */
export function DragNumberPicker({
    value,
    min = 1,
    max = 100,
    onChange,
}: DragNumberPickerProps) {
    const startYRef = useRef<number | null>(null);
    const startValueRef = useRef<number>(value);
    const [isDragging, setIsDragging] = useState(false);

    // px of drag required to change by 1 unit
    const PX_PER_UNIT = 8;

    const onDragStart = useCallback((clientY: number) => {
        startYRef.current = clientY;
        startValueRef.current = value;
        setIsDragging(true);
    }, [value]);

    const onDragMove = useCallback((clientY: number) => {
        if (startYRef.current === null) return;
        const dy = startYRef.current - clientY; // positive = dragged up = increase
        const delta = Math.round(dy / PX_PER_UNIT);
        const newVal = Math.min(max, Math.max(min, startValueRef.current + delta));
        onChange(newVal);
    }, [min, max, onChange]);

    const onDragEnd = useCallback(() => {
        startYRef.current = null;
        setIsDragging(false);
    }, []);

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        onDragStart(e.clientY);

        const handleMouseMove = (ev: MouseEvent) => onDragMove(ev.clientY);
        const handleMouseUp = () => {
            onDragEnd();
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        onDragStart(e.touches[0].clientY);
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        onDragMove(e.touches[0].clientY);
    };
    const handleTouchEnd = () => onDragEnd();

    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div
            className={`drag-picker ${isDragging ? 'drag-picker-active' : ''}`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="drag-picker-track">
                <div className="drag-picker-fill" style={{ height: `${percentage}%` }} />
            </div>

            <div className="drag-picker-content">
                <button
                    className="drag-picker-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onChange(Math.min(max, value + 1))}
                >▲</button>

                <div className="drag-picker-value">
                    <span className="drag-picker-number">{value}</span>
                    <span className="drag-picker-unit">reps</span>
                </div>

                <button
                    className="drag-picker-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onChange(Math.max(min, value - 1))}
                >▼</button>
            </div>

            <p className="drag-picker-hint">
                {isDragging ? '🎯 Release to confirm' : '↕ Drag or tap ▲▼'}
            </p>
        </div>
    );
}
