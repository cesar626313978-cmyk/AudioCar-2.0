import React, { useState, useEffect } from 'react';
import { Coffee, Copy, Check, ExternalLink, X, Heart, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';

interface CoffeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoffeeModal: React.FC<CoffeeModalProps> = ({ isOpen, onClose }) => {
  const [copiedRevolut, setCopiedRevolut] = useState(false);
  const [copiedBizum, setCopiedBizum] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showBizumNumber, setShowBizumNumber] = useState(false);

  const revolutUrl = 'https://revolut.me/csar1rzy4';
  const revolutUsername = '@csar1rzy4';
  const bizumPhone = '626313978';

  // Generate crisp QR code on modal open
  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(revolutUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('Error generating Revolut QR code:', err));
    }
  }, [isOpen]);

  // Handle escape key
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

  const copyToClipboard = async (text: string, type: 'revolut' | 'bizum') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      if (type === 'revolut') {
        setCopiedRevolut(true);
        setTimeout(() => setCopiedRevolut(false), 3000);
      } else {
        setCopiedBizum(true);
        setTimeout(() => setCopiedBizum(false), 3000);
      }
    } catch (e) {
      console.warn('Failed to copy to clipboard', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-coffee-donation"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] text-white overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-400/40 flex items-center justify-center shadow-inner">
              <Coffee className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                Invitar a un café
                <Heart className="w-4 h-4 text-rose-400 fill-rose-400 inline" />
              </h2>
              <p className="text-xs text-slate-400">Apoya el desarrollo de AudioCar</p>
            </div>
          </div>

          <button
            id="btn-close-coffee-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Friendly Note */}
          <div className="bg-amber-950/30 border border-amber-500/25 rounded-2xl p-3.5 text-amber-200/90 text-xs sm:text-[13px] leading-relaxed">
            ¡Muchas gracias por usar <strong>AudioCar</strong>! Si la música y la experiencia te acompañan en tus viajes, puedes invitarme a un café a través de <strong>Revolut</strong> o por <strong>Bizum</strong>.
          </div>

          {/* OPTION 1: REVOLUT */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white text-black font-black flex items-center justify-center text-sm shadow">
                  R
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Revolut</h3>
                  <span className="text-[11px] text-cyan-400 font-mono">{revolutUsername}</span>
                </div>
              </div>

              <a
                href={revolutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold transition-all shadow-md"
              >
                <span>Abrir enlace</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Requested Text */}
            <p className="text-xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-xl p-3 font-mono">
              ¡Hola! Puedes enviarme dinero en Revolut a través de este enlace:{' '}
              <span className="text-amber-300 font-bold underline">revolut.me/csar1rzy4</span>
            </p>

            {/* QR Code Container */}
            {qrDataUrl && (
              <div className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="relative p-2.5 bg-white rounded-2xl shadow-xl">
                  <img
                    src={qrDataUrl}
                    alt="Revolut QR Code @csar1rzy4"
                    className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-9 h-9 bg-white border-2 border-black rounded-lg flex items-center justify-center shadow-lg font-black text-black text-base">
                      R
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  <span className="font-mono text-xs font-bold text-slate-300">{revolutUsername}</span>
                  <p className="text-[10px] text-slate-400">Escanea con la cámara de tu móvil para enviar por Revolut</p>
                </div>
              </div>
            )}

            {/* Action buttons for Revolut */}
            <button
              id="btn-copy-revolut-link"
              onClick={() => copyToClipboard('revolut.me/csar1rzy4', 'revolut')}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
            >
              {copiedRevolut ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Enlace copiado al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar enlace de Revolut</span>
                </>
              )}
            </button>
          </div>

          {/* OPTION 2: BIZUM (Número protegido y oculto a la vista) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Bizum</h3>
                  <span className="text-[11px] text-slate-400">Transferencia instantánea</span>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Número Oculto
              </span>
            </div>

            {/* Display where number is masked as strictly requested */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium">Número para Bizum:</span>
                <span className="font-mono text-sm sm:text-base font-bold text-emerald-300 tracking-widest">
                  {showBizumNumber ? bizumPhone : '••••••••• (Oculto)'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowBizumNumber(!showBizumNumber)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline shrink-0 px-2 py-1"
              >
                {showBizumNumber ? 'Ocultar' : 'Ver número'}
              </button>
            </div>

            {/* Direct Copy Button for Bizum */}
            <button
              id="btn-copy-bizum-number"
              onClick={() => copyToClipboard(bizumPhone, 'bizum')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition-all shadow-md"
            >
              {copiedBizum ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Número copiado! Listo para pegar en tu app de banco</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar número de Bizum</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Al tocar &ldquo;Copiar número&rdquo; se copia al portapapeles sin necesidad de visualizarlo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs sm:text-sm font-semibold text-slate-200 transition-all"
          >
            Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
