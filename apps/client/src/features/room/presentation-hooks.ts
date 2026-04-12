import { useEffect, useRef, useState } from "react";

const DEFAULT_COPY_FEEDBACK_MS = 2_000;
const DEFAULT_RESULT_PHASE_SECONDS = 10;

export function useClipboardFeedback(feedbackMs = DEFAULT_COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  function reset(): void {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCopied(false);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function copy(text: string): void {
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(text).then(() => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      setCopied(true);
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, feedbackMs);
    });
  }

  return {
    copied,
    copy,
    reset,
  };
}

export function useResultPhaseTimer(
  isActive: boolean,
  onElapsed: () => void,
  initialSeconds = DEFAULT_RESULT_PHASE_SECONDS,
) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const onElapsedRef = useRef(onElapsed);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    if (!isActive) {
      setRemainingSeconds(initialSeconds);
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          onElapsedRef.current();
          return 0;
        }
        return current - 1;
      });
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [initialSeconds, isActive]);

  return [remainingSeconds, setRemainingSeconds] as const;
}
