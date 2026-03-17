/**
 * useShareSession — Hook wrapping the session card generator + share logic.
 */
import { useCallback } from 'react';
import { getGradeLetter } from '@lib/constants';
import { generateSessionCard } from '@lib/generateSessionCard';
import type { ShareSessionData } from '@lib/generateSessionCard';

export type { ShareSessionData };

export function useShareSession() {
    const shareSession = useCallback(async (data: ShareSessionData) => {
        const canvas = generateSessionCard(data);

        // Convert to blob
        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/png')
        );

        if (!blob) throw new Error('Failed to generate image');

        const file = new File([blob], 'pushup-session.png', { type: 'image/png' });

        // Try Web Share API (native share sheet on mobile)
        if (navigator.canShare?.({ files: [file] })) {
            const setsText = data.numberOfSets && data.numberOfSets > 1
                ? ` in ${data.numberOfSets} sets` : '';
            await navigator.share({
                files: [file],
                title: 'Push-Up Hero',
                text: `I just did ${data.repCount} push-ups${setsText} and got a ${getGradeLetter(data.averageScore)}! 💪`,
            });
            return;
        }

        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pushup-session.png';
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    return { shareSession };
}
