import { useEffect } from 'react';
import { getExerciseLabel } from '@exercises/types';
import { useSoundEffect } from '@hooks/useSoundEffect';
import { useModalClose } from '@hooks/shared/useModalClose';
import { useWorkout } from '@app/WorkoutContext';
import { useExerciseState } from '@app/ExerciseStateContext';
import { RECORDS, TIER_COLORS, formatElapsedTime, getGradeClass, getGradeLetter, weightedAverageScore, type AchievementDef } from '@domain';
import { AchievementToastQueue } from '@components/AchievementToastQueue/AchievementToastQueue';
import { PrimaryCTA } from '@components/PrimaryCTA/PrimaryCTA';
import { ConfettiCanvas } from './ConfettiCanvas/ConfettiCanvas';
import { XPBreakdown } from './XPBreakdown/XPBreakdown';
import { SetsBreakdown } from './SetsBreakdown/SetsBreakdown';
import './SummaryScreen.scss';

interface SummaryProps {
    /** Achievements unlocked during this session (filtered to exclude in-game shown) */
    newAchievements?: AchievementDef[];
}

function ScoreGrade({ score }: { score: number }) {
    return <span className={`grade ${getGradeClass(score)}`}>{getGradeLetter(score)}</span>;
}

export function SummaryScreen({ newAchievements }: SummaryProps) {
    const {
        exerciseType, completedSets,
        handleReset, sessionMode, elapsedTime,
        workoutPlan, isMultiExercise,
        lastSessionXp, soundEnabled, goalReached,
        questCompletedThisSession,
    } = useWorkout();
    const { repCount: liveRepCount, averageScore: liveAverageScore } = useExerciseState();

    const sessionXp = lastSessionXp ?? undefined;
    const brokenRecords = lastSessionXp?.brokenRecords;
    const questsCompleted = questCompletedThisSession;
    const { initAudio, playVictorySound } = useSoundEffect();
    const { closing, handleClose: handleContinue, handleAnimationEnd } = useModalClose(handleReset);

    const isMultiSet = completedSets.length > 1;

    // Aggregate stats across all sets (or use live exercise state for single-set)
    const totalReps = isMultiSet
        ? completedSets.reduce((sum, s) => sum + s.reps, 0)
        : liveRepCount;
    const averageScore = isMultiSet
        ? weightedAverageScore(completedSets)
        : liveAverageScore;

    // ── Victory celebration: sound + confetti ────────────────────────
    useEffect(() => {
        if (!goalReached) return;
        initAudio();
        if (soundEnabled) playVictorySound();
    }, [goalReached, soundEnabled, initAudio, playVictorySound]);

    return (
        <div
            className={`summary-screen${goalReached ? ' summary-screen--victory' : ''}${closing ? ' summary-screen--exit' : ''}`}
            onAnimationEnd={handleAnimationEnd}
        >
            {/* Confetti canvas (victory only) */}
            <ConfettiCanvas goalReached={goalReached} />

            <div className="summary-card">
                {/* Victory celebration header */}
                {goalReached && (
                    <div className="summary-victory-header" role="status" aria-live="polite">
                        <span className="summary-victory-emoji" aria-hidden="true">🏆</span>
                        <h2 className="summary-victory-title">
                            {isMultiExercise || isMultiSet ? 'WORKOUT COMPLETE!' : 'GOAL REACHED!'}
                        </h2>
                    </div>
                )}

                {/* Regular header (non-victory) */}
                {!goalReached && (
                    <h2 className="summary-title" role="status" aria-live="polite">
                        {isMultiExercise ? 'Workout Complete' : isMultiSet ? 'Workout Complete' : 'Session Complete'}
                    </h2>
                )}

                {/* Quest completion banner(s) */}
                {questsCompleted.length > 0 && (
                    <div className="summary-quest-list">
                        {questsCompleted.map(quest => (
                            <div key={quest.id} className="summary-quest-banner">
                                <span className="summary-quest-emoji" aria-hidden="true">{quest.emoji}</span>
                                <div className="summary-quest-info">
                                    <span className="summary-quest-label">Quest Complete!</span>
                                    <span className="summary-quest-title">{quest.title}</span>
                                </div>
                                <span className="summary-quest-xp">+{quest.xpReward} XP</span>
                            </div>
                        ))}
                    </div>
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
                {sessionXp && <XPBreakdown sessionXp={sessionXp} />}

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

                {/* Per-block / per-set breakdown */}
                <SetsBreakdown
                    isMultiExercise={isMultiExercise}
                    isMultiSet={isMultiSet}
                    workoutPlan={workoutPlan}
                    completedSets={completedSets}
                />

                <div className="summary-actions">
                    <PrimaryCTA
                        variant="solid"
                        size="lg"
                        block
                        onClick={handleContinue}
                        disabled={closing}
                        icon={<span aria-hidden="true">🔁</span>}
                    >
                        Continue
                    </PrimaryCTA>
                </div>
            </div>

            {/* Achievement toast queue (staggered pop-ins) */}
            {newAchievements && newAchievements.length > 0 && (
                <AchievementToastQueue achievements={newAchievements} />
            )}
        </div>
    );
}
