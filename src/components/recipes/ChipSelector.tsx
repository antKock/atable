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
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isSelected
                ? "bg-accent text-white"
                : "bg-transparent border border-border text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
