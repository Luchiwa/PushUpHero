import { useRef, useState, useCallback, useEffect } from 'react';
import './DragNumberPicker.scss';

interface DragNumberPickerProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
    unit?: string;
    showTrack?: boolean;
    showHint?: boolean;
}

/**
 * A drag/swipe number picker.
 * Drag UP to increase, drag DOWN to decrease.
 * Works with both mouse and touch events.
 * Hold ▲▼ buttons to continuously increment/decrement.
 */
export function DragNumberPicker({
    value,
    min = 1,
    max = 100,
    onChange,
    unit = 'reps',
    showTrack = true,
    showHint = true,
}: DragNumberPickerProps) {
    const startYRef = useRef<number | null>(null);
    const startValueRef = useRef<number>(value);
    const [isDragging, setIsDragging] = useState(false);
    const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Keep a ref to current value for use inside intervals
    const valueRef = useRef(value);
    useEffect(() => { valueRef.current = value; }, [value]);

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

    // Hold-to-repeat logic
    const startHold = useCallback((direction: 1 | -1) => {
        const step = () => {
            const newVal = Math.min(max, Math.max(min, valueRef.current + direction));
            onChange(newVal);
        };
        // First tick immediately, then accelerate after 400ms
        step();
        holdTimeoutRef.current = setTimeout(() => {
            holdIntervalRef.current = setInterval(step, 80);
        }, 400);
    }, [min, max, onChange]);

    const stopHold = useCallback(() => {
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        holdTimeoutRef.current = null;
        holdIntervalRef.current = null;
    }, []);

    // Mouse events (main drag area)
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

    // Touch events (main drag area)
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
            {showTrack && (
                <div className="drag-picker-track">
                    <div className="drag-picker-fill" style={{ height: `${percentage}%` }} />
                </div>
            )}

            <div className="drag-picker-content">
                <button
                    className="drag-picker-btn"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startHold(1); }}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={(e) => { e.stopPropagation(); startHold(1); }}
                    onTouchEnd={stopHold}
                >▲</button>

                <div className="drag-picker-value">
                    <span className="drag-picker-number">{String(value).padStart(2, '0')}</span>
                    <span className="drag-picker-unit">{unit}</span>
                </div>

                <button
                    className="drag-picker-btn"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startHold(-1); }}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={(e) => { e.stopPropagation(); startHold(-1); }}
                    onTouchEnd={stopHold}
                >▼</button>
            </div>

            {showHint && (
                <p className="drag-picker-hint">
                    {isDragging ? '🎯 Release to confirm' : '↕ Drag or tap ▲▼'}
                </p>
            )}
        </div>
    );
}
