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

  const hasSavings = totalTokensSaved > 0;
  // Label suffix: real counts get no qualifier, estimates get (est.)
  const actualLabel = usageFromProvider ? "" : " (est.)";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      {/* Input compression savings */}
      {inputTokensSaved > 0 && (
        <span className="savings-badge">
          ✂ Input:{" "}
          <span className="italic text-emerald-500" title="Local estimate — hypothetical original token count">
            {inputOriginalTokens.toLocaleString()} est.
          </span>
          {" → "}
          <span title={usageFromProvider ? "Real provider-reported token count" : "Local estimate"}>
            {inputActualTokens.toLocaleString()}{actualLabel}
          </span>
          {" "}
          <strong>−{inputPctSaved}%</strong>
        </span>
      )}

      {/* Output tokens */}
      <span
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600"
        title={usageFromProvider ? "Real provider-reported output tokens" : "Local estimate"}
      >
        Out: {outputActualTokens.toLocaleString()}{actualLabel}
      </span>

      {/* Total saved */}
      {hasSavings && (
        <span className="savings-badge">
          ⛏ {totalTokensSaved.toLocaleString()} tokens saved
          {costKnown && costSavedUsd > 0 && (
            <span className="ml-1 text-emerald-600">
              ≈ ${costSavedUsd.toFixed(5)}
            </span>
          )}
          {!costKnown && (
            <span className="ml-1 text-gray-400 italic">· cost data unavailable</span>
          )}
        </span>
      )}

      {/* Basis label — only show "inferred" if NOT from provider */}
      {basis === "provider" ? (
        <span className="text-emerald-500 font-medium text-[10px]" title="Token counts from provider usage object">
          ✓ provider
        </span>
      ) : (
        <span className="text-gray-400 italic" title="Provider did not return usage data — counts are local estimates">
          inferred
        </span>
      )}
    </div>
  );
}
