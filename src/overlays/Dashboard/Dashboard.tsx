import { memo, useEffect, useRef, useState } from 'react';
import './Dashboard.scss';
import type { ExerciseState, ExerciseType } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';
import { getGradeLetter, getGradeColor } from '@lib/constants';
import { useDashboardLogic } from './useDashboardLogic';

import { FloatyNumbers } from '@components/FloatyNumbers/FloatyNumbers';

interface DashboardProps {
    exerciseType: ExerciseType;
    exerciseState: ExerciseState;
    goalReps: number;
    sessionMode: 'reps' | 'time';
    timeGoal: { minutes: number; seconds: number };
    onStop: () => void;
    onTimerEnd: () => void;
    elapsedTimeRef?: React.MutableRefObject<number>;
    onFlipCamera: () => void;
    facingMode: 'user' | 'environment';
    soundEnabled: boolean;
    onSoundToggle: () => void;
    level: number;
    levelProgressPct: number;
    currentSet?: number;
    totalSets?: number;
    currentBlock?: number;
    totalBlocks?: number;
}

// ── Grade Pop — big letter that appears after each rep ───────────
const GradePop = memo(function GradePop({ score, repKey }: { score: number; repKey: number }) {
    const letter = getGradeLetter(score);
    const color = getGradeColor(score);
    return (
        <div className="grade-pop" key={repKey} style={{ color }}>
            <span className="grade-letter">{letter}</span>
            <span className="grade-score">{score}</span>
        </div>
    );
});

// ── Combo counter ────────────────────────────────────────────────
const ComboCounter = memo(function ComboCounter({ combo }: { combo: number }) {
    if (combo < 2) return null;
    return (
        <div className="combo-badge" key={combo}>
            <span className="combo-count">{combo}×</span>
            <span className="combo-label">COMBO</span>
        </div>
    );
});

// ── Small inline score ring ──────────────────────────────────────
const ScoreRing = memo(function ScoreRing({ score }: { score: number }) {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getGradeColor(score);

    return (
        <svg className="score-ring" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
            <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle
                cx="22" cy="22" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
            />
            <text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="900" fill="white">
                {score}
            </text>
        </svg>
    );
});

// ── Coach hint display ───────────────────────────────────────────
function CoachHint({ text }: { text: string | null }) {
    const [visible, setVisible] = useState(false);
    const [displayText, setDisplayText] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (text) {
            setDisplayText(text);
            setVisible(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setVisible(false), 3000);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [text]);

    if (!visible || !displayText) return null;
    return (
        <div className="coach-hint">
            <span className="coach-icon">🎙️</span>
            <span className="coach-text">{displayText}</span>
        </div>
    );
}

export const Dashboard = memo(function Dashboard({ exerciseType, exerciseState, goalReps, sessionMode, timeGoal, onStop, onTimerEnd, elapsedTimeRef, onFlipCamera, facingMode, soundEnabled, onSoundToggle, currentSet, totalSets, currentBlock, totalBlocks }: DashboardProps) {
    const { repCount, averageScore, lastRepResult, isValidPosition, isCalibrated, incompleteRepFeedback } = exerciseState;

    const { showInvalidBanner, timeRemaining, coachPhrase } = useDashboardLogic({
        exerciseType,
        repCount,
        isCalibrated,
        isValidPosition,
        soundEnabled,
        sessionMode,
        timeGoal,
        elapsedTimeRef,
        onTimerEnd,
        lastRepResult,
        incompleteRepFeedback,
    });

    // Combo: count consecutive reps with score >= 60 (B or above)
    const comboRef = useRef(0);
    const [combo, setCombo] = useState(0);

    useEffect(() => {
        if (lastRepResult) {
            if (lastRepResult.score >= 60) {
                comboRef.current++;
            } else {
                comboRef.current = 0;
            }
            setCombo(comboRef.current);
        }
    }, [lastRepResult]);

    // Goal progress for reps mode
    const goalPct = sessionMode === 'reps' ? Math.min(100, (repCount / goalReps) * 100) : 0;
    const goalDone = repCount >= goalReps;

    return (
        <div className="dashboard">
            {/* ══════════ TOP ROW ══════════ */}
            <div className="dashboard-top">
                {/* ── Left: rep counter + avg score ── */}
                <div className="hud-left">
                    <div className="hud-rep-block">
                        <FloatyNumbers repCount={repCount} />
                        <span className="hud-rep-count">{repCount}</span>
                        <span className="hud-rep-label">{getExerciseLabel(exerciseType)}</span>
                    </div>

                    {isCalibrated && (
                        <div className="hud-avg">
                            <ScoreRing score={averageScore} />
                            <span className="hud-avg-label">AVG</span>
                        </div>
                    )}
                </div>

                {/* ── Right: actions + goal/timer ── */}
                <div className="hud-right">
                    {/* Set indicator */}
                    {totalSets != null && totalSets > 1 && currentSet != null && (
                        <span className="set-indicator">
                            {currentBlock != null && totalBlocks != null && totalBlocks > 1
                                ? `${currentBlock}/${totalBlocks} · ${currentSet}/${totalSets}`
                                : `Set ${currentSet}/${totalSets}`}
                        </span>
                    )}

                    {/* Goal or timer */}
                    {sessionMode === 'time' && (
                        <span className="hud-timer">
                            {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:
                            {String(timeRemaining % 60).padStart(2, '0')}
                        </span>
                    )}

                    {sessionMode === 'reps' && (
                        <div className="hud-goal">
                            <div className="hud-goal-track">
                                <div
                                    className={`hud-goal-fill${goalDone ? ' hud-goal-fill--done' : ''}`}
                                    style={{ width: `${goalPct}%` }}
                                />
                            </div>
                            <span className="hud-goal-count">{repCount}/{goalReps}</span>
                        </div>
                    )}

                    <div className="dashboard-actions">
                        <button
                            type="button"
                            className="btn-icon"
                            onClick={onFlipCamera}
                            title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1l2-3h6l2 3h1a2 2 0 0 1 2 2v1" />
                                <circle cx="9" cy="13" r="3" />
                                <path d="M17 15v6M14 18l3-3 3 3" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className={`btn-icon ${soundEnabled ? '' : 'btn-icon--muted'}`}
                            onClick={onSoundToggle}
                            title={soundEnabled ? 'Mute' : 'Unmute'}
                        >
                            {soundEnabled ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <line x1="23" y1="9" x2="17" y2="15" />
                                    <line x1="17" y1="9" x2="23" y2="15" />
                                </svg>
                            )}
                        </button>
                        <button className="btn-stop" onClick={onStop} type="button">■</button>
                    </div>
                </div>
            </div>

            {/* ══════════ CENTER (grade pop — only briefly visible) ══════════ */}
            {lastRepResult && (
                <div className="dashboard-center">
                    <GradePop score={lastRepResult.score} repKey={repCount} />
                    <ComboCounter combo={combo} />
                </div>
            )}

            {/* ══════════ BOTTOM (coach hint + invalid banner) ══════════ */}
            <div className="dashboard-bottom">
                <CoachHint text={coachPhrase} />

                {showInvalidBanner && (
                    <div className="invalid-position-banner">
                        {exerciseType === 'pushup'
                            ? '⚠️ Get back into push-up position'
                            : exerciseType === 'pullup'
                                ? '⚠️ Get back into hang position'
                                : '⚠️ Stand upright facing the camera'}
                    </div>
                )}
            </div>
        </div>
    );
});
