import { useEffect, useRef, useState } from 'react';
import type { ExerciseState, ExerciseType, WorkoutPlan } from '@exercises/types';
import type { SetRecord } from '@exercises/types';
import { getExerciseLabel } from '@exercises/types';
import { useAuth } from '@hooks/useAuth';
import { useShareSession } from '@hooks/useShareSession';
import type { ShareSessionData } from '@hooks/useShareSession';
import { useSoundEffect } from '@hooks/useSoundEffect';
import { AuthModal } from '@modals/AuthModal/AuthModal';
import { getGradeLetter, getGradeClass, formatElapsedTime } from '@lib/constants';
import type { SessionXpResult } from '@lib/xpSystem';
import type { AchievementDef } from '@lib/achievements';
import { TIER_COLORS } from '@lib/achievements';
import type { RecordUpdate } from '@lib/achievementEngine';
import { RECORDS } from '@lib/achievements';
import { AchievementToastQueue } from '@components/AchievementToastQueue/AchievementToastQueue';
import './SummaryScreen.scss';

// ── Confetti particles ────────────────────────────────────────────
const PARTICLE_COUNT = 60;

function createParticles(canvas: HTMLCanvasElement) {
    const W = canvas.width;
    const H = canvas.height;
    return Array.from({ length: PARTICLE_COUNT }, () => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5,
        y: H / 2 + (Math.random() - 0.5) * H * 0.3,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 8 + 4,
        color: ['#f59e0b', '#6366f1', '#22c55e', '#ef4444', '#a5f3fc', '#fbbf24'][Math.floor(Math.random() * 6)],
        gravity: 0.4,
        opacity: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
    }));
}

interface SummaryProps {
    exerciseType: ExerciseType;
    exerciseState: ExerciseState;
    completedSets?: SetRecord[];
    onReset: () => void;
    sessionMode?: 'reps' | 'time';
    elapsedTime?: number;
    /** Provided when the session was a multi-exercise workout */
    workoutPlan?: WorkoutPlan;
    /** XP result from the completed session */
    sessionXp?: SessionXpResult;
    /** Whether sound is enabled (for victory sound) */
    soundEnabled?: boolean;
    /** Whether the goal was reached (triggers celebration) */
    goalReached?: boolean;
    /** Achievements unlocked during this session */
    newAchievements?: AchievementDef[];
    /** Records broken during this session */
    brokenRecords?: RecordUpdate[];
}

function ScoreGrade({ score }: { score: number }) {
    return <span className={`grade ${getGradeClass(score)}`}>{getGradeLetter(score)}</span>;
}

export function SummaryScreen({ exerciseType, exerciseState, completedSets, onReset, sessionMode, elapsedTime, workoutPlan, sessionXp, soundEnabled, goalReached, newAchievements, brokenRecords }: SummaryProps) {
    const { user, dbUser, level } = useAuth();
    const { shareSession } = useShareSession();
    const { initAudio, playVictorySound } = useSoundEffect();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | null>(null);
    const [sharing, setSharing] = useState(false);
    const [shareError, setShareError] = useState('');
    const [showPaywall, setShowPaywall] = useState(false);
    const [expandedSet, setExpandedSet] = useState<number | null>(null);
    const [expandedBlock, setExpandedBlock] = useState<number | null>(null);

    const isMultiSet = completedSets != null && completedSets.length > 1;
    const isMultiExercise = workoutPlan != null && workoutPlan.blocks.length > 1;

    // Aggregate stats across all sets (or use exerciseState for single-set)
    const totalReps = isMultiSet
        ? completedSets.reduce((sum, s) => sum + s.reps, 0)
        : exerciseState.repCount;
    const averageScore = isMultiSet
        ? (totalReps > 0 ? Math.round(completedSets.reduce((sum, s) => sum + s.averageScore * s.reps, 0) / totalReps) : 0)
        : exerciseState.averageScore;
    const allRepHistory = isMultiSet
        ? completedSets.flatMap(s => s.repHistory)
        : exerciseState.repHistory;

    // ── Victory celebration: sound + confetti ────────────────────────
    useEffect(() => {
        if (!goalReached) return;
        initAudio();
        if (soundEnabled) playVictorySound();
    }, [goalReached, soundEnabled, initAudio, playVictorySound]);

    useEffect(() => {
        if (!goalReached) return;
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const c = ctx;
        const w = cvs.width = window.innerWidth;
        const h = cvs.height = window.innerHeight;
        const particles = createParticles(cvs);
        let elapsed = 0;
        let lastTime = performance.now();

        function animate(now: number) {
            const dt = Math.min((now - lastTime) / 16.67, 3);
            lastTime = now;
            elapsed += dt * 16.67;

            c.clearRect(0, 0, w, h);
            for (const p of particles) {
                p.x += p.vx * dt;
                p.vy += p.gravity * dt;
                p.y += p.vy * dt;
                p.rotation += p.rotationSpeed * dt;
                p.opacity = Math.max(0, 1 - elapsed / 3000);

                c.save();
                c.globalAlpha = p.opacity;
                c.translate(p.x, p.y);
                c.rotate((p.rotation * Math.PI) / 180);
                c.fillStyle = p.color;
                c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                c.restore();
            }

            if (elapsed < 3500) {
                animRef.current = requestAnimationFrame(animate);
            }
        }
        animRef.current = requestAnimationFrame(animate);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [goalReached]);

    const handleShare = async () => {
        if (!user || !dbUser) return;
        setSharing(true);
        setShareError('');
        try {
            const grade = getGradeLetter(averageScore);
            const bestScore = allRepHistory.length > 0
                ? Math.max(...allRepHistory.map(r => r.score))
                : undefined;
            // Build per-block summaries for multi-exercise share card
            const blockSummaries = isMultiExercise && completedSets ? (() => {
                const summaries: { label: string; reps: number; sets: number; avgScore: number }[] = [];
                let si = 0;
                for (const block of workoutPlan.blocks) {
                    const blockSets = completedSets.slice(si, si + block.numberOfSets);
                    si += block.numberOfSets;
                    const reps = blockSets.reduce((s, st) => s + st.reps, 0);
                    const avg = reps > 0 ? Math.round(blockSets.reduce((s, st) => s + st.averageScore * st.reps, 0) / reps) : 0;
                    summaries.push({ label: getExerciseLabel(block.exerciseType), reps, sets: blockSets.length, avgScore: avg });
                }
                return summaries;
            })() : undefined;

            const shareData: ShareSessionData = {
                repCount: totalReps,
                averageScore,
                sessionMode: sessionMode ?? 'reps',
                elapsedTime,
                level,
                username: dbUser.displayName,
                grade,
                numberOfSets: isMultiSet ? completedSets.length : undefined,
                bestScore,
                exerciseType,
                isMultiExercise: isMultiExercise || undefined,
                numberOfExercises: isMultiExercise ? workoutPlan.blocks.length : undefined,
                blockSummaries,
            };
            await shareSession(shareData);
        } catch (err: unknown) {
            const msg = (err as Error)?.message ?? '';
            if (!msg.includes('AbortError') && !msg.includes('cancel')) {
                setShareError('Could not share. Try downloading instead.');
            }
        } finally {
            setSharing(false);
        }
    };

    useEffect(() => {
        if (level >= 5 && !user && totalReps > 0) {
            const timer = setTimeout(() => setShowPaywall(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [totalReps, level, user]);

    return (
        <div className={`summary-screen${goalReached ? ' summary-screen--victory' : ''}`}>
            {/* Confetti canvas (victory only) */}
            {goalReached && <canvas ref={canvasRef} className="summary-confetti-canvas" />}

            <div className="summary-card">
                {/* Victory celebration header */}
                {goalReached && (
                    <div className="summary-victory-header">
                        <span className="summary-victory-emoji">🏆</span>
                        <h2 className="summary-victory-title">
                            {isMultiExercise || isMultiSet ? 'WORKOUT COMPLETE!' : 'GOAL REACHED!'}
                        </h2>
                    </div>
                )}

                {/* Regular header (non-victory) */}
                {!goalReached && (
                    <h2 className="summary-title">
                        {isMultiExercise ? 'Workout Complete' : isMultiSet ? 'Workout Complete' : 'Session Complete'}
                    </h2>
                )}

                {isMultiExercise && (
                    <span className="summary-sets-badge">
                        {workoutPlan.blocks.length} exercises · {completedSets?.length ?? 0} sets
                    </span>
                )}

                {!isMultiExercise && isMultiSet && (
                    <span className="summary-sets-badge">
                        {completedSets.length} set{completedSets.length > 1 ? 's' : ''}
                    </span>
                )}

                <div className={`summary-stats${isMultiExercise ? ' summary-stats--time' : sessionMode === 'time' ? ' summary-stats--time' : ''}`}>
                    {isMultiExercise ? (
                        <>
                            <div className="summary-stat summary-stat--wide">
                                <span className="summary-value summary-value--duration">{formatElapsedTime(elapsedTime)}</span>
                                <span className="summary-label">Duration</span>
                            </div>
                            <div className="summary-stats-row">
                                <div className="summary-stat">
                                    <span className="summary-value">{totalReps}</span>
                                    <span className="summary-label">Total Reps</span>
                                </div>
                                <div className="summary-divider" />
                                <div className="summary-stat">
                                    <ScoreGrade score={averageScore} />
                                    <span className="summary-label">Grade</span>
                                </div>
                                <div className="summary-divider" />
                                <div className="summary-stat">
                                    <span className="summary-value">{averageScore}</span>
                                    <span className="summary-label">Avg Score</span>
                                </div>
                            </div>
                        </>
                    ) : sessionMode === 'time' ? (
                        <>
                            <div className="summary-stat summary-stat--wide">
                                <span className="summary-value summary-value--duration">{formatElapsedTime(elapsedTime)}</span>
                                <span className="summary-label">Duration</span>
                            </div>
                            <div className="summary-stats-row">
                                <div className="summary-stat">
                                    <span className="summary-value">{totalReps}</span>
                                    <span className="summary-label">{getExerciseLabel(exerciseType)}</span>
                                </div>
                                <div className="summary-divider" />
                                <div className="summary-stat">
                                    <ScoreGrade score={averageScore} />
                                    <span className="summary-label">Grade</span>
                                </div>
                                <div className="summary-divider" />
                                <div className="summary-stat">
                                    <span className="summary-value">{averageScore}</span>
                                    <span className="summary-label">Avg Score</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="summary-stat">
                                <span className="summary-value">{totalReps}</span>
                                <span className="summary-label">{getExerciseLabel(exerciseType)}</span>
                            </div>
                            <div className="summary-divider" />
                            <div className="summary-stat">
                                <ScoreGrade score={averageScore} />
                                <span className="summary-label">Grade</span>
                            </div>
                            <div className="summary-divider" />
                            <div className="summary-stat">
                                <span className="summary-value">{averageScore}</span>
                                <span className="summary-label">Avg Score</span>
                            </div>
                        </>
                    )}
                </div>

                {/* ── XP Breakdown ─────────────────────────────────────── */}
                {sessionXp && (
                    <div className="xp-breakdown">
                        <div className="xp-breakdown-header">
                            <span className="xp-breakdown-total">+{sessionXp.totalXp.toLocaleString()} XP</span>
                            {sessionXp.multiplier > 1 && (
                                <span className="xp-breakdown-multiplier">×{sessionXp.multiplier.toFixed(2)}</span>
                            )}
                        </div>

                        {/* Per-exercise XP */}
                        {sessionXp.perExercise.length > 0 && (
                            <div className="xp-breakdown-exercises">
                                {sessionXp.perExercise.map(ex => (
                                    <span key={ex.exerciseType} className="xp-exercise-pill">
                                        {getExerciseLabel(ex.exerciseType)} +{ex.finalXp.toLocaleString()}
                                        {ex.difficultyCoefficient > 1.0 && (
                                            <span className="xp-difficulty-badge">×{ex.difficultyCoefficient.toFixed(1)}</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Bonus tags */}
                        {sessionXp.bonuses.length > 0 && (
                            <div className="xp-breakdown-bonuses">
                                {sessionXp.bonuses.map(b => (
                                    <span key={b.key} className="xp-bonus-tag">
                                        {b.emoji} {b.label} <strong>+{b.pct}%</strong>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Raw XP line */}
                        {sessionXp.multiplier > 1 && (
                            <span className="xp-breakdown-raw">
                                XP brute : {sessionXp.rawXp.toLocaleString()}
                            </span>
                        )}
                    </div>
                )}

                {/* ── New Achievements ───────────────────────────────── */}
                {newAchievements && newAchievements.length > 0 && (
                    <div className="summary-achievements">
                        <p className="summary-section-title">🏆 Achievements Unlocked</p>
                        <div className="summary-achievements-list">
                            {newAchievements.map(ach => (
                                <div
                                    key={ach.id}
                                    className="summary-achievement-chip"
                                    style={{ borderColor: TIER_COLORS[ach.tier] }}
                                >
                                    <span className="summary-achievement-tier" style={{ color: TIER_COLORS[ach.tier] }}>
                                        {ach.tier === 'bronze' ? '🥉' : ach.tier === 'silver' ? '🥈' : ach.tier === 'gold' ? '🥇' : '💎'}
                                    </span>
                                    <span className="summary-achievement-title">{ach.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Broken Records ──────────────────────────────────── */}
                {brokenRecords && brokenRecords.length > 0 && (
                    <div className="summary-records">
                        <p className="summary-section-title">🏅 New Records</p>
                        <div className="summary-records-list">
                            {brokenRecords.map(rec => {
                                const def = RECORDS.find(r => r.key === rec.key);
                                return (
                                    <div key={rec.key} className="summary-record-chip">
                                        <span className="summary-record-emoji">{def?.emoji ?? '🏅'}</span>
                                        <span className="summary-record-label">{def?.label ?? rec.key}</span>
                                        <span className="summary-record-value">
                                            {rec.oldValue != null && (
                                                <span className="summary-record-old">{rec.oldValue} →</span>
                                            )}
                                            {' '}{rec.newValue}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Per-block breakdown for multi-exercise workouts */}
                {isMultiExercise && isMultiSet && completedSets != null && (() => {
                    // Group sets by block using workoutPlan
                    const blockGroups: { block: (typeof workoutPlan.blocks)[number]; sets: SetRecord[] }[] = [];
                    let setIdx = 0;
                    for (const block of workoutPlan.blocks) {
                        const blockSets = completedSets.slice(setIdx, setIdx + block.numberOfSets);
                        blockGroups.push({ block, sets: blockSets });
                        setIdx += block.numberOfSets;
                    }
                    return (
                        <div className="sets-breakdown">
                            <p className="sets-breakdown-title">Exercise breakdown</p>
                            {blockGroups.map((group, bi) => {
                                const blockReps = group.sets.reduce((s, set) => s + set.reps, 0);
                                const blockAvg = blockReps > 0
                                    ? Math.round(group.sets.reduce((s, set) => s + set.averageScore * set.reps, 0) / blockReps)
                                    : 0;
                                const isOpen = expandedBlock === bi;
                                const blockRepHistory = group.sets.flatMap(s => s.repHistory);
                                return (
                                    <div key={`block-${group.block.exerciseType}-${bi}`} className={`set-item ${isOpen ? 'set-item--expanded' : ''}`}>
                                        <button
                                            type="button"
                                            className="set-item-header"
                                            onClick={() => setExpandedBlock(isOpen ? null : bi)}
                                        >
                                            <span className="set-item-num">{getExerciseLabel(group.block.exerciseType)}</span>
                                            <span className="set-item-stats">
                                                {blockReps} reps · {group.sets.length} set{group.sets.length > 1 ? 's' : ''} · <ScoreGrade score={blockAvg} />
                                            </span>
                                            <span className="set-item-chevron">{isOpen ? '▲' : '▼'}</span>
                                        </button>
                                        {isOpen && blockRepHistory.length > 0 && (
                                            <div className="set-item-reps">
                                                {blockRepHistory.map((rep, ri) => (
                                                    <div key={`block-${bi}-rep-${ri}`} className="rep-history-item">
                                                        <span className="rep-num">#{ri + 1}</span>
                                                        <div className="rep-mini-bar">
                                                            <div
                                                                className="rep-mini-fill"
                                                                style={{
                                                                    width: `${rep.score}%`,
                                                                    background: rep.score >= 75 ? '#22c55e' : rep.score >= 50 ? '#f59e0b' : '#ef4444',
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="rep-score">{rep.score}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Per-set breakdown for multi-set (single-exercise) workouts */}
                {!isMultiExercise && isMultiSet && (
                    <div className="sets-breakdown">
                        <p className="sets-breakdown-title">Sets breakdown</p>
                        {completedSets.map((set, i) => (
                            <div key={`set-${set.reps}-${i}`} className={`set-item ${expandedSet === i ? 'set-item--expanded' : ''}`}>
                                <button
                                    type="button"
                                    className="set-item-header"
                                    onClick={() => setExpandedSet(expandedSet === i ? null : i)}
                                >
                                    <span className="set-item-num">Set {i + 1}</span>
                                    <span className="set-item-stats">
                                        {set.reps} reps · <ScoreGrade score={set.averageScore} /> · {set.averageScore}%
                                    </span>
                                    <span className="set-item-chevron">{expandedSet === i ? '▲' : '▼'}</span>
                                </button>
                                {expandedSet === i && set.repHistory.length > 0 && (
                                    <div className="set-item-reps">
                                        {set.repHistory.map((rep, j) => (
                                            <div key={`rep-${rep.score}-${j}`} className="rep-history-item">
                                                <span className="rep-num">#{j + 1}</span>
                                                <div className="rep-mini-bar">
                                                    <div
                                                        className="rep-mini-fill"
                                                        style={{
                                                            width: `${rep.score}%`,
                                                            background: rep.score >= 75 ? '#22c55e' : rep.score >= 50 ? '#f59e0b' : '#ef4444',
                                                        }}
                                                    />
                                                </div>
                                                <span className="rep-score">{rep.score}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Rep breakdown for single-set sessions */}
                {!isMultiSet && allRepHistory.length > 0 && (
                    <div className="rep-history">
                        <p className="rep-history-title">Rep breakdown</p>
                        <div className="rep-history-list">
                            {allRepHistory.map((rep, i) => (
                                <div key={`rep-${rep.score}-${i}`} className="rep-history-item">
                                    <span className="rep-num">#{i + 1}</span>
                                    <div className="rep-mini-bar">
                                        <div
                                            className="rep-mini-fill"
                                            style={{
                                                width: `${rep.score}%`,
                                                background: rep.score >= 75 ? '#22c55e' : rep.score >= 50 ? '#f59e0b' : '#ef4444',
                                            }}
                                        />
                                    </div>
                                    <span className="rep-score">{rep.score}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="summary-actions">
                    <button type="button" className="btn-primary" onClick={onReset}>
                        🔁 Try Again
                    </button>
                    {user && dbUser && (
                        <button
                            type="button"
                            className="btn-share"
                            onClick={handleShare}
                            disabled={sharing}
                        >
                            {sharing ? (
                                <span className="btn-share-spinner" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                            )}
                            {sharing ? 'Generating…' : 'Share'}
                        </button>
                    )}
                </div>
                {shareError && <p className="summary-share-error">{shareError}</p>}
            </div>

            {showPaywall && (
                <AuthModal onClose={() => setShowPaywall(false)} />
            )}

            {/* Achievement toast queue (staggered pop-ins) */}
            {newAchievements && newAchievements.length > 0 && (
                <AchievementToastQueue achievements={newAchievements} />
            )}
        </div>
    );
}
