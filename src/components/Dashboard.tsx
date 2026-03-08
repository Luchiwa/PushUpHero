import { useEffect, useRef, useState } from 'react';
import type { ExerciseState } from '../exercises/types';
import { useSoundEffect } from '../hooks/useSoundEffect';
import { useLevelSystem } from '../hooks/useLevelSystem';
import { FloatyNumbers } from './FloatyNumbers';

interface DashboardProps {
    exerciseState: ExerciseState;
    goalReps: number;
    onStop: () => void;
    onFlipCamera: () => void;
    facingMode: 'user' | 'environment';
    soundEnabled: boolean;
    onSoundToggle: () => void;
}

function ScoreRing({ score }: { score: number }) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <svg className="score-ring" viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#ffffff18" strokeWidth="10" />
            <circle
                cx="50" cy="50" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
            />
            <text x="50" y="54" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
                {score}
            </text>
        </svg>
    );
}

function LevelBadge({ level, progressPct }: { level: number, progressPct: number }) {
    return (
        <div className="level-badge">
            <div className="level-badge-ring" style={{ background: `conic-gradient(var(--accent) ${progressPct}%, rgba(255,255,255,0.1) ${progressPct}%)` }}>
                <div className="level-badge-inner">
                    <span className="level-label">LVL</span>
                    <span className="level-number">{level}</span>
                </div>
            </div>
        </div>
    );
}

function GoalProgressBar({ current, goal }: { current: number; goal: number }) {
    const pct = Math.min(100, (current / goal) * 100);
    const done = current >= goal;
    return (
        <div className="stat-card goal-card">
            <span className="stat-label">Goal</span>
            <div className="goal-vertical-track">
                <div
                    className={`goal-vertical-fill ${done ? 'goal-done' : ''}`}
                    style={{ height: `${pct}%` }}
                />
            </div>
            <span className="goal-vertical-count">{current}/{goal}</span>
        </div>
    );
}

export function Dashboard({ exerciseState, goalReps, onStop, onFlipCamera, facingMode, soundEnabled, onSoundToggle }: DashboardProps) {
    const { repCount, averageScore, lastRepResult, isValidPosition, isCalibrated } = exerciseState;

    // Audio hook (sound toggle is via prop from App)
    const { initAudio, playRepSound, playLevelUpSound } = useSoundEffect();
    const prevRepCountRef = useRef(repCount);

    // Level System
    const { level, levelProgressPct, addRepsToLifetime } = useLevelSystem();
    const prevLevelRef = useRef(level);

    // Debounced invalid-position banner: only show after 2s of invalid position
    const invalidFramesRef = useRef(0);
    const [showInvalidBanner, setShowInvalidBanner] = useState(false);
    useEffect(() => {
        if (!isCalibrated) { setShowInvalidBanner(false); return; }
        if (!isValidPosition) {
            invalidFramesRef.current++;
            if (invalidFramesRef.current >= 60) setShowInvalidBanner(true);
        } else {
            invalidFramesRef.current = 0;
            setShowInvalidBanner(false);
        }
    }, [isValidPosition, isCalibrated]);

    // Initialize audio context on first interaction
    useEffect(() => {
        if (soundEnabled) initAudio();
    }, [soundEnabled, initAudio]);

    // Handle reps -> sounds & level ups
    useEffect(() => {
        if (repCount > prevRepCountRef.current) {
            const repsDone = repCount - prevRepCountRef.current;

            // Play rep sound
            if (soundEnabled) playRepSound();

            // Add to global lifetime reps
            addRepsToLifetime(repsDone);
        }
        prevRepCountRef.current = repCount;
    }, [repCount, playRepSound, soundEnabled, addRepsToLifetime]);

    // Check for level up specifically to play the sound
    useEffect(() => {
        if (level > prevLevelRef.current) {
            if (soundEnabled) playLevelUpSound();
        }
        prevLevelRef.current = level;
    }, [level, playLevelUpSound, soundEnabled]);

    return (
        <div className="dashboard">
            <div className="dashboard-top">
                <LevelBadge level={level} progressPct={levelProgressPct} />
                <div className="dashboard-actions">
                    <button
                        className="btn-sound"
                        onClick={onFlipCamera}
                        title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
                    >
                        {/* Camera flip icon */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1l2-3h6l2 3h1a2 2 0 0 1 2 2v1" />
                            <circle cx="9" cy="13" r="3" />
                            <path d="M17 15v6M14 18l3-3 3 3" />
                        </svg>
                    </button>
                    <button
                        className={`btn-sound ${soundEnabled ? '' : 'btn-sound-muted'}`}
                        onClick={onSoundToggle}
                        title={soundEnabled ? 'Mute sound' : 'Enable sound'}
                    >
                        {soundEnabled ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                <line x1="17" y1="9" x2="23" y2="15"></line>
                            </svg>
                        )}
                    </button>
                    <button className="btn-stop" onClick={onStop}>■ Stop</button>
                </div>
            </div>

            <div className="stats-row">
                <div className="stat-card" style={{ position: 'relative' }}>
                    <FloatyNumbers repCount={repCount} />
                    <span className="stat-value rep-count">{repCount}</span>
                    <span className="stat-label">Push-ups</span>
                </div>

                <div className="stat-card score-card">
                    <ScoreRing score={averageScore} />
                    <span className="stat-label">Avg Score</span>
                </div>

                <GoalProgressBar current={repCount} goal={goalReps} />
            </div>

            {/* Anti-cheat feedback banner — debounced, below stats */}
            {showInvalidBanner && (
                <div className="invalid-position-banner">
                    ⚠️ Retourne-toi en position pompe — corps horizontal, mains au sol
                </div>
            )}

            {lastRepResult && (
                <div className="last-rep-info">
                    <span className="last-rep-title">Last rep</span>
                    <div className="last-rep-bars">
                        <div className="bar-row">
                            <span>Amplitude</span>
                            <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${lastRepResult.amplitudeScore}%` }} />
                            </div>
                            <span>{lastRepResult.amplitudeScore}</span>
                        </div>
                        <div className="bar-row">
                            <span>Alignment</span>
                            <div className="bar-track">
                                <div className="bar-fill bar-fill-alt" style={{ width: `${lastRepResult.alignmentScore}%` }} />
                            </div>
                            <span>{lastRepResult.alignmentScore}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
