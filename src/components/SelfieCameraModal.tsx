import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { compressCanvasToBlob } from '../lib/geo';

interface SelfieCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob, previewUrl: string) => void;
}

export const SelfieCameraModal: React.FC<SelfieCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Start front camera stream
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Direct front camera selfie only
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      let message = 'No se pudo acceder a la cámara frontal.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Permiso de cámara denegado. Permita el acceso a la cámara frontal en su navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No se encontró una cámara en el dispositivo.';
      }
      setCameraError(message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      setCapturedBlob(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleTakeSnapshot = async () => {
    if (!videoRef.current || !cameraActive) return;

    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo crear contexto de canvas');

      // Mirror flip for natural selfie orientation
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Compress photo to max 720px and ~100-150KB JPEG
      const compressedBlob = await compressCanvasToBlob(canvas, 720, 0.75);
      const objectUrl = URL.createObjectURL(compressedBlob);

      setCapturedBlob(compressedBlob);
      setCapturedPreview(objectUrl);
      stopCamera(); // Pause stream while reviewing photo
    } catch (err: any) {
      setCameraError(err.message || 'Error al capturar la fotografía selfie.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setCapturedBlob(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedBlob && capturedPreview) {
      onCapture(capturedBlob, capturedPreview);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-[#17324D]">
            <Camera className="w-5 h-5 text-[#00A651]" />
            <h3 className="font-extrabold text-base sm:text-lg">Fotografía Selfie de Entrada</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning notice */}
        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900 text-[11px] font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Capture la fotografía directamente desde la cámara frontal. No se permite seleccionar archivos de la galería.</span>
        </div>

        {/* Camera Feed or Captured Preview */}
        <div className="relative aspect-3/4 bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-300 flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center text-white space-y-3">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <p className="text-xs font-bold leading-relaxed">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar Acceso</span>
              </button>
            </div>
          ) : capturedPreview ? (
            <img
              src={capturedPreview}
              alt="Selfie de Asistencia"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100" // Mirror for live view
            />
          )}

          {!capturedPreview && cameraActive && (
            <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>CÁMARA FRONTAL EN VIVO</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="pt-2">
          {capturedPreview ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRetake}
                className="h-12 border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-extrabold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Repetir Foto</span>
              </button>

              <button
                onClick={handleConfirm}
                className="h-12 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Check className="w-5 h-5 text-emerald-200" />
                <span>Usar esta Selfie</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleTakeSnapshot}
              disabled={!cameraActive || isCapturing}
              className={`w-full h-14 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                cameraActive && !isCapturing
                  ? 'bg-[#00A651] hover:bg-[#008f45] text-white active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Camera className="w-6 h-6" />
              <span>{isCapturing ? 'COMPRIMIENDO FOTO...' : 'CAPTURAR SELFIE AHORA'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
