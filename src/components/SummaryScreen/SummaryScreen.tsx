import { useEffect, useState } from 'react';
import type { ExerciseState } from '../../exercises/types';
import { useAuth } from '@hooks/useAuth';
import { useShareSession } from '@hooks/useShareSession';
import type { ShareSessionData } from '@hooks/useShareSession';
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

export function SummaryScreen({ exerciseState, onReset, sessionMode, elapsedTime }: Omit<SummaryProps, 'level'>) {
    const { user, dbUser, level } = useAuth();
    const { shareSession } = useShareSession();
    const [sharing, setSharing] = useState(false);
    const [shareError, setShareError] = useState('');
    const [showPaywall, setShowPaywall] = useState(false);

    const handleShare = async () => {
        if (!user || !dbUser) return;
        setSharing(true);
        setShareError('');
        try {
            const grade =
                averageScore >= 90 ? 'S' :
                averageScore >= 75 ? 'A' :
                averageScore >= 60 ? 'B' :
                averageScore >= 45 ? 'C' : 'D';
            const shareData: ShareSessionData = {
                repCount,
                averageScore,
                sessionMode: sessionMode ?? 'reps',
                elapsedTime,
                level,
                username: dbUser.displayName,
                grade,
            };
            await shareSession(shareData);
        } catch (err: unknown) {
            // User cancelled share — don't show error
            const msg = (err as Error)?.message ?? '';
            if (!msg.includes('AbortError') && !msg.includes('cancel')) {
                setShareError('Could not share. Try downloading instead.');
            }
        } finally {
            setSharing(false);
        }
    };

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

                <div className={`summary-stats${sessionMode === 'time' ? ' summary-stats--time' : ''}`}>
                    {sessionMode === 'time' ? (
                        <>
                            <div className="summary-stat summary-stat--wide">
                                <span className="summary-value summary-value--duration">{formatElapsedTime(elapsedTime)}</span>
                                <span className="summary-label">Duration</span>
                            </div>
                            <div className="summary-stats-row">
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

                <div className="summary-actions">
                    <button className="btn-primary" onClick={onReset}>
                        🔁 Try Again
                    </button>
                    {user && dbUser && (
                        <button
                            className="btn-share"
                            onClick={handleShare}
                            disabled={sharing}
                        >
                            {sharing ? (
                                <span className="btn-share-spinner" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
    );
}
