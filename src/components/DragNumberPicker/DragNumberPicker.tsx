import { useRef, useState, useCallback, useEffect } from 'react';
import './DragNumberPicker.scss';

interface DragNumberPickerProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
    unit?: string;
    showHint?: boolean;
}

// ── Layout constants ───────────────────────────────────────────
// Keep ITEM_HEIGHT in sync with the matching `.drag-picker__item`
// height in DragNumberPicker.scss. The SCSS owns the viewport
// dimensions (220px desktop, 180px mobile) and derives the
// padding-top from `(viewport - item) / 2`.
const ITEM_HEIGHT = 44;
const TAP_THRESHOLD = 5;            // px of motion before a press counts as a drag
const HOLD_DELAY = 400;             // ms before hold-to-repeat kicks in
const HOLD_INTERVAL = 80;           // ms between repeated steps

/**
 * Slot-wheel number picker (iOS-style).
 *
 * Interactions:
 * - Drag vertically — wheel rolls 1:1 with the finger; value updates as it
 *   crosses each row. Drag UP to increase, DOWN to decrease.
 * - Tap above the centered value → +1, tap below → -1. Hold to repeat.
 * - Mouse wheel — scroll up to increase, down to decrease.
 * - Keyboard — Arrow / Page / Home / End.
 */
export function DragNumberPicker({
    value,
    min = 1,
    max = 100,
    onChange,
    unit = 'reps',
    showHint = true,
}: DragNumberPickerProps) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const startYRef = useRef<number | null>(null);
    const startValueRef = useRef<number>(value);
    const wasDraggedRef = useRef(false);
    const tapDirectionRef = useRef<0 | 1 | -1>(0);
    const holdFiredRef = useRef(false);
    const valueRef = useRef(value);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isDragMotion, setIsDragMotion] = useState(false);
    const [dragDeltaPx, setDragDeltaPx] = useState(0);

    useEffect(() => { valueRef.current = value; }, [value]);

    const itemCount = Math.max(0, max - min + 1);
    const items = Array.from({ length: itemCount }, (_, i) => min + i);

    // Wheel translation: align value with viewport center, plus the residual
    // pixel offset from the in-flight drag (so the wheel follows the finger
    // continuously rather than snapping per row).
    const baseTranslate = -((value - min) * ITEM_HEIGHT);
    const wheelTranslate = baseTranslate + dragDeltaPx;

    // ── Hold-to-repeat ─────────────────────────────────────────
    const stopHold = useCallback(() => {
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        holdTimeoutRef.current = null;
        holdIntervalRef.current = null;
    }, []);

    const startHold = useCallback((direction: 1 | -1) => {
        stopHold();
        holdFiredRef.current = false;
        holdTimeoutRef.current = setTimeout(() => {
            holdFiredRef.current = true;
            holdIntervalRef.current = setInterval(() => {
                const next = Math.min(max, Math.max(min, valueRef.current + direction));
                if (next !== valueRef.current) {
                    valueRef.current = next; // optimistic — drives the next tick
                    onChange(next);
                }
            }, HOLD_INTERVAL);
        }, HOLD_DELAY);
    }, [min, max, onChange, stopHold]);

    useEffect(() => () => stopHold(), [stopHold]);

    // ── Pointer lifecycle (mouse + touch share these) ──────────
    const onPointerDown = useCallback((clientY: number) => {
        startYRef.current = clientY;
        startValueRef.current = value;
        wasDraggedRef.current = false;
        holdFiredRef.current = false;
        setIsDragMotion(false);
        setDragDeltaPx(0);

        // Decide which tap zone the press landed in. The center band is the
        // spotlight — pressing it does nothing (only drag).
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
            const tapY = clientY - rect.top;
            const center = rect.height / 2;
            if (tapY < center - ITEM_HEIGHT / 2) tapDirectionRef.current = 1;
            else if (tapY > center + ITEM_HEIGHT / 2) tapDirectionRef.current = -1;
            else tapDirectionRef.current = 0;
        }

        if (tapDirectionRef.current !== 0) {
            startHold(tapDirectionRef.current);
        }
    }, [value, startHold]);

    const onPointerMove = useCallback((clientY: number) => {
        if (startYRef.current === null) return;
        const dy = startYRef.current - clientY; // up = positive = increase
        if (!wasDraggedRef.current && Math.abs(dy) > TAP_THRESHOLD) {
            wasDraggedRef.current = true;
            setIsDragMotion(true);
            stopHold(); // dragging cancels any pending hold-to-repeat
        }
        if (!wasDraggedRef.current) return;
        const unitDelta = Math.round(dy / ITEM_HEIGHT);
        const target = Math.min(max, Math.max(min, startValueRef.current + unitDelta));
        const consumedDelta = target - startValueRef.current;
        // Visual residual = total finger displacement minus the chunks already
        // committed to value changes. Clamped near a row so we don't overshoot
        // when at the bounds.
        const residual = dy - consumedDelta * ITEM_HEIGHT;
        const maxResidual = ITEM_HEIGHT * 0.8;
        setDragDeltaPx(Math.max(-maxResidual, Math.min(maxResidual, residual)));
        if (target !== valueRef.current) {
            onChange(target);
        }
    }, [min, max, onChange, stopHold]);

    const onPointerUp = useCallback(() => {
        const wasDragged = wasDraggedRef.current;
        const tapDir = tapDirectionRef.current;
        const holdFired = holdFiredRef.current;
        stopHold();
        startYRef.current = null;
        wasDraggedRef.current = false;
        tapDirectionRef.current = 0;
        holdFiredRef.current = false;
        setIsDragMotion(false);
        setDragDeltaPx(0);

        // Tap (no drag, no hold-repeat fired) — single-step ±1
        if (!wasDragged && !holdFired && tapDir !== 0) {
            const next = Math.min(max, Math.max(min, valueRef.current + tapDir));
            if (next !== valueRef.current) onChange(next);
        }
    }, [min, max, onChange, stopHold]);

    // ── DOM event wiring ───────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        onPointerDown(e.clientY);
        const move = (ev: MouseEvent) => onPointerMove(ev.clientY);
        const up = () => {
            onPointerUp();
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        onPointerDown(e.touches[0].clientY);
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        onPointerMove(e.touches[0].clientY);
    };
    const handleTouchEnd = () => onPointerUp();
    const handleTouchCancel = () => onPointerUp();

    // Mouse wheel (desktop bonus)
    const handleWheel = (e: React.WheelEvent) => {
        const dir = e.deltaY > 0 ? -1 : 1;
        const next = Math.min(max, Math.max(min, value + dir));
        if (next !== value) onChange(next);
    };

    // Keyboard
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        let next: number | null = null;
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowRight': next = Math.min(max, value + 1); break;
            case 'ArrowDown':
            case 'ArrowLeft': next = Math.max(min, value - 1); break;
            case 'PageUp': next = Math.min(max, value + 10); break;
            case 'PageDown': next = Math.max(min, value - 10); break;
            case 'Home': next = min; break;
            case 'End': next = max; break;
            default: return;
        }
        e.preventDefault();
        if (next !== null && next !== value) onChange(next);
    }, [value, min, max, onChange]);

    return (
        <div className={`drag-picker${isDragMotion ? ' is-dragging' : ''}`}>
            <div
                ref={viewportRef}
                className="drag-picker__viewport"
                role="slider"
                tabIndex={0}
                aria-valuenow={value}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-label={`${unit} picker`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                onWheel={handleWheel}
                onKeyDown={handleKeyDown}
            >
                <div className="drag-picker__spotlight" aria-hidden="true" />
                <div
                    className="drag-picker__wheel"
                    style={{ transform: `translate3d(0, ${wheelTranslate}px, 0)` }}
                >
                    {items.map((v) => (
                        <div
                            key={v}
                            className={`drag-picker__item${v === value ? ' is-current' : ''}`}
                            aria-hidden={v !== value}
                        >
                            {String(v).padStart(2, '0')}
                        </div>
                    ))}
                </div>
            </div>
            <span className="drag-picker__unit" aria-hidden="true">{unit}</span>
            {showHint && (
                <p className="drag-picker__hint">
                    {isDragMotion ? 'Release to confirm' : 'Drag, tap or scroll'}
                </p>
            )}
        </div>
    );
}
