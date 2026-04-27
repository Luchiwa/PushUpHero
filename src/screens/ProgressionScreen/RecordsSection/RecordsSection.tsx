import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RECORDS, formatDate, formatElapsedTime, formatNumber, getGradeLetter, getRecordLabel, type RecordsMap } from '@domain';
import type { ExerciseType } from '@exercises/types';
import './RecordsSection.scss';

interface RecordsSectionProps {
    records: RecordsMap;
}

export function RecordsSection({ records }: RecordsSectionProps) {
    const { t } = useTranslation('stats');
    return (
        <section className="progression-section">
            <h3 className="progression-section-title">{t('progression.section_records')}</h3>
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
                            <span className="record-card-label">{getRecordLabel(rec, t)}</span>
                            <span className="record-card-value">
                                {value !== null ? formatRecordValue(value, rec.unit, t) : '—'}
                            </span>
                            {value !== null && (() => {
                                const d = getRecordDate(records, rec.key);
                                return d ? (
                                    <span className="record-card-date">
                                        {formatDate(d)}
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

function formatRecordValue(value: number, unit: string, t: TFunction<'stats'>): string {
    switch (unit) {
        case 'time': return formatElapsedTime(value) || '0s';
        case 'score': {
            const grade = getGradeLetter(value);
            return `${grade} (${Math.round(value)}%)`;
        }
        case 'xp': return t('records.value_xp', { xp: formatNumber(value) });
        case 'days': return t('common:unit.day', { count: value });
        case 'reps': return t('common:unit.rep', { count: value });
        case 'count': return value.toString();
        default: return value.toString();
    }
}
