import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  speedX: number;
  speedY: number;
}

interface Comet {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  width: number;
  color: string;
  trail: { x: number; y: number; opacity: number }[];
}

export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Handle resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };
    window.addEventListener('resize', handleResize);

    // Color palette for stars
    const starColors = [
      '#ffffff',
      '#e0f2fe', // sky-100
      '#bae6fd', // sky-200
      '#7dd3fc', // sky-300
      '#c4b5fd', // purple-300
      '#fde68a', // amber-200
      '#67e8f9'  // cyan-300
    ];

    // Initialize Stars
    let stars: Star[] = [];
    const initStars = () => {
      const starCount = Math.floor((width * height) / 3200);
      stars = [];
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.8 + 0.5,
          baseAlpha: Math.random() * 0.7 + 0.3,
          alpha: Math.random() * 0.7 + 0.3,
          twinkleSpeed: Math.random() * 0.03 + 0.008,
          twinklePhase: Math.random() * Math.PI * 2,
          color: starColors[Math.floor(Math.random() * starColors.length)],
          speedX: (Math.random() - 0.5) * 0.15,
          speedY: (Math.random() - 0.5) * 0.15
        });
      }
    };
    initStars();

    // Comets management
    const comets: Comet[] = [];
    let lastCometSpawn = Date.now();

    const spawnComet = () => {
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.4; // diagonal ~45 degrees
      const startSide = Math.random() > 0.5 ? 'top' : 'left';
      
      const x = startSide === 'top' ? Math.random() * width : -50;
      const y = startSide === 'top' ? -50 : Math.random() * (height * 0.6);

      const cometColors = ['#38bdf8', '#818cf8', '#a78bfa', '#34d399', '#fef08a'];

      comets.push({
        x,
        y,
        length: Math.random() * 120 + 80,
        speed: Math.random() * 6 + 7,
        angle,
        opacity: 1,
        width: Math.random() * 1.8 + 1.2,
        color: cometColors[Math.floor(Math.random() * cometColors.length)],
        trail: []
      });
    };

    // Distant Planet 1: Ringed Gas Giant (Saturn-like exoplanet)
    const planet1 = {
      xPercent: 0.82,
      yPercent: 0.18,
      radius: 42,
      glowColor: '#38bdf8'
    };

    // Distant Planet 2: Glowing Mysterious Crescent Moon
    const planet2 = {
      xPercent: 0.14,
      yPercent: 0.78,
      radius: 28,
      glowColor: '#a855f7'
    };

    // Animation Loop
    let time = 0;
    const render = () => {
      time += 0.02;

      // Sample real-time audio intensity if available
      let audioBoost = 0;
      let bassBoost = 0;
      try {
        const audioData = audioEngine.getVisualizerData();
        if (audioData && audioData.length > 0) {
          let sum = 0;
          let bassSum = 0;
          const bassRange = Math.min(12, audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i];
            if (i < bassRange) bassSum += audioData[i];
          }
          const avg = sum / (audioData.length * 255);
          const bassAvg = bassSum / (bassRange * 255);
          audioBoost = avg;
          bassBoost = bassAvg;
        }
      } catch {}

      // Clear with deep space canvas
      ctx.fillStyle = '#03060d';
      ctx.fillRect(0, 0, width, height);

      // 1. Distant Cosmic Nebula Clouds
      const nebula1X = width * 0.25 + Math.sin(time * 0.3) * 20;
      const nebula1Y = height * 0.3 + Math.cos(time * 0.2) * 20;
      const grad1 = ctx.createRadialGradient(nebula1X, nebula1Y, 10, nebula1X, nebula1Y, 350 + bassBoost * 60);
      grad1.addColorStop(0, `rgba(14, 116, 144, ${0.12 + audioBoost * 0.08})`); // cyan
      grad1.addColorStop(0.5, `rgba(67, 56, 202, ${0.08 + audioBoost * 0.05})`); // indigo
      grad1.addColorStop(1, 'rgba(3, 6, 13, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      const nebula2X = width * 0.75 + Math.cos(time * 0.25) * 25;
      const nebula2Y = height * 0.7 + Math.sin(time * 0.25) * 25;
      const grad2 = ctx.createRadialGradient(nebula2X, nebula2Y, 10, nebula2X, nebula2Y, 400 + bassBoost * 70);
      grad2.addColorStop(0, `rgba(109, 40, 217, ${0.1 + audioBoost * 0.07})`); // purple
      grad2.addColorStop(0.6, `rgba(15, 23, 42, ${0.05 + audioBoost * 0.03})`);
      grad2.addColorStop(1, 'rgba(3, 6, 13, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Distant Planets
      // Planet 1: Ringed Exoplanet
      const p1X = width * planet1.xPercent;
      const p1Y = height * planet1.yPercent;
      
      // Atmospheric Glow
      const p1Glow = ctx.createRadialGradient(p1X, p1Y, planet1.radius * 0.8, p1X, p1Y, planet1.radius * 2.5);
      p1Glow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      p1Glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = p1Glow;
      ctx.beginPath();
      ctx.arc(p1X, p1Y, planet1.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Planet Sphere Body
      const p1Body = ctx.createRadialGradient(p1X - planet1.radius * 0.35, p1Y - planet1.radius * 0.35, planet1.radius * 0.1, p1X, p1Y, planet1.radius);
      p1Body.addColorStop(0, '#38bdf8');
      p1Body.addColorStop(0.4, '#0369a1');
      p1Body.addColorStop(0.85, '#082f49');
      p1Body.addColorStop(1, '#020617');
      ctx.fillStyle = p1Body;
      ctx.beginPath();
      ctx.arc(p1X, p1Y, planet1.radius, 0, Math.PI * 2);
      ctx.fill();

      // Planet Planetary Rings
      ctx.save();
      ctx.translate(p1X, p1Y);
      ctx.rotate(-0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, planet1.radius * 2.2, planet1.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, planet1.radius * 2.5, planet1.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Planet 2: Glowing Crescent Moon / Exoplanet
      const p2X = width * planet2.xPercent;
      const p2Y = height * planet2.yPercent;

      const p2Glow = ctx.createRadialGradient(p2X, p2Y, planet2.radius * 0.7, p2X, p2Y, planet2.radius * 2.2);
      p2Glow.addColorStop(0, 'rgba(168, 85, 247, 0.22)');
      p2Glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = p2Glow;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, planet2.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      const p2Body = ctx.createRadialGradient(p2X - planet2.radius * 0.3, p2Y - planet2.radius * 0.3, planet2.radius * 0.1, p2X, p2Y, planet2.radius);
      p2Body.addColorStop(0, '#c084fc');
      p2Body.addColorStop(0.5, '#7e22ce');
      p2Body.addColorStop(1, '#05020c');
      ctx.fillStyle = p2Body;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, planet2.radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw & Animate Stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Star drift
        s.x += s.speedX * (1 + audioBoost * 1.5);
        s.y += s.speedY * (1 + audioBoost * 1.5);
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        // Twinkle
        s.twinklePhase += s.twinkleSpeed;
        const twinkle = Math.sin(s.twinklePhase);
        const dynamicAlpha = Math.max(0.1, Math.min(1, s.baseAlpha + twinkle * 0.3 + audioBoost * 0.25));

        ctx.fillStyle = s.color;
        ctx.globalAlpha = dynamicAlpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (1 + bassBoost * 0.3), 0, Math.PI * 2);
        ctx.fill();

        // Extra twinkle cross for brighter stars
        if (s.size > 1.8 && dynamicAlpha > 0.75) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - 3, s.y);
          ctx.lineTo(s.x + 3, s.y);
          ctx.moveTo(s.x, s.y - 3);
          ctx.lineTo(s.x, s.y + 3);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 4. Comets / Shooting Stars Spawning & Rendering
      const now = Date.now();
      if (now - lastCometSpawn > 3200 + Math.random() * 4000) {
        spawnComet();
        lastCometSpawn = now;
      }

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        const vx = Math.cos(c.angle) * c.speed;
        const vy = Math.sin(c.angle) * c.speed;

        c.x += vx;
        c.y += vy;

        // Add to trail
        c.trail.unshift({ x: c.x, y: c.y, opacity: c.opacity });
        if (c.trail.length > 25) c.trail.pop();

        // Fade out
        c.opacity -= 0.008;

        // Draw trail
        if (c.trail.length > 1) {
          ctx.save();
          for (let t = 0; t < c.trail.length - 1; t++) {
            const p1 = c.trail[t];
            const p2 = c.trail[t + 1];
            const segAlpha = (1 - t / c.trail.length) * c.opacity * 0.8;
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = c.color;
            ctx.globalAlpha = Math.max(0, segAlpha);
            ctx.lineWidth = c.width * (1 - t / c.trail.length);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw Comet Nucleus / Glowing Head
        const headGlow = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, 8);
        headGlow.addColorStop(0, '#ffffff');
        headGlow.addColorStop(0.3, c.color);
        headGlow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Remove off-screen or faded comets
        if (c.opacity <= 0 || c.x > width + 100 || c.y > height + 100) {
          comets.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="space-background-canvas"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
