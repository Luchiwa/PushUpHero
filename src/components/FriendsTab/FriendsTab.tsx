import { useState, useRef, useEffect } from 'react';
import './FriendsTab.scss';
import { useFriends } from '@hooks/useFriends';
import type { SearchResult, FriendRequest, Friend, OutgoingRequest } from '@hooks/useFriends';
import { Avatar } from '@components/Avatar/Avatar';

// ── Sub-components ──────────────────────────────────────────────

const ENCOURAGE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const ENCOURAGE_KEY = (uid: string) => `pushup_encourage_${uid}`;

function useEncourageCooldown(friendUid: string) {
    const getRemaining = () => {
        const last = parseInt(localStorage.getItem(ENCOURAGE_KEY(friendUid)) || '0', 10);
        return Math.max(0, ENCOURAGE_COOLDOWN_MS - (Date.now() - last));
    };
    const [remaining, setRemaining] = useState(getRemaining);

    useEffect(() => {
        if (remaining <= 0) return;
        const id = setInterval(() => {
            const r = getRemaining();
            setRemaining(r);
            if (r <= 0) clearInterval(id);
        }, 30_000);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remaining > 0]);

    const markSent = () => {
        localStorage.setItem(ENCOURAGE_KEY(friendUid), Date.now().toString());
        setRemaining(ENCOURAGE_COOLDOWN_MS);
    };

    const minutesLeft = Math.ceil(remaining / 60_000);
    return { onCooldown: remaining > 0, minutesLeft, markSent };
}

function FriendCard({ friend, onRemove, onEncourage }: {
    friend: Friend;
    onRemove: () => void;
    onEncourage: () => Promise<void>;
}) {
    const { onCooldown, minutesLeft, markSent } = useEncourageCooldown(friend.uid);
    const [sending, setSending] = useState(false);

    const handleEncourage = async () => {
        if (onCooldown || sending) return;
        setSending(true);
        await onEncourage();
        markSent();
        setSending(false);
    };

    return (
        <div className="friend-card">
            <Avatar photoURL={friend.photoURL} initials={friend.displayName} size={40} />
            <div className="friend-info">
                <span className="friend-name">{friend.displayName}</span>
                <div className="friend-stats">
                    <span>Lvl {friend.level}</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{friend.totalReps} reps</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{friend.totalSessions} sessions</span>
                </div>
            </div>
            <div className="friend-card-actions">
                <button
                    className={`btn-encourage${onCooldown ? ' btn-encourage--cooldown' : ''}`}
                    onClick={handleEncourage}
                    disabled={onCooldown || sending}
                    title={onCooldown ? `Send again in ${minutesLeft} min` : 'Send encouragement'}
                    aria-label="Encourage"
                >
                    {sending ? <span className="btn-encourage-spinner">...</span> : '💪'}
                </button>
                <button className="btn-remove-friend" onClick={onRemove} title="Remove friend" aria-label="Remove friend">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}

function RequestCard({ request, onAccept, onDecline }: {
    request: FriendRequest;
    onAccept: () => void;
    onDecline: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    return (
        <div className="friend-card friend-card--request">
            <Avatar photoURL={undefined} initials={request.fromUsername} size={40} />
            <div className="friend-info">
                <span className="friend-name">{request.fromUsername}</span>
                <span className="friend-request-label">Wants to be your friend</span>
            </div>
            <div className="friend-request-actions">
                <button
                    className="btn-accept"
                    disabled={loading}
                    onClick={() => handle(onAccept)}
                    title="Accept"
                >✓</button>
                <button
                    className="btn-decline"
                    disabled={loading}
                    onClick={() => handle(onDecline)}
                    title="Decline"
                >✕</button>
            </div>
        </div>
    );
}

function OutgoingRequestCard({ request, onCancel }: {
    request: OutgoingRequest;
    onCancel: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    return (
        <div className="friend-card friend-card--outgoing">
            <Avatar photoURL={undefined} initials={request.toUsername} size={40} />
            <div className="friend-info">
                <span className="friend-name">{request.toUsername}</span>
                <span className="friend-pending-label">Request sent — awaiting reply</span>
            </div>
            <div className="friend-search-action">
                <button
                    className="btn-cancel-request"
                    disabled={loading}
                    onClick={() => handle(onCancel)}
                >
                    {loading ? '…' : 'Cancel'}
                </button>
            </div>
        </div>
    );
}

function SearchResultCard({ result, onSend, onCancel }: {
    result: SearchResult;
    onSend: () => void;
    onCancel: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handle = async (fn: () => void) => {
        setLoading(true);
        await fn();
        setLoading(false);
    };

    return (
        <div className="friend-card friend-card--search">
            <Avatar photoURL={undefined} initials={result.displayName} size={40} />
            <div className="friend-info">
                <span className="friend-name">{result.displayName}</span>
                <div className="friend-stats">
                    <span>Lvl {result.level}</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{result.totalReps} reps</span>
                    <span className="friend-stats-dot">·</span>
                    <span>{result.totalSessions} sessions</span>
                </div>
            </div>
            <div className="friend-search-action">
                {result.relation === 'friend' && (
                    <span className="friend-badge friend-badge--already">Friends</span>
                )}
                {result.relation === 'request_sent' && (
                    <button
                        className="btn-cancel-request"
                        disabled={loading}
                        onClick={() => handle(onCancel)}
                    >
                        {loading ? '…' : 'Cancel'}
                    </button>
                )}
                {result.relation === 'request_received' && (
                    <span className="friend-badge friend-badge--incoming">Pending</span>
                )}
                {result.relation === 'none' && (
                    <button
                        className="btn-add-friend"
                        disabled={loading}
                        onClick={() => handle(onSend)}
                    >
                        {loading ? '…' : '+ Add'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main FriendsTab ──────────────────────────────────────────────

export function FriendsTab() {
    const {
        friends,
        incomingRequests,
        outgoingRequests,
        searchByUsername,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        sendEncouragement,
        removeFriend,
    } = useFriends();

    const [query, setQuery] = useState('');
    const [searchResult, setSearchResult] = useState<SearchResult | null | 'not_found'>(null);
    const [searching, setSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [confirmRemove, setConfirmRemove] = useState<Friend | null>(null);
    const [removing, setRemoving] = useState(false);

    const handleConfirmRemove = async () => {
        if (!confirmRemove) return;
        setRemoving(true);
        await removeFriend(confirmRemove.uid);
        setRemoving(false);
        setConfirmRemove(null);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setSearching(true);
        setSearchResult(null);
        const result = await searchByUsername(query.trim());
        setSearchResult(result ?? 'not_found');
        setSearching(false);
    };

    const clearSearch = () => {
        setQuery('');
        setSearchResult(null);
        inputRef.current?.focus();
    };

    return (
        <>
        <div className="friends-tab">

            {/* Search bar */}
            <form className="friends-search-form" onSubmit={handleSearch}>
                <div className="friends-search-input-wrap">
                    <svg className="friends-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={inputRef}
                        className="friends-search-input"
                        type="text"
                        placeholder="Search by username…"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSearchResult(null); }}
                        autoComplete="off"
                        autoCapitalize="none"
                    />
                    {query && (
                        <button type="button" className="friends-search-clear" onClick={clearSearch} aria-label="Clear">✕</button>
                    )}
                </div>
                <button type="submit" className="friends-search-btn" disabled={searching || !query.trim()}>
                    {searching ? '…' : 'Search'}
                </button>
            </form>

            {/* Search result */}
            {searchResult === 'not_found' && (
                <p className="friends-empty-msg">No user found with this username.</p>
            )}
            {searchResult && searchResult !== 'not_found' && (
                <div className="friends-section">
                    <SearchResultCard
                        result={searchResult}
                        onSend={async () => {
                            await sendFriendRequest(searchResult.uid, searchResult.displayName);
                            setSearchResult({ ...searchResult, relation: 'request_sent' });
                        }}
                        onCancel={async () => {
                            await cancelFriendRequest(searchResult.uid);
                            setSearchResult({ ...searchResult, relation: 'none' });
                        }}
                    />
                </div>
            )}

            {/* Incoming requests */}
            {incomingRequests.length > 0 && (
                <div className="friends-section">
                    <h3 className="friends-section-title">
                        Friend requests
                        <span className="friends-badge">{incomingRequests.length}</span>
                    </h3>
                    {incomingRequests.map(req => (
                        <RequestCard
                            key={req.fromUid}
                            request={req}
                            onAccept={() => acceptFriendRequest(req)}
                            onDecline={() => declineFriendRequest(req.fromUid)}
                        />
                    ))}
                </div>
            )}

            {/* Outgoing requests */}
            {outgoingRequests.length > 0 && (
                <div className="friends-section">
                    <h3 className="friends-section-title">
                        Pending sent requests
                        <span className="friends-badge">{outgoingRequests.length}</span>
                    </h3>
                    {outgoingRequests.map(req => (
                        <OutgoingRequestCard
                            key={req.toUid}
                            request={req}
                            onCancel={() => cancelFriendRequest(req.toUid)}
                        />
                    ))}
                </div>
            )}

            {/* Friends list */}
            <div className="friends-section">
                {friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 && !searchResult ? (
                    <p className="friends-empty-msg">
                        Search for a username above to add your first friend!
                    </p>
                ) : friends.length > 0 ? (
                    <>
                        <h3 className="friends-section-title">Friends — {friends.length}</h3>
                        {friends.map(f => (
                            <FriendCard
                                key={f.uid}
                                friend={f}
                                onEncourage={() => sendEncouragement(f.uid)}
                                onRemove={() => setConfirmRemove(f)}
                            />
                        ))}
                    </>
                ) : null}
            </div>

        </div>

        {/* Confirm remove modal */}
        {confirmRemove && (
            <div className="friend-confirm-overlay" onClick={() => !removing && setConfirmRemove(null)}>
                <div className="friend-confirm-card" onClick={e => e.stopPropagation()}>
                    <p className="friend-confirm-title">Remove friend?</p>
                    <p className="friend-confirm-body">
                        Remove <strong>{confirmRemove?.displayName}</strong> from your friends list?
                    </p>
                    <div className="friend-confirm-actions">
                        <button
                            className="friend-confirm-cancel"
                            onClick={() => setConfirmRemove(null)}
                            disabled={removing}
                        >
                            Cancel
                        </button>
                        <button
                            className="friend-confirm-remove"
                            onClick={handleConfirmRemove}
                            disabled={removing}
                        >
                            {removing ? '…' : 'Remove'}
                        </button>
                    </div>
                </div>
            </div>
        )}

    </>
    );
}
