interface ChipProps {
  label: string;
  editable?: boolean;
  onRemove?: () => void;
}

export default function Chip({ label, editable = false, onRemove }: ChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        background: "var(--chip-bg)",
        color: "var(--chip-text)",
      }}
    >
      {label}
      {editable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer ${label}`}
          className="relative -mr-1 inline-flex h-4 w-4 items-center justify-center opacity-60 transition-opacity hover:opacity-100 before:absolute before:-inset-3 before:content-['']"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
