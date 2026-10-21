
import { useEffect, useRef, useState } from "react";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export default function CameraCapture({
  onCapture,
  onClose,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to access the camera. Please check camera permissions."
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95)
    );

    if (!blob) {
      setError("Could not capture the photo. Please try again.");
      return;
    }

    onCapture(
      new File([blob], `business-card-${Date.now()}.jpg`, {
        type: "image/jpeg",
      })
    );

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">
          Take a business card photo
        </h2>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-xl bg-black"
        />

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={capturePhoto}
            disabled={!!error}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-white disabled:opacity-50"
          >
            Capture Photo
          </button>

          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-3"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
