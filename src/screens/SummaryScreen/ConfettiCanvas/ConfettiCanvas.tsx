import { useEffect, useRef } from 'react';
import './ConfettiCanvas.scss';

const PARTICLE_COUNT = 60;

// Arena palette: ember, gold, good, ice, purple, blood, ember-solid
const CONFETTI_COLORS = ['#ff7a47', '#f5c871', '#4ae8a0', '#7fc5ff', '#bb8cff', '#ff5577', '#ff5a1f'];

function createParticles(canvas: HTMLCanvasElement) {
    const W = canvas.width;
    const H = canvas.height;
    return Array.from({ length: PARTICLE_COUNT }, () => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5,
        y: H / 2 + (Math.random() - 0.5) * H * 0.3,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 8 + 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        gravity: 0.4,
        opacity: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
    }));
}

interface ConfettiCanvasProps {
    goalReached: boolean;
}

export function ConfettiCanvas({ goalReached }: ConfettiCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | null>(null);

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

    if (!goalReached) return null;

    return <canvas ref={canvasRef} className="summary-confetti-canvas" />;
}
