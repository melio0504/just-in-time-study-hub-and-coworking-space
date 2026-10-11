"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ScanLine } from "lucide-react";
import { motion } from "motion/react";
import QrScanner from "qr-scanner";

type CameraState = "starting" | "active" | "denied" | "unavailable" | "insecure" | "error";

interface CameraQrScannerProps {
  onScan: (value: string) => void;
}

const CAMERA_MESSAGES: Record<Exclude<CameraState, "starting" | "active">, string> = {
  denied: "Camera access was denied. Allow camera access in the browser, then try again.",
  unavailable: "No camera was found on this device.",
  insecure: "Camera access requires HTTPS. If this kiosk is running on this device, open it through localhost instead.",
  error: "The camera could not be started. Check that another app is not using it.",
};

export function CameraQrScanner({ onScan }: CameraQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanLockedRef = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let scanner: QrScanner | null = null;

    const startCamera = async () => {
      await Promise.resolve();
      scanLockedRef.current = false;

      if (!window.isSecureContext) {
        if (!cancelled) setCameraState("insecure");
        return;
      }

      try {
        const hasCamera = await QrScanner.hasCamera();
        if (cancelled) return;
        if (!hasCamera) {
          setCameraState("unavailable");
          return;
        }

        scanner = new QrScanner(
          video,
          (result) => {
            if (cancelled || scanLockedRef.current) return;
            scanLockedRef.current = true;
            onScan(result.data);
          },
          {
            preferredCamera: "environment",
            maxScansPerSecond: 8,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
          },
        );

        await scanner.start();
        if (!cancelled) setCameraState("active");
      } catch (error) {
        if (cancelled) return;
        const errorName = error instanceof DOMException ? error.name : "";
        setCameraState(
          errorName === "NotAllowedError" || errorName === "SecurityError" ? "denied" : "error",
        );
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, [attempt, onScan]);

  const cameraError = cameraState !== "starting" && cameraState !== "active";

  return (
    <div className="relative mb-3 aspect-square min-h-[220px] max-h-[min(54dvh,460px)] w-full max-w-[min(100%,460px)] overflow-hidden rounded-3xl bg-[#2d2520] shadow-xl">
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${cameraState === "active" ? "opacity-100" : "opacity-20"
          }`}
        muted
        playsInline
        aria-label="Live QR code camera"
      />

      {cameraState === "active" && (
        <>
          <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-dashed border-white/75" />
          <motion.div
            className="pointer-events-none absolute right-10 left-10 h-1 bg-[#e5a930] shadow-[0_0_16px_#e5a930]"
            animate={{ top: ["20%", "80%", "20%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="pointer-events-none absolute top-3 left-3 h-10 w-10 rounded-tl-xl border-t-[5px] border-l-[5px] border-[#e5a930]" />
          <div className="pointer-events-none absolute top-3 right-3 h-10 w-10 rounded-tr-xl border-t-[5px] border-r-[5px] border-[#e5a930]" />
          <div className="pointer-events-none absolute bottom-3 left-3 h-10 w-10 rounded-bl-xl border-b-[5px] border-l-[5px] border-[#e5a930]" />
          <div className="pointer-events-none absolute right-3 bottom-3 h-10 w-10 rounded-br-xl border-r-[5px] border-b-[5px] border-[#e5a930]" />
        </>
      )}

      {cameraState === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          >
            <ScanLine className="mb-4 h-16 w-16 text-[#e5a930]" />
          </motion.div>
          <p className="text-lg text-[#2d2520]">Starting camera…</p>
          <p className="mt-1 text-sm text-[#6b5e52]">Allow camera access when prompted.</p>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fee2e2]">
            <AlertCircle className="h-9 w-9 text-[#dc2626]" />
          </div>
          <p className="mb-4 max-w-sm text-[#6b5e52]">{CAMERA_MESSAGES[cameraState]}</p>
          {cameraState !== "insecure" && (
            <button
              type="button"
              onClick={() => {
                setCameraState("starting");
                setAttempt((current) => current + 1);
              }}
              className="rounded-full bg-[#2d2520] px-6 py-3 font-medium text-white transition-all hover:shadow-lg"
            >
              Try camera again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
