"use client";

interface ChipSelectorProps {
  options: { value: string; label: string }[];
  selected: string | string[];
  onChange: (value: string | string[]) => void;
  mode: "single" | "multi";
  label: string;
}

export default function ChipSelector({
  options,
  selected,
  onChange,
  mode,
  label,
}: ChipSelectorProps) {
  const selectedSet = new Set(Array.isArray(selected) ? selected : selected ? [selected] : []);

  function handleToggle(value: string) {
    if (mode === "single") {
      onChange(selectedSet.has(value) ? "" : value);
    } else {
      const arr = Array.isArray(selected) ? selected : [];
      if (selectedSet.has(value)) {
        onChange(arr.filter((v) => v !== value));
      } else {
        onChange([...arr, value]);
      }
    }
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selectedSet.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => handleToggle(opt.value)}
            className="inline-flex items-center gap-1 rounded-full text-sm font-medium transition-colors"
            style={{
              padding: isSelected ? "6px 14px 6px 11px" : "6px 14px",
              background: isSelected
                ? "var(--chip-bg-selected)"
                : "var(--surface)",
              color: isSelected ? "var(--chip-text-selected)" : "var(--foreground)",
              border: isSelected
                ? "1px solid transparent"
                : "1px solid var(--border)",
            }}
          >
            {isSelected && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
