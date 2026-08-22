/**
 * Shared Web NFC helpers (client-side).
 *
 * Web NFC (NDEFReader) is only available on Android Chrome / Chromium
 * over HTTPS. Feature-detect with `isNFCSupported()` before showing UI.
 */

export function isNFCSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/**
 * Start an NFC scan and resolve with the card's canonical serial number.
 * Rejects with a descriptive Error on timeout or permission denial.
 */
export function scanNFCTag(timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isNFCSupported()) {
      reject(new Error("NFC is not supported on this device or browser."));
      return;
    }

    let settled = false;
    const reader = new (window as any).NDEFReader();

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      reader.removeEventListener?.("reading", onReading);
      reader.removeEventListener?.("readingerror", onError);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error("Scan timed out — hold the card against the back of your phone and try again."));
      }
    }, timeoutMs);

    const onReading = (event: any) => {
      const serial = String(event.serialNumber ?? "").trim();
      if (!serial) return; // keep waiting for a card that reports a serial
      cleanup();
      resolve(normalizeTagId(serial));
    };

    const onError = () => {
      // Non-NDEF card — keep listening; the timeout handles giving up.
    };

    reader
      .scan()
      .then(() => {
        reader.addEventListener("reading", onReading);
        reader.addEventListener("readingerror", onError);
      })
      .catch((e: unknown) => {
        cleanup();
        if (e instanceof Error && e.name === "NotAllowedError") {
          reject(new Error("NFC permission denied — allow NFC access in your browser settings."));
        } else {
          reject(new Error("Could not start NFC scan. Make sure NFC is enabled on your device."));
        }
      });
  });
}

/** Canonicalize a tag id: lowercase, strip separators. */
export function normalizeTagId(raw: string): string {
  return raw.toLowerCase().replace(/[\s:.-]/g, "");
}
