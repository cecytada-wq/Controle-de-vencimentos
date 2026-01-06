
import React, { useRef, useState } from 'react';
import { Camera, Scan, Sparkles, X, RotateCw, CheckCircle } from 'lucide-react';
import { scanProductFromImage } from '../services/geminiService';

interface SmartAddProps {
  onScanComplete: (data: { name: string; expiryDate: string; category: string }) => void;
  onClose: () => void;
}

const SmartAdd: React.FC<SmartAddProps> = ({ onScanComplete, onClose }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
        setCapturedImage(base64);
        stopCamera();
      }
    }
  };

  const handleScan = async () => {
    if (!capturedImage) return;
    setIsScanning(true);
    try {
      const result = await scanProductFromImage(capturedImage);
      onScanComplete(result);
      onClose();
    } catch (err) {
      setError("Falha ao analisar imagem. Tente novamente.");
      setCapturedImage(null);
    } finally {
      setIsScanning(false);
    }
  };

  React.useEffect(() => {
    startCamera();
    return stopCamera;
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[60] flex flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Scanner AI</span>
        </div>
        <button onClick={onClose} className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <X className="w-7 h-7" />
        </button>
      </div>

      <div className="relative w-full max-w-lg aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.3)] border-2 border-white/10">
        {!capturedImage ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
          <img 
            src={`data:image/jpeg;base64,${capturedImage}`} 
            alt="Captured" 
            className="w-full h-full object-cover" 
          />
        )}

        {/* Framing Guide */}
        {!capturedImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-dashed border-indigo-400/50 rounded-2xl flex items-center justify-center">
              <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest bg-slate-950/60 px-3 py-1.5 rounded-full">
                Alinhe o rótulo
              </span>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-6">
            <RotateCw className="w-16 h-16 text-indigo-400 animate-spin" />
            <div className="text-center">
              <p className="font-black text-lg tracking-wide uppercase">Analisando</p>
              <p className="text-slate-400 text-sm">O Gemini está lendo os dados...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 px-6 py-3 bg-rose-500/20 text-rose-200 border border-rose-500/50 rounded-2xl text-sm font-bold">
          {error}
        </div>
      )}

      <div className="mt-10 flex items-center gap-6">
        {!capturedImage ? (
          <button 
            onClick={capturePhoto}
            className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
          >
            <div className="w-20 h-20 border-4 border-slate-900 rounded-full flex items-center justify-center">
              <Camera className="w-10 h-10 text-slate-900" />
            </div>
          </button>
        ) : (
          <div className="flex gap-4">
            <button 
              onClick={() => { setCapturedImage(null); startCamera(); }}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl flex items-center gap-2 transition-all"
            >
              Refazer
            </button>
            <button 
              onClick={handleScan}
              disabled={isScanning}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-3 shadow-2xl shadow-indigo-500/40 transition-all active:scale-95"
            >
              <Scan className="w-6 h-6" />
              Processar AI
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-slate-500 text-xs max-w-xs text-center font-medium leading-relaxed uppercase tracking-tighter">
        Dica: fotos nítidas e com boa luz <br/> garantem leitura perfeita.
      </p>
    </div>
  );
};

export default SmartAdd;
