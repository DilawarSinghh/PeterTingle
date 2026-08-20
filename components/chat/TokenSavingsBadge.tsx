"use client";

import type { MessageStats } from "./ChatInterface";

interface Props {
  stats: MessageStats;
}

export default function TokenSavingsBadge({ stats }: Props) {
  const {
    inputOriginalTokens,
    inputActualTokens,
    inputTokensSaved,
    inputPctSaved,
    outputActualTokens,
    totalTokensSaved,
    costSavedUsd,
    costKnown,
    usageFromProvider,
    basis,
  } = stats;

  // Guard against NaN/undefined
  const hasSavings = (totalTokensSaved ?? 0) > 0;
  const actualLabel = usageFromProvider ? "" : " (est.)";

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
      {/* Input savings */}
      {(inputTokensSaved ?? 0) > 0 && (inputOriginalTokens ?? 0) > 0 && (
        <span className="savings-badge">
          ✂{" "}
          <span className="italic text-text-secondary" title="Local estimate — hypothetical without compression">
            {(inputOriginalTokens ?? 0).toLocaleString()} est.
          </span>
          {" → "}
          <span title={usageFromProvider ? "Real provider token count" : "Local estimate"}>
            {(inputActualTokens ?? 0).toLocaleString()}{actualLabel}
          </span>
          {" "}<strong>−{inputPctSaved ?? 0}%</strong>
        </span>
      )}

      {/* Output */}
      <span
        className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-text-secondary"
        title={usageFromProvider ? "Real provider output tokens" : "Local estimate"}
      >
        Out: {(outputActualTokens ?? 0).toLocaleString()}{actualLabel}
      </span>

      {/* Total saved */}
      {hasSavings && (
        <span className="savings-badge">
          ⛏ {(totalTokensSaved ?? 0).toLocaleString()} saved
          {costKnown && (costSavedUsd ?? 0) > 0 && (
            <span className="ml-1 text-success">≈ ${(costSavedUsd ?? 0).toFixed(5)}</span>
          )}
          {!costKnown && (
            <span className="ml-1 text-text-muted italic">· cost n/a</span>
          )}
        </span>
      )}

      {/* Basis indicator */}
      {basis === "provider" ? (
        <span className="text-[10px] font-medium text-accent" title="Token counts from provider usage object">✓ provider</span>
      ) : (
        <span className="text-[10px] text-text-muted italic" title="Provider did not return usage data — local estimates">inferred</span>
      )}
    </div>
  );
}
