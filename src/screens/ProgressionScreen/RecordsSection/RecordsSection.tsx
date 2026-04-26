import type { CSSProperties } from 'react';
import { RECORDS } from '@domain';
import type { RecordsMap } from '@domain';
import type { ExerciseType } from '@exercises/types';
import { formatElapsedTime, getGradeLetter } from '@domain';
import './RecordsSection.scss';

interface RecordsSectionProps {
    records: RecordsMap;
}

export function RecordsSection({ records }: RecordsSectionProps) {
    return (
        <section className="progression-section">
            <h3 className="progression-section-title">📊 Records</h3>
            <div className="records-grid">
                {RECORDS.map((rec, i) => {
                    const value = getRecordValue(records, rec.key);
                    return (
                        <div
                            key={rec.key}
                            className={`record-card ${value !== null ? '' : 'record-card--empty'}`}
                            style={{ '--i': i } as CSSProperties}
                        >
                            <span className="record-card-emoji">{rec.emoji}</span>
                            <span className="record-card-label">{rec.label}</span>
                            <span className="record-card-value">
                                {value !== null ? formatRecordValue(value, rec.unit) : '—'}
                            </span>
                            {value !== null && (() => {
                                const d = getRecordDate(records, rec.key);
                                return d ? (
                                    <span className="record-card-date">
                                        {new Date(d).toLocaleDateString()}
                                    </span>
                                ) : null;
                            })()}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function getRecordValue(records: RecordsMap, key: string): number | null {
    if (key.startsWith('maxRepsInSession.')) {
        const ex = key.split('.')[1] as ExerciseType;
        return records.maxRepsInSession[ex]?.value ?? null;
    }
    const rec = records[key as keyof RecordsMap];
    if (!rec) return null;
    if (typeof rec === 'object' && 'value' in rec) return rec.value;
    return null;
}

function getRecordDate(records: RecordsMap, key: string): number | null {
    if (key.startsWith('maxRepsInSession.')) {
        const ex = key.split('.')[1] as ExerciseType;
        return records.maxRepsInSession[ex]?.date ?? null;
    }
    const rec = records[key as keyof RecordsMap];
    if (!rec) return null;
    if (typeof rec === 'object' && 'date' in rec) return rec.date;
    return null;
}

function formatRecordValue(value: number, unit: string): string {
    switch (unit) {
        case 'time': return formatElapsedTime(value) || '0s';
        case 'score': {
            const grade = getGradeLetter(value);
            return `${grade} (${Math.round(value)}%)`;
        }
        case 'xp': return `${value.toLocaleString()} XP`;
        case 'days': return `${value} day${value > 1 ? 's' : ''}`;
        case 'reps': return value.toLocaleString();
        case 'count': return value.toString();
        default: return value.toString();
    }
}
