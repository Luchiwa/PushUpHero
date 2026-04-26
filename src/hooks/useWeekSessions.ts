import { useState, useRef } from 'react';
import { useAuthCore } from './useAuth';
import { getSessionsByDateRange, getOldestSessionDate } from '@data/sessionRepository';
import { formatDate } from '@domain';
import type { SessionRecord } from '@exercises/types';

/** Returns the Sunday 00:00:00.000 local time for a given weekOffset (0 = current week). */
export function getWeekStart(weekOffset: number): Date {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    sunday.setDate(sunday.getDate() + weekOffset * 7);
    return sunday;
}

/** Returns the Saturday 23:59:59.999 local time for a given weekOffset. */
export function getWeekEnd(weekOffset: number): Date {
    const start = getWeekStart(weekOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return end;
}

/** Format "Mar 9 – Mar 15, 2026" for a week (locale-aware). */
export function formatWeekRange(weekOffset: number): string {
    const start = getWeekStart(weekOffset);
    const end = getWeekEnd(weekOffset);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    const startStr = formatDate(start, opts);
    const endStr = formatDate(end, opts);
    const year = end.getFullYear();
    return `${startStr} – ${endStr}, ${year}`;
}

export interface UseWeekSessionsReturn {
    sessions: SessionRecord[];
    prevSessions: SessionRecord[];     // previous week (weekOffset - 1) for comparison
    loading: boolean;
    firstSessionDate: number | null;   // ms timestamp of the oldest session ever
    fetchWeek: (weekOffset: number) => Promise<void>;
}

export function useWeekSessions(): UseWeekSessionsReturn {
    const { user } = useAuthCore();
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [prevSessions, setPrevSessions] = useState<SessionRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [firstSessionDate, setFirstSessionDate] = useState<number | null>(null);

    // Cache: weekOffset (number) → sessions array
    const cache = useRef<Map<number, SessionRecord[]>>(new Map());
    // Whether we've already fetched the oldest session
    const firstFetched = useRef(false);

    const fetchWeek = async (weekOffset: number) => {
        if (!user) return;

        // Serve from cache if available
        if (cache.current.has(weekOffset)) {
            setSessions(cache.current.get(weekOffset) ?? []);
            // Also serve prev week from cache for comparison
            const prevOffset = weekOffset - 1;
            if (cache.current.has(prevOffset)) {
                setPrevSessions(cache.current.get(prevOffset) ?? []);
            }
            return;
        }

        setLoading(true);

        // Fetch oldest session once to know how far back we can navigate
        if (!firstFetched.current) {
            firstFetched.current = true;
            getOldestSessionDate(user.uid)
                .then(date => { if (date !== null) setFirstSessionDate(date); })
                .catch(() => { /* non-critical */ });
        }

        const start = getWeekStart(weekOffset).getTime();
        const end = getWeekEnd(weekOffset).getTime();

        try {
            const result = await getSessionsByDateRange(user.uid, start, end);
            cache.current.set(weekOffset, result);
            setSessions(result);
        } catch (err) {
            console.error('[useWeekSessions] fetch error:', err);
            setSessions([]);
        } finally {
            setLoading(false);
        }

        // Also fetch previous week for comparison (non-blocking)
        const prevOffset = weekOffset - 1;
        if (cache.current.has(prevOffset)) {
            setPrevSessions(cache.current.get(prevOffset) ?? []);
        } else {
            try {
                const prevStart = getWeekStart(prevOffset).getTime();
                const prevEnd = getWeekEnd(prevOffset).getTime();
                const prevResult = await getSessionsByDateRange(user.uid, prevStart, prevEnd);
                cache.current.set(prevOffset, prevResult);
                setPrevSessions(prevResult);
            } catch {
                setPrevSessions([]);
            }
        }
    };

    return { sessions, prevSessions, loading, firstSessionDate, fetchWeek };
}
