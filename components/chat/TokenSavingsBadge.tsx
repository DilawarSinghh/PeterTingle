"use client";

interface Stats {
  inputRawTokens: number;
  inputCompressedTokens: number;
  inputTokensSaved: number;
  inputPctSaved: number;
  outputTokens: number;
  totalTokensSaved: number;
  costSavedUsd: number;
  basis: "inferred";
}

interface Props {
  stats: Stats;
}

export default function TokenSavingsBadge({ stats }: Props) {
  const hasSavings = stats.totalTokensSaved > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      {/* Input savings */}
      {stats.inputTokensSaved > 0 && (
        <span className="savings-badge">
          ✂ Input: {stats.inputRawTokens}→{stats.inputCompressedTokens} tokens
          {" "}
          <strong>−{stats.inputPctSaved}%</strong>
        </span>
      )}

      {/* Output tokens */}
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
        Out: {stats.outputTokens} tokens
      </span>

      {/* Total saved */}
      {hasSavings && (
        <span className="savings-badge">
          ⛏ {stats.totalTokensSaved} saved
          {stats.costSavedUsd > 0 && (
            <span className="ml-1 text-emerald-600">
              ≈ ${stats.costSavedUsd.toFixed(5)}
            </span>
          )}
        </span>
      )}

      {/* Basis label */}
      <span className="text-gray-400 italic">inferred</span>
    </div>
  );
}
