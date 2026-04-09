/**
 * TimePicker — reusable minutes:seconds picker with minimum-total enforcement.
 * Wraps two DragNumberPickers (min : sec) with shared clamping logic.
 */
import { DragNumberPicker } from '@components/DragNumberPicker/DragNumberPicker';
import { MIN_REST_SECONDS } from '@domain/constants';
import './TimePicker.scss';

export interface TimeValue {
    minutes: number;
    seconds: number;
}

interface TimePickerProps {
    value: TimeValue;
    onChange: (value: TimeValue) => void;
    /** Maximum allowed minutes (default 60). */
    maxMinutes?: number;
    /** Minimum total seconds allowed (default MIN_REST_SECONDS = 10). */
    minTotalSeconds?: number;
}

export function TimePicker({
    value,
    onChange,
    maxMinutes = 60,
    minTotalSeconds = MIN_REST_SECONDS,
}: TimePickerProps) {
    const minSecondsWhenZeroMin = Math.min(minTotalSeconds, 59);

    const handleMinutesChange = (m: number) => {
        let sec = m >= maxMinutes ? 0 : value.seconds;
        // When switching to 0 minutes, ensure total >= minTotalSeconds
        if (m === 0 && minTotalSeconds > 0) {
            sec = Math.max(sec, minSecondsWhenZeroMin);
        }
        onChange({ minutes: m, seconds: sec });
    };

    const handleSecondsChange = (s: number) => {
        onChange({ minutes: value.minutes, seconds: s });
    };

    const secMin = value.minutes === 0 ? minSecondsWhenZeroMin : 0;
    const secMax = value.minutes >= maxMinutes ? 0 : 59;

    return (
        <div className="time-picker-row">
            <DragNumberPicker
                value={value.minutes}
                min={0}
                max={maxMinutes}
                onChange={handleMinutesChange}
                unit="min"
                showHint={false}
            />
            <span className="time-picker-colon">:</span>
            <DragNumberPicker
                value={value.seconds}
                min={secMin}
                max={secMax}
                onChange={handleSecondsChange}
                unit="sec"
                showHint={false}
            />
        </div>
    );
}
