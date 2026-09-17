import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface EclipseNeonBorderProps {
  isPlaying: boolean;
}

export function EclipseNeonBorder({ isPlaying }: EclipseNeonBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    let smoothIntensity = 0;
    let smoothBass = 0;
    let smoothTreble = 0;
    let colorRotation = 0;

    const render = () => {
      if (isPlaying) {
        time += 0.025;
        colorRotation += 0.01 + smoothIntensity * 0.04;
      }

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = (width / 2) * 0.81;

      let rawIntensity = 0;
      let rawBass = 0;
      let rawTreble = 0;
      let freqBins: Uint8Array | null = null;

      try {
        freqBins = audioEngine.getVisualizerData();
        if (freqBins && freqBins.length > 0 && isPlaying) {
          let sum = 0;
          let bassSum = 0;
          let trebleSum = 0;
          const bassEnd = Math.min(14, freqBins.length);
          const trebleStart = Math.max(0, freqBins.length - 24);

          for (let i = 0; i < freqBins.length; i++) {
            const val = freqBins[i];
            sum += val;
            if (i < bassEnd) bassSum += val;
            if (i >= trebleStart) trebleSum += val;
          }

          rawIntensity = sum / (freqBins.length * 255);
          rawBass = bassSum / (bassEnd * 255);
          rawTreble = trebleSum / ((freqBins.length - trebleStart) * 255);
        } else if (isPlaying) {
          rawIntensity = 0.2 + Math.sin(time * 2) * 0.08;
          rawBass = 0.25 + Math.sin(time * 3) * 0.12;
          rawTreble = 0.15 + Math.cos(time * 4) * 0.08;
        }
      } catch {
        if (isPlaying) {
          rawIntensity = 0.25;
          rawBass = 0.3;
        }
      }

      smoothIntensity += (rawIntensity - smoothIntensity) * 0.18;
      smoothBass += (rawBass - smoothBass) * 0.22;
      smoothTreble += (rawTreble - smoothTreble) * 0.25;

      ctx.clearRect(0, 0, width, height);

      const hueBase = (colorRotation * 60) % 360;
      const primaryColor = `hsl(${hueBase}, 100%, ${55 + smoothIntensity * 20}%)`;
      const secondaryColor = `hsl(${(hueBase + 75) % 360}, 95%, 60%)`;
      const tertiaryColor = `hsl(${(hueBase + 160) % 360}, 100%, 65%)`;

      // 1. OUTER CORONA AURA
      const outerGlowRadius = baseRadius * (1.15 + smoothBass * 0.3);
      const outerGrad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.95, centerX, centerY, outerGlowRadius);
      outerGrad.addColorStop(0, `hsla(${hueBase}, 100%, 60%, ${0.35 + smoothIntensity * 0.4})`);
      outerGrad.addColorStop(0.5, `hsla(${(hueBase + 60) % 360}, 90%, 55%, ${0.18 + smoothBass * 0.25})`);
      outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. CORONA STREAMERS
      const rayCount = isPlaying ? 90 : 45; // fewer rays when paused for performance
      const angleStep = (Math.PI * 2) / rayCount;

      ctx.save();
      for (let i = 0; i < rayCount; i++) {
        const angle = i * angleStep + time * 0.2;
        
        let freqVal = 0;
        if (freqBins && freqBins.length > 0 && isPlaying) {
          const binIdx = Math.floor((i / rayCount) * (freqBins.length / 2));
          freqVal = (freqBins[binIdx] || 0) / 255;
        } else if (isPlaying) {
          freqVal = 0.2 + 0.2 * Math.sin(i * 0.3 + time * 3);
        }

        const baseRayLen = 8 + smoothIntensity * 12;
        const reactiveRayLen = freqVal * (25 + smoothBass * 45);
        const noiseWobble = Math.sin(i * 7 + time * 4) * (3 + smoothTreble * 8);
        const rayLength = isPlaying ? (baseRayLen + reactiveRayLen + noiseWobble) : 10;

        const startX = centerX + Math.cos(angle) * (baseRadius - 2);
        const startY = centerY + Math.sin(angle) * (baseRadius - 2);
        const endX = centerX + Math.cos(angle) * (baseRadius + rayLength);
        const endY = centerY + Math.sin(angle) * (baseRadius + rayLength);

        const rayHue = (hueBase + (i / rayCount) * 120 + smoothIntensity * 50) % 360;
        const rayAlpha = isPlaying ? Math.min(1, 0.25 + freqVal * 0.65 + smoothIntensity * 0.35) : 0.2;

        ctx.strokeStyle = `hsla(${rayHue}, 100%, ${65 + freqVal * 25}%, ${rayAlpha})`;
        ctx.lineWidth = 1.6 + smoothBass * 1.8;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      ctx.restore();

      // 3. INNER NEON CORONA RIM
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3 + smoothBass * 4;
      ctx.shadowColor = secondaryColor;
      ctx.shadowBlur = 18 + smoothBass * 28;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 1, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = tertiaryColor;
      ctx.shadowBlur = 8 + smoothTreble * 12;
      ctx.stroke();
      ctx.restore();

      // 4. DIAMOND RING EFFECT
      const diamondAngle = -Math.PI / 4 + Math.sin(time * 0.4) * 0.35;
      const diamondX = centerX + Math.cos(diamondAngle) * baseRadius;
      const diamondY = centerY + Math.sin(diamondAngle) * baseRadius;
      const diamondScale = 1 + smoothBass * 1.6 + smoothTreble * 0.8;

      const diamondGlow = ctx.createRadialGradient(diamondX, diamondY, 1, diamondX, diamondY, 28 * diamondScale);
      diamondGlow.addColorStop(0, '#ffffff');
      diamondGlow.addColorStop(0.2, primaryColor);
      diamondGlow.addColorStop(0.6, `hsla(${hueBase}, 100%, 70%, 0.3)`);
      diamondGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = diamondGlow;
      ctx.beginPath();
      ctx.arc(diamondX, diamondY, 28 * diamondScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(diamondX, diamondY);
      ctx.rotate(time * 0.5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 12;

      const starLen = (14 + smoothIntensity * 22) * diamondScale;

      ctx.beginPath();
      ctx.moveTo(-starLen, 0);
      ctx.lineTo(starLen, 0);
      ctx.moveTo(0, -starLen);
      ctx.lineTo(0, starLen);
      ctx.moveTo(-starLen * 0.45, -starLen * 0.45);
      ctx.lineTo(starLen * 0.45, starLen * 0.45);
      ctx.moveTo(-starLen * 0.45, starLen * 0.45);
      ctx.lineTo(starLen * 0.45, -starLen * 0.45);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5 * diamondScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Only continue loop if playing
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <div
      id="eclipse-neon-wrapper"
      className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10"
    >
      <canvas
        ref={canvasRef}
        width={760}
        height={760}
        className="w-[460px] h-[460px] sm:w-[620px] sm:h-[620px] md:w-[700px] md:h-[700px] lg:w-[760px] lg:h-[760px] max-w-none transition-transform duration-300"
      />
    </div>
  );
}
