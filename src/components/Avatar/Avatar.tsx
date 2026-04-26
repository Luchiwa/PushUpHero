import { useState, useEffect, useRef } from 'react';
import { getCachedAvatarUrl } from '@infra/avatarCache';
import './Avatar.scss';

interface AvatarProps {
    photoURL?: string | null;
    /** Base64 thumbnail for instant display (no network fetch). */
    photoThumb?: string | null;
    initials: string;
    size?: number;
    className?: string;
    onClick?: () => void;
}

export function Avatar({ photoURL, photoThumb, initials, size = 40, className = '', onClick }: AvatarProps) {
    const style = { width: size, height: size, fontSize: size * 0.4 };
    const [cachedSrc, setCachedSrc] = useState<string | null>(null);
    const prevUrl = useRef<string | null | undefined>(undefined);

    // Reset cached source synchronously during render when photoURL clears
    const [prevPhotoURL, setPrevPhotoURL] = useState(photoURL);
    if (photoURL !== prevPhotoURL) {
        setPrevPhotoURL(photoURL);
        if (!photoURL) setCachedSrc(null);
    }

    useEffect(() => {
        if (!photoURL) {
            prevUrl.current = photoURL;
            return;
        }

        // Only refetch if the URL actually changed
        if (photoURL === prevUrl.current) return;
        prevUrl.current = photoURL;

        let revoked = false;
        getCachedAvatarUrl(photoURL).then(url => {
            if (!revoked) setCachedSrc(url);
        });
        return () => {
            revoked = true;
        };
    }, [photoURL]);

    // Display priority: cached full-res > base64 thumbnail > initials
    // photoThumb renders instantly (inline base64), cachedSrc swaps in once resolved.
    const imgSrc = cachedSrc || photoThumb || null;

    return (
        <div
            className={`avatar ${onClick ? 'avatar--clickable' : ''} ${className}`}
            style={style}
            onClick={onClick}
            onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={onClick ? 'Change avatar' : undefined}
        >
            {imgSrc ? (
                <img
                    src={imgSrc}
                    alt={initials}
                    className="avatar__img"
                    draggable={false}
                />
            ) : (
                <span className="avatar__initials">{initials[0]?.toUpperCase() || '?'}</span>
            )}
        </div>
    );
}
