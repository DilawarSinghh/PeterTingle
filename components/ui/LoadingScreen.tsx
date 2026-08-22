/**
 * Shared full-viewport loading screen.
 * Reuses the .logo-spinner CSS keyframe defined in globals.css.
 * Used by all loading.tsx files across the app.
 */
export default function LoadingScreen({ label = "Loadingâ€¦" }: { label?: string }) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span className="logo-spinner text-4xl leading-none text-accent" aria-hidden="true">
          â›
        </span>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

