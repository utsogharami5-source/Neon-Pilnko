import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  lastDropTime: number;
  lastWin: { multiplier: number; timestamp: number } | null;
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  baseAlpha: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    // Slow, drifting movement
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.size = Math.random() * 2 + 1;
    // Neon palette colors
    const colors = ['#3b82f6', '#84cc16', '#a855f7', '#ec4899'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.baseAlpha = Math.random() * 0.15 + 0.05;
    this.alpha = this.baseAlpha;
  }

  update(w: number, h: number) {
    this.x += this.vx;
    this.y += this.vy;

    // Wrap around screen
    if (this.x < 0) this.x = w;
    if (this.x > w) this.x = 0;
    if (this.y < 0) this.y = h;
    if (this.y > h) this.y = 0;
    
    // Reset alpha slowly to base
    if (this.alpha > this.baseAlpha) {
        this.alpha -= 0.01;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.fill();
    
    // Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

class Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  speed: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.radius = 1;
    this.maxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.8;
    this.color = color;
    this.alpha = 0.4;
    this.speed = 8;
  }

  update() {
    this.radius += this.speed;
    this.alpha -= 0.005;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = this.alpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ lastDropTime, lastWin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const wavesRef = useRef<Shockwave[]>([]);
  const requestRef = useRef<number>(0);

  // Initialize particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;

    particlesRef.current = Array.from({ length: 50 }, () => new Particle(w, h));

    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // React to Drop
  useEffect(() => {
    if (lastDropTime === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Spawn wave from top center
    wavesRef.current.push(new Shockwave(canvas.width / 2, 100, '#3b82f6'));
    
    // Excite particles
    particlesRef.current.forEach(p => {
        p.alpha = Math.min(1, p.alpha + 0.3);
    });
  }, [lastDropTime]);

  // React to Win
  useEffect(() => {
    if (!lastWin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let color = '#ef4444'; // Red for loss/low
    if (lastWin.multiplier >= 1) color = '#84cc16'; // Green for profit
    if (lastWin.multiplier > 5) color = '#eab308'; // Gold for big win

    // Spawn wave from bottom center (roughly)
    wavesRef.current.push(new Shockwave(canvas.width / 2, canvas.height - 100, color));
  }, [lastWin]);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw subtle gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#111827');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach(p => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);
      });

      // Update and draw waves
      for (let i = wavesRef.current.length - 1; i >= 0; i--) {
        const wave = wavesRef.current[i];
        wave.update();
        wave.draw(ctx);
        if (wave.alpha <= 0) {
            wavesRef.current.splice(i, 1);
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full z-0 pointer-events-none"
    />
  );
};

export default AnimatedBackground;