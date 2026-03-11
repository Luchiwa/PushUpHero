import { useEffect, useState } from 'react';
import type { ExerciseState } from '../../exercises/types';
import { useAuth } from '@hooks/useAuth';
import { AuthModal } from '@components/AuthModal/AuthModal';
import './SummaryScreen.scss';

interface SummaryProps {
    exerciseState: ExerciseState;
    onReset: () => void;
    sessionMode?: 'reps' | 'time';
    elapsedTime?: number;
    level: number;
}

function ScoreGrade({ score }: { score: number }) {
    if (score >= 90) return <span className="grade grade-s">S</span>;
    if (score >= 75) return <span className="grade grade-a">A</span>;
    if (score >= 60) return <span className="grade grade-b">B</span>;
    if (score >= 45) return <span className="grade grade-c">C</span>;
    return <span className="grade grade-d">D</span>;
}

function formatElapsedTime(seconds?: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}min${secs}s`;
    return `${secs}s`;
}

export function SummaryScreen({ exerciseState, onReset, sessionMode, elapsedTime, level }: SummaryProps) {
    const { user } = useAuth();
    const [showPaywall, setShowPaywall] = useState(false);

    const { repCount, averageScore, repHistory } = exerciseState;

    useEffect(() => {
        // Trigger generic stats tracking if any
        console.log("Session complete", { repCount, averageScore });

        // If they just finished a session and are >= Level 5 but NOT logged in, show the registration modal
        if (level >= 5 && !user && repCount > 0) {
            // Small delay so they see the summary first
            const timer = setTimeout(() => setShowPaywall(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [repCount, averageScore, level, user]);

    return (
        <div className="summary-screen">
            <div className="summary-card">
                <h2 className="summary-title">Session Complete</h2>

                <div className="summary-stats">
                    {sessionMode === 'time' ? (
                        <>
                            <div className="summary-stat">
                                <span className="summary-value">{formatElapsedTime(elapsedTime)}</span>
                                <span className="summary-label">Duration</span>
                            </div>
                            <div className="summary-divider" />
                            <div className="summary-stat">
                                <span className="summary-value">{repCount}</span>
                                <span className="summary-label">Push-ups</span>
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
                    ) : (
                        <>
                            <div className="summary-stat">
                                <span className="summary-value">{repCount}</span>
                                <span className="summary-label">Push-ups</span>
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

                {repHistory.length > 0 && (
                    <div className="rep-history">
                        <p className="rep-history-title">Rep breakdown</p>
                        <div className="rep-history-list">
                            {repHistory.map((rep, i) => {
                                return (
                                    <div key={i} className="rep-history-item">
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
                                );
                            })}
                        </div>
                    </div>
                )}

                <button className="btn-primary" onClick={onReset}>
                    🔁 Try Again
                </button>
            </div>

            {showPaywall && (
                <AuthModal onClose={() => setShowPaywall(false)} />
            )}
        </div>
    );
}
