import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface EclipseNeonBorderProps {
  isPlaying: boolean;
}

/**
 * Solar Eclipse Corona with Flowing Plasma Light (Corona Solar con Luz en Movimiento)
 * Completely eliminates rigid comb-like teeth/spikes, replacing them with continuous,
 * organic coronal waves, revolving solar prominences, and an incandescent photosphere rim.
 */
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
      // Dynamic time advancement: lively and reactive when playing, serene and continuous when paused
      if (isPlaying) {
        time += 0.02 + smoothIntensity * 0.025;
        colorRotation += 0.008 + smoothIntensity * 0.02;
      } else {
        time += 0.008;
        colorRotation += 0.003;
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
          rawIntensity = 0.22;
          rawBass = 0.28;
        }
      }

      // Smooth interpolation for silky, fluid visual motion
      smoothIntensity += (rawIntensity - smoothIntensity) * 0.15;
      smoothBass += (rawBass - smoothBass) * 0.20;
      smoothTreble += (rawTreble - smoothTreble) * 0.22;

      ctx.clearRect(0, 0, width, height);

      // Solar color palette: cyan, electric blue, solar violet, and incandescent white
      const hueBase = (colorRotation * 60) % 360;
      const solarCyan = `hsla(${hueBase}, 95%, 62%, `;
      const solarViolet = `hsla(${(hueBase + 60) % 360}, 90%, 58%, `;
      const solarGold = `hsla(${(hueBase + 140) % 360}, 95%, 65%, `;

      // =========================================================================
      // 1. DEEP CORONAL AURA (Broad, soft celestial halo)
      // =========================================================================
      const outerGlowRadius = baseRadius * (1.25 + smoothBass * 0.28);
      const outerGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.94,
        centerX,
        centerY,
        outerGlowRadius
      );
      outerGrad.addColorStop(0, `${solarCyan}${0.45 + smoothIntensity * 0.35})`);
      outerGrad.addColorStop(0.35, `${solarViolet}${0.25 + smoothBass * 0.25})`);
      outerGrad.addColorStop(0.7, `${solarGold}${0.10 + smoothTreble * 0.15})`);
      outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // =========================================================================
      // 2. FLOWING ORGANIC CORONAL PLUMES (Continuous fluid waves, NO comb teeth)
      // Multiple undulating, closed plasma envelopes that gently swirl and billow
      // =========================================================================
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const waveLayers = [
        {
          harmonicA: 3,
          harmonicB: 5,
          speedA: 0.7,
          speedB: -1.1,
          ampBase: 14 + smoothIntensity * 16,
          bassBoost: smoothBass * 28,
          color: solarCyan,
          opacity: 0.38 + smoothIntensity * 0.32,
        },
        {
          harmonicA: 4,
          harmonicB: 7,
          speedA: -0.9,
          speedB: 1.4,
          ampBase: 10 + smoothIntensity * 14,
          bassBoost: smoothBass * 22,
          color: solarViolet,
          opacity: 0.32 + smoothBass * 0.28,
        },
        {
          harmonicA: 2,
          harmonicB: 6,
          speedA: 0.5,
          speedB: -0.8,
          ampBase: 18 + smoothIntensity * 22,
          bassBoost: smoothBass * 35,
          color: solarGold,
          opacity: 0.24 + smoothTreble * 0.25,
        },
      ];

      waveLayers.forEach((layer) => {
        const segments = 120; // Silky smooth circular polygon
        const angleStep = (Math.PI * 2) / segments;

        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const a = i * angleStep;

          // Organic celestial harmonic equation
          const wave1 = Math.sin(a * layer.harmonicA + time * layer.speedA);
          const wave2 = Math.cos(a * layer.harmonicB + time * layer.speedB);
          const wave3 = Math.sin(a * 2 - time * 0.4) * 0.5;

          const distortion = (wave1 * 0.55 + wave2 * 0.35 + wave3 * 0.1) * (layer.ampBase + layer.bassBoost);
          const currentR = baseRadius + Math.max(0, distortion);

          const px = centerX + Math.cos(a) * currentR;
          const py = centerY + Math.sin(a) * currentR;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();

        // Fluid gradient radiating from photosphere outward
        const plumeGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          baseRadius * 0.98,
          centerX,
          centerY,
          baseRadius + layer.ampBase + layer.bassBoost + 12
        );
        plumeGrad.addColorStop(0, `${layer.color}${layer.opacity})`);
        plumeGrad.addColorStop(0.5, `${layer.color}${layer.opacity * 0.45})`);
        plumeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = plumeGrad;
        ctx.fill();
      });
      ctx.restore();

      // =========================================================================
      // 3. MOVING SOLAR PROMINENCES / REVOLVING LIGHT ARCS (Luz en movimiento)
      // Luminous arcs that gracefully drift and orbit along the eclipse edge
      // =========================================================================
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const prominences = [
        {
          angle: time * 0.45,
          span: 0.85,
          width: 8 + smoothBass * 14,
          glow: 26 + smoothBass * 20,
          color: solarCyan,
        },
        {
          angle: time * -0.32 + 2.4,
          span: 0.65,
          width: 6 + smoothTreble * 12,
          glow: 22 + smoothTreble * 18,
          color: solarViolet,
        },
        {
          angle: time * 0.22 + 4.2,
          span: 1.05,
          width: 10 + smoothIntensity * 16,
          glow: 30 + smoothIntensity * 24,
          color: solarGold,
        },
      ];

      prominences.forEach((p) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + p.width * 0.35, p.angle, p.angle + p.span);
        ctx.strokeStyle = `${p.color}0.75)`;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.shadowColor = `${p.color}1)`;
        ctx.shadowBlur = p.glow;
        ctx.stroke();
      });
      ctx.restore();

      // =========================================================================
      // 4. INCANDESCENT PHOTOSPHERE RIM (Crisp, blinding solar silhouette edge)
      // =========================================================================
      ctx.save();
      // Outer neon rim
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `${solarCyan}0.95)`;
      ctx.lineWidth = 3.2 + smoothBass * 3.8;
      ctx.shadowColor = `${solarCyan}1)`;
      ctx.shadowBlur = 18 + smoothBass * 22;
      ctx.stroke();

      // Core white-hot razor edge
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10 + smoothTreble * 10;
      ctx.stroke();
      ctx.restore();

      // =========================================================================
      // 5. DIAMOND RING EFFECT & SOLAR FLARE BURST (Anillo de Diamante)
      // A brilliant focal flare that slowly glides around the eclipse circumference
      // =========================================================================
      const diamondAngle = -Math.PI / 4 + Math.sin(time * 0.35) * 0.5;
      const diamondX = centerX + Math.cos(diamondAngle) * baseRadius;
      const diamondY = centerY + Math.sin(diamondAngle) * baseRadius;
      const diamondScale = 1 + smoothBass * 1.5 + smoothTreble * 0.8;

      // Radiant point flare
      const diamondGlow = ctx.createRadialGradient(
        diamondX,
        diamondY,
        1,
        diamondX,
        diamondY,
        34 * diamondScale
      );
      diamondGlow.addColorStop(0, '#ffffff');
      diamondGlow.addColorStop(0.18, `${solarCyan}0.95)`);
      diamondGlow.addColorStop(0.55, `${solarViolet}0.35)`);
      diamondGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.save();
      ctx.fillStyle = diamondGlow;
      ctx.beginPath();
      ctx.arc(diamondX, diamondY, 34 * diamondScale, 0, Math.PI * 2);
      ctx.fill();

      // Anamorphic horizontal lens flare streak
      ctx.translate(diamondX, diamondY);
      ctx.rotate(diamondAngle + Math.PI / 2);

      const flareStreakLen = (28 + smoothIntensity * 36) * diamondScale;
      const streakGrad = ctx.createLinearGradient(-flareStreakLen, 0, flareStreakLen, 0);
      streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      streakGrad.addColorStop(0.5, '#ffffff');
      streakGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.strokeStyle = streakGrad;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-flareStreakLen, 0);
      ctx.lineTo(flareStreakLen, 0);
      ctx.stroke();

      // Sparkling star center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.8 * diamondScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Seamless continuous 60fps animation loop (always active so light stays in motion)
      animationFrameId = requestAnimationFrame(render);
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
