import React, { useEffect } from 'react';
import { ShieldCheck, ExternalLink, X, Lock, Database, EyeOff, FileText } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-privacy"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Privacidad y Seguridad</h2>
              <p className="text-xs text-slate-400">Compromiso de protección de datos en AudioCar</p>
            </div>
          </div>

          <button
            id="btn-close-privacy-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/25 text-cyan-100 leading-relaxed">
            AudioCar fue diseñado bajo la premisa de <strong>privacidad total y soberanía de tus archivos</strong>. La aplicación opera en tu dispositivo sin recopilar datos personales ni transmitir tu música a servidores de terceros.
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-xs sm:text-sm">Almacenamiento Local Únicamente</h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Tus ajustes de volumen, ecualizador y cola de reproducción se guardan localmente en tu navegador.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-xs sm:text-sm">Acceso Seguro a Google Drive</h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  El token OAuth solo se usa para leer archivos de audio en tu carpeta <code className="text-cyan-300">/mimusica</code>. No tenemos acceso a tus fotos, documentos o correos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                <EyeOff className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-xs sm:text-sm">Sin Rastreadores ni Publicidad</h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Cero anuncios, cero venta de datos personales y sin scripts de telemetría invasiva.
                </p>
              </div>
            </div>
          </div>

          {/* Links to complete privacy and terms documents */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-semibold transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-300" />
              <span>Ver Política Completa (HTML)</span>
              <ExternalLink className="w-3 h-3 text-cyan-400" />
            </a>

            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Términos de Servicio</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs sm:text-sm font-semibold text-slate-200 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
