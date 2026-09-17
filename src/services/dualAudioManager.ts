/**
 * DualAudioManager.ts
 * Arquitectura de Doble Buffer para Gapless Playback y mitigación de pérdida de Audio Focus.
 */

export interface DualAudioChannel {
  id: string;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  isLoaded: boolean;
}

export interface DualAudioManagerOptions {
  onTrackEnded?: (nextTrack: any) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPreloadRequired?: () => void;
  crossfadeDuration?: number;
}

export class DualAudioManager {
  public crossfadeDuration: number;
  public onTrackEnded?: (nextTrack: any) => void;
  public onTimeUpdate?: (currentTime: number, duration: number) => void;
  public onPreloadRequired?: () => void;

  // Web Audio API Singleton
  public ctx: AudioContext;

  // Grafo Master (Compresor de protección y Gain Master)
  public masterGain: GainNode;
  public compressor: DynamicsCompressorNode;

  // Instanciación de canales Dual Audio
  public channelA: DualAudioChannel;
  public channelB: DualAudioChannel;

  public activeChannel: DualAudioChannel;
  public idleChannel: DualAudioChannel;

  public preprimedTrack: any = null;
  public isTransitioning: boolean = false;

  constructor(options: DualAudioManagerOptions = {}) {
    this.crossfadeDuration = options.crossfadeDuration ?? 1.5;
    this.onTrackEnded = options.onTrackEnded;
    this.onTimeUpdate = options.onTimeUpdate;
    this.onPreloadRequired = options.onPreloadRequired;

    // Web Audio API Singleton
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Grafo Master (Compresor de protección y Gain Master)
    this.masterGain = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Instanciación de canales Dual Audio
    this.channelA = this._createChannel('channelA');
    this.channelB = this._createChannel('channelB');

    this.activeChannel = this.channelA;
    this.idleChannel = this.channelB;
  }

  private _createChannel(id: string): DualAudioChannel {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.id = id;

    const source = this.ctx.createMediaElementSource(audio);
    const gainNode = this.ctx.createGain();

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    const channel: DualAudioChannel = { audio, source, gainNode, isLoaded: false, id };

    audio.addEventListener('timeupdate', () => {
      if (this.activeChannel === channel) {
        const remaining = audio.duration - audio.currentTime;

        // Disparar pre-priming del códec si faltan menos de 8s y no se ha cargado la siguiente
        if (remaining <= 8 && remaining > 0 && !this.idleChannel.isLoaded && this.onPreloadRequired) {
          this.onPreloadRequired();
        }

        // Ejecutar relevo/crossfade cuando reste el tiempo de transición
        if (remaining <= this.crossfadeDuration && remaining > 0 && !this.isTransitioning && this.idleChannel.isLoaded) {
          this.performTransition();
        }

        if (this.onTimeUpdate) {
          this.onTimeUpdate(audio.currentTime, audio.duration);
        }
      }
    });

    audio.addEventListener('ended', () => {
      if (this.activeChannel === channel && !this.isTransitioning) {
        this.performTransition();
      }
    });

    return channel;
  }

  /**
   * Prepara y calienta el decodificador de hardware con el siguiente Blob URL
   */
  async preprimeNextTrack(blobUrl: string, trackMetadata?: any) {
    if (!blobUrl) return;

    try {
      this.idleChannel.audio.src = blobUrl;
      this.idleChannel.gainNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.idleChannel.audio.load(); // Fuerza calentamiento del códec físico
      this.idleChannel.isLoaded = true;
      this.preprimedTrack = trackMetadata;
    } catch (err) {
      console.error('[AudioEngine] Error en pre-priming de códec:', err);
      this.idleChannel.isLoaded = false;
    }
  }

  /**
   * Transición Gapless / Crossfade sin liberar el hilo de audio
   */
  async performTransition() {
    if (this.isTransitioning || !this.idleChannel.isLoaded) return;
    this.isTransitioning = true;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const fadeOutDuration = this.crossfadeDuration;
    const incoming = this.idleChannel;
    const outgoing = this.activeChannel;

    // Rampa descendente en pista saliente (evita chasquido)
    outgoing.gainNode.gain.cancelScheduledValues(now);
    outgoing.gainNode.gain.setValueAtTime(outgoing.gainNode.gain.value || 1.0, now);
    outgoing.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);

    // Iniciar pista entrante inmediatamente para mantener Audio Focus activo
    incoming.audio.currentTime = 0;
    incoming.gainNode.gain.cancelScheduledValues(now);
    incoming.gainNode.gain.setValueAtTime(0.0001, now);
    incoming.gainNode.gain.linearRampToValueAtTime(1.0, now + fadeOutDuration);

    try {
      await incoming.audio.play();
    } catch (err) {
      console.error('[AudioEngine] Fallo al iniciar canal entrante:', err);
    }

    setTimeout(() => {
      // Detener y resetear canal saliente
      outgoing.audio.pause();
      outgoing.audio.removeAttribute('src');
      outgoing.audio.load();
      outgoing.isLoaded = false;

      // Invertir referencias de canal
      this.activeChannel = incoming;
      this.idleChannel = outgoing;
      this.isTransitioning = false;

      if (this.onTrackEnded) {
        this.onTrackEnded(this.preprimedTrack);
      }
      this.preprimedTrack = null;
    }, fadeOutDuration * 1000);
  }

  /**
   * Reproducción inicial directa
   */
  async playDirect(blobUrl: string) {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.activeChannel.audio.src = blobUrl;
    this.activeChannel.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.activeChannel.isLoaded = true;
    await this.activeChannel.audio.play();
  }
}
