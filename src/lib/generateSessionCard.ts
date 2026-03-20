/**
 * generateSessionCard — Pure canvas utility that renders a shareable
 * 1080×1080 session card. No React dependency.
 */
import { getGradeLetter, getGradeColor } from '@lib/constants';

export interface ShareSessionData {
    repCount: number;
    averageScore: number;
    sessionMode: 'reps' | 'time';
    elapsedTime?: number;
    level: number;
    username: string;
    grade: string;
    numberOfSets?: number;
    bestScore?: number;
    exerciseType?: 'pushup' | 'squat';
    /** Multi-exercise workout fields */
    isMultiExercise?: boolean;
    numberOfExercises?: number;
    /** Per-block summary for the card, e.g. [{label:'Push-ups', reps:3}, {label:'Squats', reps:8}] */
    blockSummaries?: { label: string; reps: number; sets: number; avgScore: number }[];
}

// ── Helpers ──────────────────────────────────────────────────────

function formatTime(seconds?: number): string {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

function formatDate(): string {
    return new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

// ── Rounded rect helper ─────────────────────────────────────────

function trackedRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Canvas card generator ────────────────────────────────────────

export function generateSessionCard(data: ShareSessionData): HTMLCanvasElement {
    const W = 1080;
    const H = 1080;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

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
    trackedRoundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.clip();

    // ── Card border (rounded rect) ──────────────────────────────
    trackedRoundRect(ctx, cardX, cardY, cardW, cardH, r);
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
    ctx.fillText('Push-Up Hero', W / 2, 155);

    // ── Username + Level pill ────────────────────────────────────
    const pillText = `@${data.username}  •  Level ${data.level}`;
    ctx.font = `600 30px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    const pillW = ctx.measureText(pillText).width + 60;
    const pillX = W / 2 - pillW / 2;
    const pillY = 180;
    const pillH = 52;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 100);
    ctx.fillStyle = 'rgba(255, 127, 0, 0.1)';
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(pillText, W / 2, pillY + 34);

    // ── Date + sets badge row ────────────────────────────────────
    const isMulti = data.isMultiExercise === true;
    const tagY = 260;
    ctx.font = `500 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(26,26,26,0.4)';

    const hasSets = data.numberOfSets != null && data.numberOfSets > 1;
    const dateStr = formatDate();

    if (isMulti) {
        // Date + exercises · sets
        const exStr = `${data.numberOfExercises ?? 0} exercises · ${data.numberOfSets ?? 0} sets`;
        const dateW = ctx.measureText(dateStr).width;
        const exW = ctx.measureText(exStr).width;
        const dotW = ctx.measureText(' · ').width;
        const totalW = dateW + dotW + exW;
        const startX = W / 2 - totalW / 2;

        ctx.textAlign = 'left';
        ctx.fillText(dateStr, startX, tagY);
        ctx.fillText(' · ', startX + dateW, tagY);
        ctx.fillStyle = '#ff7f00';
        ctx.font = `700 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(exStr, startX + dateW + dotW, tagY);
    } else if (hasSets) {
        // Date + sets on same line
        const setsStr = `${data.numberOfSets} sets`;
        const dateW = ctx.measureText(dateStr).width;
        const setsW = ctx.measureText(setsStr).width;
        const dotW = ctx.measureText(' · ').width;
        const totalW = dateW + dotW + setsW;
        const startX = W / 2 - totalW / 2;

        ctx.textAlign = 'left';
        ctx.fillText(dateStr, startX, tagY);
        ctx.fillText(' · ', startX + dateW, tagY);
        ctx.fillStyle = '#ff7f00';
        ctx.font = `700 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(setsStr, startX + dateW + dotW, tagY);
    } else {
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, W / 2, tagY);
    }

    // ── Divider ─────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(26,26,26,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 80, 290);
    ctx.lineTo(cardX + cardW - 80, 290);
    ctx.stroke();

    // ── Main stats ───────────────────────────────────────────────
    const grade = getGradeLetter(data.averageScore);
    const gradeColor = getGradeColor(data.averageScore);

    if (isMulti) {
        // ── Multi-exercise layout ──────────────────────────────

        // Duration (big, top)
        const durY = 350;
        ctx.textAlign = 'center';
        const durGrad = ctx.createLinearGradient(W / 2 - 100, durY - 40, W / 2 + 100, durY + 40);
        durGrad.addColorStop(0, '#ffb366');
        durGrad.addColorStop(1, '#ff7f00');
        ctx.fillStyle = durGrad;
        ctx.font = `900 100px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(formatTime(data.elapsedTime), W / 2, durY);
        ctx.font = `600 26px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(26,26,26,0.5)';
        ctx.letterSpacing = '0.08em';
        ctx.fillText('DURATION', W / 2, durY + 45);
        ctx.letterSpacing = '0';

        // Divider below duration
        ctx.strokeStyle = 'rgba(26,26,26,0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cardX + 80, durY + 70);
        ctx.lineTo(cardX + cardW - 80, durY + 70);
        ctx.stroke();

        // 3 stat columns: Total Reps | Grade | Avg Score
        const rowY = durY + 90;
        const rowH = 140;
        const colW = cardW / 3;

        // Total Reps
        const col1X = cardX + colW / 2;
        ctx.textAlign = 'center';
        ctx.font = `900 80px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(String(data.repCount), col1X, rowY + 70);
        ctx.font = `600 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(26,26,26,0.5)';
        ctx.letterSpacing = '0.08em';
        ctx.fillText('TOTAL REPS', col1X, rowY + 110);
        ctx.letterSpacing = '0';

        // Separator
        ctx.strokeStyle = 'rgba(26,26,26,0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cardX + colW, rowY + 15);
        ctx.lineTo(cardX + colW, rowY + rowH - 15);
        ctx.stroke();

        // Grade
        const col2X = cardX + colW + colW / 2;
        ctx.font = `900 80px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = gradeColor;
        ctx.fillText(grade, col2X, rowY + 70);
        ctx.font = `600 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(26,26,26,0.5)';
        ctx.letterSpacing = '0.08em';
        ctx.fillText('GRADE', col2X, rowY + 110);
        ctx.letterSpacing = '0';

        // Separator
        ctx.beginPath();
        ctx.moveTo(cardX + colW * 2, rowY + 15);
        ctx.lineTo(cardX + colW * 2, rowY + rowH - 15);
        ctx.stroke();

        // Avg Score
        const col3X = cardX + colW * 2 + colW / 2;
        ctx.font = `900 80px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(String(data.averageScore), col3X, rowY + 70);
        ctx.font = `600 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(26,26,26,0.5)';
        ctx.letterSpacing = '0.08em';
        ctx.fillText('AVG SCORE', col3X, rowY + 110);
        ctx.letterSpacing = '0';

        // ── Per-block breakdown ──────────────────────────────────
        if (data.blockSummaries && data.blockSummaries.length > 0) {
            const breakdownY = rowY + rowH + 30;

            // Section title
            ctx.font = `700 22px -apple-system, "Helvetica Neue", Arial, sans-serif`;
            ctx.fillStyle = 'rgba(26,26,26,0.4)';
            ctx.letterSpacing = '0.1em';
            ctx.textAlign = 'center';
            ctx.fillText('EXERCISE BREAKDOWN', W / 2, breakdownY);
            ctx.letterSpacing = '0';

            const blockStartY = breakdownY + 20;
            const blockH = 60;
            const blockPadX = cardX + 80;
            const blockContentW = cardW - 160;

            data.blockSummaries.forEach((block, bi) => {
                const by = blockStartY + bi * blockH;

                // Block row background
                trackedRoundRect(ctx, blockPadX, by, blockContentW, blockH - 8, 12);
                ctx.fillStyle = 'rgba(0,0,0,0.03)';
                ctx.fill();

                // Exercise name (left)
                ctx.textAlign = 'left';
                ctx.font = `700 28px -apple-system, "Helvetica Neue", Arial, sans-serif`;
                ctx.fillStyle = '#1a1a1a';
                ctx.fillText(block.label, blockPadX + 20, by + 35);

                // Stats (right): "3 reps · 1 set · S"
                const blockGrade = getGradeLetter(block.avgScore);
                const blockGradeColor = getGradeColor(block.avgScore);
                const statsText = `${block.reps} reps · ${block.sets} set${block.sets > 1 ? 's' : ''} · `;
                ctx.font = `500 24px -apple-system, "Helvetica Neue", Arial, sans-serif`;
                ctx.fillStyle = 'rgba(26,26,26,0.5)';
                ctx.textAlign = 'right';
                const gradeW = 30;
                const rightEdge = blockPadX + blockContentW - 20;
                ctx.fillText(statsText, rightEdge - gradeW, by + 35);

                // Grade letter in color
                ctx.font = `800 28px -apple-system, "Helvetica Neue", Arial, sans-serif`;
                ctx.fillStyle = blockGradeColor;
                ctx.fillText(blockGrade, rightEdge, by + 35);
            });
        }

    } else {
        // ── Single-exercise layout (original) ──────────────────

        // Build stat items based on mode
        type StatItem = { value: string; label: string; accent?: boolean };
        const stats: StatItem[] = [];

        if (data.sessionMode === 'time') {
            stats.push({ value: formatTime(data.elapsedTime), label: 'Duration' });
        }
        const repLabel = data.exerciseType === 'squat' ? 'Squats' : 'Push-ups';
        stats.push({ value: String(data.repCount), label: repLabel, accent: true });
        stats.push({ value: String(data.averageScore), label: 'Avg Score' });
        if (data.bestScore != null && data.bestScore !== data.averageScore) {
            stats.push({ value: String(data.bestScore), label: 'Best Rep' });
        }

        const statCount = stats.length;
        const statAreaY = 320;
        const statAreaH = 260;
        const statColW = cardW / statCount;

        stats.forEach((stat, i) => {
            const cx = cardX + statColW * i + statColW / 2;
            const cy = statAreaY + statAreaH / 2;

            // Value
            ctx.textAlign = 'center';
            ctx.font = `900 ${statCount <= 3 ? 110 : 88}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
            if (stat.accent) {
                const grad = ctx.createLinearGradient(cx - 80, cy - 80, cx + 80, cy + 30);
                grad.addColorStop(0, '#ffb366');
                grad.addColorStop(1, '#ff7f00');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = '#1a1a1a';
            }
            ctx.fillText(stat.value, cx, cy + 20);

            // Label
            ctx.font = `600 26px -apple-system, "Helvetica Neue", Arial, sans-serif`;
            ctx.fillStyle = 'rgba(26,26,26,0.5)';
            ctx.letterSpacing = '0.08em';
            ctx.fillText(stat.label.toUpperCase(), cx, cy + 65);
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

        // ── Grade badge ──────────────────────────────────────────
        const badgeY = 660;
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
    }

    // ── Bottom divider ───────────────────────────────────────────
    ctx.strokeStyle = 'rgba(26,26,26,0.06)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 80, 830);
    ctx.lineTo(cardX + cardW - 80, 830);
    ctx.stroke();

    // ── Footer tagline ───────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.font = `500 28px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(26,26,26,0.35)';
    const tagline = isMulti
        ? 'Track your workouts with Push-Up Hero 💪'
        : data.exerciseType === 'squat'
            ? 'Track your squats with Push-Up Hero 💪'
            : 'Track your push-ups with Push-Up Hero 💪';
    ctx.fillText(tagline, W / 2, 890);

    return canvas;
}
