import { useCallback } from 'react';

export interface ShareSessionData {
    repCount: number;
    averageScore: number;
    sessionMode: 'reps' | 'time';
    elapsedTime?: number;
    level: number;
    username: string;
    grade: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function getGradeColor(score: number): string {
    if (score >= 90) return '#a855f7';
    if (score >= 75) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 45) return '#f59e0b';
    return '#ef4444';
}

function getGradeLetter(score: number): string {
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 45) return 'C';
    return 'D';
}

function formatTime(seconds?: number): string {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

// ── Canvas card generator ────────────────────────────────────────

function generateSessionCard(data: ShareSessionData): HTMLCanvasElement {
    const W = 1080;
    const H = 1080;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // ── Background ──────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Subtle top radial gradient (orange glow)
    const bgGrad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.8);
    bgGrad.addColorStop(0, 'rgba(255, 127, 0, 0.12)');
    bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Card geometry ───────────────────────────────────────────
    const margin = 60;
    const cardX = margin;
    const cardY = margin;
    const cardW = W - margin * 2;
    const cardH = H - margin * 2;
    const r = 48;

    // ── Clip everything to the rounded card ─────────────────────
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + cardH - r);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
    ctx.lineTo(cardX + r, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.closePath();
    ctx.clip();

    // ── Card border (rounded rect) ──────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + cardH - r);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
    ctx.lineTo(cardX + r, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(26,26,26,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Top accent bar ──────────────────────────────────────────
    const barH = 10;
    const barGrad = ctx.createLinearGradient(cardX + r, cardY, cardX + cardW - r, cardY);
    barGrad.addColorStop(0, '#ff9c35');
    barGrad.addColorStop(1, '#ff7f00');
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + barH);
    ctx.lineTo(cardX, cardY + barH);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.fillStyle = barGrad;
    ctx.fill();

    // ── App name ────────────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff7f00';
    ctx.font = `700 38px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText('Push-Up Hero', W / 2, 175);

    // ── Username + Level pill ────────────────────────────────────
    const pillText = `@${data.username}  •  Level ${data.level}`;
    ctx.font = `600 30px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    const pillW = ctx.measureText(pillText).width + 60;
    const pillX = W / 2 - pillW / 2;
    const pillY = 210;
    const pillH = 52;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 100);
    ctx.fillStyle = 'rgba(255, 127, 0, 0.1)';
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(pillText, W / 2, pillY + 34);

    // ── Divider ─────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(26,26,26,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 80, 300);
    ctx.lineTo(cardX + cardW - 80, 300);
    ctx.stroke();

    // ── Main stats ───────────────────────────────────────────────
    const grade = getGradeLetter(data.averageScore);
    const gradeColor = getGradeColor(data.averageScore);

    // Build stat items based on mode
    type StatItem = { value: string; label: string; accent?: boolean };
    const stats: StatItem[] = data.sessionMode === 'time'
        ? [
            { value: formatTime(data.elapsedTime), label: 'Duration' },
            { value: String(data.repCount), label: 'Push-ups', accent: true },
            { value: String(data.averageScore), label: 'Avg Score' },
        ]
        : [
            { value: String(data.repCount), label: 'Push-ups', accent: true },
            { value: String(data.averageScore), label: 'Avg Score' },
        ];

    const statCount = stats.length;
    const statAreaY = 340;
    const statAreaH = 280;
    const statColW = cardW / statCount;

    stats.forEach((stat, i) => {
        const cx = cardX + statColW * i + statColW / 2;
        const cy = statAreaY + statAreaH / 2;

        // Value
        ctx.textAlign = 'center';
        ctx.font = `900 110px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        if (stat.accent) {
            const grad = ctx.createLinearGradient(cx - 80, cy - 80, cx + 80, cy + 30);
            grad.addColorStop(0, '#ffb366');
            grad.addColorStop(1, '#ff7f00');
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = '#1a1a1a';
        }
        ctx.fillText(stat.value, cx, cy + 30);

        // Label
        ctx.font = `600 26px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(26,26,26,0.5)';
        ctx.letterSpacing = '0.08em';
        ctx.fillText(stat.label.toUpperCase(), cx, cy + 75);
        ctx.letterSpacing = '0';

        // Vertical separator
        if (i < statCount - 1) {
            const sepX = cardX + statColW * (i + 1);
            ctx.strokeStyle = 'rgba(26,26,26,0.08)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sepX, statAreaY + 40);
            ctx.lineTo(sepX, statAreaY + statAreaH - 40);
            ctx.stroke();
        }
    });

    // ── Grade badge ──────────────────────────────────────────────
    const badgeY = 680;
    const badgeR = 80;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(W / 2, badgeY, 0, W / 2, badgeY, badgeR + 20);
    glowGrad.addColorStop(0, `${gradeColor}40`);
    glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(W / 2, badgeY, badgeR + 20, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Circle
    ctx.beginPath();
    ctx.arc(W / 2, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = `${gradeColor}18`;
    ctx.fill();
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Grade letter
    ctx.textAlign = 'center';
    ctx.font = `900 96px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = gradeColor;
    ctx.fillText(grade, W / 2, badgeY + 34);

    // Grade label
    ctx.font = `600 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(26,26,26,0.5)';
    ctx.letterSpacing = '0.08em';
    ctx.fillText('GRADE', W / 2, badgeY + 110);
    ctx.letterSpacing = '0';

    // ── Bottom divider ───────────────────────────────────────────
    ctx.strokeStyle = 'rgba(26,26,26,0.06)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 80, 840);
    ctx.lineTo(cardX + cardW - 80, 840);
    ctx.stroke();

    // ── Footer tagline ───────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.font = `500 28px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(26,26,26,0.35)';
    ctx.fillText('Track your push-ups at pushup.hero', W / 2, 905);

    return canvas;
}

// ── Hook ─────────────────────────────────────────────────────────

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
            await navigator.share({
                files: [file],
                title: 'Push-Up Hero',
                text: `I just did ${data.repCount} push-ups and got a ${getGradeLetter(data.averageScore)}! 💪`,
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
