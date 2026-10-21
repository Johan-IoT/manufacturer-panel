import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function SerialQrScannerDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (serial: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let frameId = 0;
    let cancelled = false;
    const videoElement = videoRef.current;

    async function start() {
      setError(null);
      setScanning(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available in this browser. Enter the serial number manually.");
        setScanning(false);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) return;

        const video = videoElement ?? videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // Native BarcodeDetector where available (Chrome / Edge on Android, macOS),
        // otherwise decode frames with jsQR so Safari and Firefox work too.
        const detector = window.BarcodeDetector
          ? new window.BarcodeDetector({ formats: ["qr_code"] })
          : null;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });

        const decodeFrame = async (source: HTMLVideoElement): Promise<string | undefined> => {
          if (detector) {
            const codes = await detector.detect(source);
            return codes.find((c) => c.rawValue)?.rawValue?.trim();
          }
          if (!context || source.videoWidth === 0 || source.videoHeight === 0) return undefined;
          canvas.width = source.videoWidth;
          canvas.height = source.videoHeight;
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          return jsQR(image.data, image.width, image.height)?.data?.trim() || undefined;
        };

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const value = await decodeFrame(videoRef.current);
            if (value) {
              onCapture(value);
              onOpenChange(false);
              return;
            }
          } catch {
            // continue scanning
          }
          frameId = window.requestAnimationFrame(() => {
            void tick();
          });
        };

        frameId = window.requestAnimationFrame(() => {
          void tick();
        });
      } catch {
        setError("Camera access was denied. Enter the serial number manually.");
      } finally {
        setScanning(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [open, onCapture, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
          <DialogDescription>
            Point the camera at the device QR code to capture the serial number only.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {scanning && !error && (
          <p className="text-sm text-muted-foreground">Scanning for QR code...</p>
        )}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
