import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './FriendsTab.scss';
import { useFriends } from '@hooks/useFriends';
import type { SearchResult, Friend } from '@services/friendService';
import { FriendCard } from './FriendCard/FriendCard';
import { RequestCard, OutgoingRequestCard } from './RequestCard/RequestCard';
import { SearchResultCard } from './SearchResultCard/SearchResultCard';

// ── Main FriendsTab ──────────────────────────────────────────────

export function FriendsTab() {
    const { t } = useTranslation('friends');
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
                    <svg className="friends-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={inputRef}
                        className="friends-search-input"
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSearchResult(null); }}
                        autoComplete="off"
                        autoCapitalize="none"
                    />
                    {query && (
                        <button type="button" className="friends-search-clear" onClick={clearSearch} aria-label={t('search_clear_aria')}>✕</button>
                    )}
                </div>
                <button type="submit" className="btn-primary-sm" disabled={searching || !query.trim()}>
                    {searching ? t('search_loading') : t('search_btn')}
                </button>
            </form>
            {/* Search result */}
            {searchResult === 'not_found' && (
                <p className="friends-empty-msg">{t('not_found')}</p>
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
                    <h3 className="friends-section-title friends-section-title--accent">
                        <span className="friends-section-title-dot" />
                        {t('section_requests')}
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
            <div className="friends-tab-scroll">
            {/* Outgoing requests */}
            {outgoingRequests.length > 0 && (
                <div className="friends-section">
                    <h3 className="friends-section-title">
                        {t('section_pending')}
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
                    <div className="friends-empty-state">
                        <span className="friends-empty-icon">👥</span>
                        <p className="friends-empty-title">{t('empty_title')}</p>
                        <p className="friends-empty-msg">{t('empty_subtitle')}</p>
                    </div>
                ) : friends.length > 0 ? (
                    <>
                        <h3 className="friends-section-title">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            {t('section_allies', { count: friends.length })}
                        </h3>
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
            </div>{/* end friends-tab-scroll */}

        </div>

        {/* Confirm remove modal */}
        {confirmRemove && (
            <div
                className="friend-confirm-overlay"
                role="presentation"
                onClick={() => !removing && setConfirmRemove(null)}
                onKeyDown={e => e.key === 'Escape' && !removing && setConfirmRemove(null)}
            >
                <div className="friend-confirm-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                    <p className="friend-confirm-title">{t('remove_confirm_title')}</p>
                    <p className="friend-confirm-body">
                        {t('remove_confirm_body_prefix')} <strong>{confirmRemove?.displayName}</strong> {t('remove_confirm_body_suffix')}
                    </p>
                    <div className="friend-confirm-actions">
                        <button
                            type="button"
                            className="friend-confirm-cancel"
                            onClick={() => setConfirmRemove(null)}
                            disabled={removing}
                        >
                            {t('remove_confirm_cancel')}
                        </button>
                        <button
                            type="button"
                            className="friend-confirm-remove"
                            onClick={handleConfirmRemove}
                            disabled={removing}
                        >
                            {removing ? t('remove_loading') : t('remove_confirm_remove')}
                        </button>
                    </div>
                </div>
            </div>
        )}

    </>
    );
}
