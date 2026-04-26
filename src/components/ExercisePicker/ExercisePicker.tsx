import { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EXERCISE_META, getExerciseCategoryKey, getExerciseLabelKey, type ExerciseType } from '@exercises/types';
import './ExercisePicker.scss';

interface ExercisePickerProps {
    value: ExerciseType;
    onChange: (type: ExerciseType) => void;
}

// ── Infinite loop strategy ─────────────────────────────────────
// Render the items 3 times. The user always starts in the middle
// copy. When they swipe into the first or last copy, we silently
// jump them back to the equivalent position in the middle copy
// (with `behavior: 'instant'`). Visually invisible because the
// content is identical between copies.
const N = EXERCISE_META.length;
const REPEAT = 3;
const ITEMS = Array.from({ length: REPEAT }, () => EXERCISE_META).flat();
const MIDDLE_OFFSET = N; // start index of the middle copy

function realIndexOf(type: ExerciseType): number {
    return EXERCISE_META.findIndex(e => e.type === type);
}

export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
    const { t } = useTranslation();
    const viewportRef = useRef<HTMLDivElement>(null);
    const scrollEndTimer = useRef<number | null>(null);
    const totalLabel = String(N).padStart(2, '0');

    /** Scroll a clone (by global clone index) so its center matches the viewport center. */
    const scrollCloneIntoView = useCallback((cloneIdx: number, smooth: boolean) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const card = viewport.querySelector<HTMLElement>(`[data-clone-index="${cloneIdx}"]`);
        if (!card) return;
        const target = card.offsetLeft + card.offsetWidth / 2 - viewport.clientWidth / 2;
        viewport.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' });
    }, []);

    /** Find the clone of `type` whose center is closest to the current scroll center. */
    const findNearestClone = useCallback((type: ExerciseType): number => {
        const viewport = viewportRef.current;
        const realIdx = realIndexOf(type);
        if (!viewport) return MIDDLE_OFFSET + realIdx;
        const center = viewport.scrollLeft + viewport.clientWidth / 2;
        let best = MIDDLE_OFFSET + realIdx;
        let bestDist = Infinity;
        for (let copy = 0; copy < REPEAT; copy++) {
            const cloneIdx = copy * N + realIdx;
            const card = viewport.querySelector<HTMLElement>(`[data-clone-index="${cloneIdx}"]`);
            if (!card) continue;
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            const dist = Math.abs(cardCenter - center);
            if (dist < bestDist) {
                bestDist = dist;
                best = cloneIdx;
            }
        }
        return best;
    }, []);

    // ── Initial mount: jump to middle copy of the current value ──
    useLayoutEffect(() => {
        scrollCloneIntoView(MIDDLE_OFFSET + realIndexOf(value), false);
        // Run once on mount only — subsequent value changes are handled by the effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── External value change: scroll the nearest clone of `value` into view ──
    // Skipped when we're already centered on it (e.g. when the listener below
    // just set value to match the user's swipe).
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const targetClone = findNearestClone(value);
        const card = viewport.querySelector<HTMLElement>(`[data-clone-index="${targetClone}"]`);
        if (!card) return;
        const targetScroll = card.offsetLeft + card.offsetWidth / 2 - viewport.clientWidth / 2;
        if (Math.abs(viewport.scrollLeft - targetScroll) > 2) {
            scrollCloneIntoView(targetClone, true);
        }
    }, [value, findNearestClone, scrollCloneIntoView]);

    // ── Scroll listener: detect centered card, sync value, reposition at edges ──
    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const handleScroll = () => {
            if (scrollEndTimer.current !== null) {
                window.clearTimeout(scrollEndTimer.current);
            }
            scrollEndTimer.current = window.setTimeout(() => {
                scrollEndTimer.current = null;
                const center = viewport.scrollLeft + viewport.clientWidth / 2;
                const cards = viewport.querySelectorAll<HTMLElement>('.exercise-picker__card');
                let centered: HTMLElement | null = null;
                let bestDist = Infinity;
                cards.forEach((card) => {
                    const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
                    if (dist < bestDist) {
                        bestDist = dist;
                        centered = card;
                    }
                });
                if (!centered) return;
                const cloneIdx = parseInt((centered as HTMLElement).dataset.cloneIndex || '0', 10);
                const realIdx = cloneIdx % N;
                const targetType = EXERCISE_META[realIdx].type;
                if (targetType !== value) {
                    onChange(targetType);
                }
                // Silent reposition: if we landed in the first or last copy,
                // jump back to the equivalent slot in the middle copy.
                if (cloneIdx < N || cloneIdx >= 2 * N) {
                    scrollCloneIntoView(MIDDLE_OFFSET + realIdx, false);
                }
            }, 150);
        };

        viewport.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            if (scrollEndTimer.current !== null) {
                window.clearTimeout(scrollEndTimer.current);
            }
        };
    }, [value, onChange, scrollCloneIntoView]);

    return (
        <div className="exercise-picker">
            <div className="exercise-picker__viewport" ref={viewportRef}>
                {ITEMS.map((ex, cloneIndex) => {
                    const realIdx = cloneIndex % N;
                    const selected = value === ex.type;
                    const indexLabel = String(realIdx + 1).padStart(2, '0');
                    const exerciseLabel = t(getExerciseLabelKey(ex.type));
                    const categoryLabel = t(getExerciseCategoryKey(ex.type));
                    return (
                        <button
                            key={cloneIndex}
                            type="button"
                            data-clone-index={cloneIndex}
                            className={`exercise-picker__card${selected ? ' is-selected' : ''}`}
                            onClick={() => onChange(ex.type)}
                            aria-pressed={selected}
                            aria-label={`${exerciseLabel} — ${categoryLabel}`}
                        >
                            <span className="exercise-picker__bg" aria-hidden="true" />
                            <span className="exercise-picker__index" aria-hidden="true">
                                {indexLabel}<span className="exercise-picker__index-dim">/{totalLabel}</span>
                            </span>
                            <span className="exercise-picker__corner" aria-hidden="true">
                                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 6h8M6 2l4 4-4 4" />
                                </svg>
                            </span>
                            <span className="exercise-picker__emoji" aria-hidden="true">{ex.emoji}</span>
                            <span className="exercise-picker__label">{exerciseLabel}</span>
                            <span className="exercise-picker__tag">{categoryLabel}</span>
                        </button>
                    );
                })}
            </div>

            <div className="exercise-picker__dots" role="tablist" aria-label={t('common:aria.choose_exercise')}>
                {EXERCISE_META.map((ex) => {
                    const selected = value === ex.type;
                    const exerciseLabel = t(getExerciseLabelKey(ex.type));
                    return (
                        <button
                            key={ex.type}
                            type="button"
                            role="tab"
                            className={`exercise-picker__dot${selected ? ' is-active' : ''}`}
                            onClick={() => onChange(ex.type)}
                            aria-selected={selected}
                            aria-label={exerciseLabel}
                        />
                    );
                })}
            </div>
        </div>
    );
}
