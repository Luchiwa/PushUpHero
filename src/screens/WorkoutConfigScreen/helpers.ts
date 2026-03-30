import { EXERCISE_META } from '@exercises/types';

export const EXERCISE_EMOJI: Record<string, string> = Object.fromEntries(
    EXERCISE_META.map(m => [m.type, m.emoji]),
);

export function formatDuration(d: { minutes: number; seconds: number }): string {
    if (d.minutes > 0 && d.seconds > 0) return `${d.minutes}min${d.seconds}s`;
    if (d.minutes > 0) return `${d.minutes}min`;
    return `${d.seconds}s`;
}
