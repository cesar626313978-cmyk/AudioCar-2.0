/**
 * Audio Spectrum Visualizer Component - Sophisticated Dark
 * Optimized for 60fps automotive screens using HTML5 Canvas & Web Audio Analyser
 */

import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barColor?: string;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  barColor = '#FFFFFF',
  height = 80
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars = 36;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      const data = audioEngine.getVisualizerData();

      const barWidth = (width / bars) * 0.7;
      const gap = (width / bars) * 0.3;

      for (let i = 0; i < bars; i++) {
        let barHeight = 4; // minimum height idle line

        if (isPlaying) {
          if (data && data.length > 0) {
            const dataIndex = Math.floor((i / bars) * (data.length * 0.75));
            const val = data[dataIndex] || 0;
            barHeight = Math.max(4, (val / 255) * h * 0.85);
          } else {
            // Ambient wave fallback if AnalyserNode is cross-origin
            const time = Date.now() / 240;
            const sine = Math.sin(time + i * 0.35);
            barHeight = 6 + Math.abs(sine) * (h * 0.55);
          }
        }

        const x = i * (barWidth + gap) + gap / 2;
        const y = h - barHeight;

        // Monochrome gradient for Sophisticated Dark look
        const gradient = ctx.createLinearGradient(0, y, 0, h);
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.5, barColor);
        gradient.addColorStop(1, '#262626');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();

        // Subtle bottom reflection glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, h - 2, barWidth, 2);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, barColor, height]);

  return (
    <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/60 border border-neutral-800 px-3 py-1.5">
      <canvas
        ref={canvasRef}
        width={480}
        height={height}
        className="w-full h-full block"
      />
    </div>
  );
};

