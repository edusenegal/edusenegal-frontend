import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import styles from './CameraCapture.module.css';

interface CameraCaptureProps {
  /** Reçoit la photo capturée (JPEG carré). */
  onCapture: (file: File) => void;
  /** Fermeture sans capture. */
  onClose: () => void;
}

/**
 * Ouvre la caméra de l'appareil, affiche un aperçu en direct et capture une
 * photo carrée recadrée au centre. Rendu en superposition plein écran.
 * `getUserMedia` exige un contexte sécurisé (HTTPS ou localhost).
 */
export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (mode: 'user' | 'environment') => {
      stop();
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La caméra n'est pas disponible sur cet appareil ou ce navigateur.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? "Accès à la caméra refusé. Autorisez-le dans les réglages de votre navigateur, puis réessayez."
            : name === 'NotFoundError'
              ? 'Aucune caméra détectée sur cet appareil.'
              : "Impossible d'ouvrir la caméra. Réessayez ou importez un fichier.",
        );
      }
    },
    [stop],
  );

  useEffect(() => {
    start(facing);
    return stop;
  }, [facing, start, stop]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  }

  function close() {
    stop();
    onClose();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Prendre une photo">
      <div className={styles.panel}>
        {error ? (
          <div className={styles.errorBox}>
            <p className={styles.errorText}>{error}</p>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={close}>
                Fermer
              </Button>
              <Button variant="primary" onClick={() => start(facing)}>
                Réessayer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.videoWrap}>
              <video ref={videoRef} playsInline muted className={styles.video} />
              {!ready ? <div className={styles.loading}>Ouverture de la caméra…</div> : null}
            </div>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={close}>
                Annuler
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              >
                Changer de caméra
              </Button>
              <Button variant="primary" disabled={!ready} onClick={capture}>
                Capturer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
