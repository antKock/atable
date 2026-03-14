interface TagChipProps {
  name: string;
  editable?: boolean;
  onRemove?: () => void;
}

export default function TagChip({ name, editable = false, onRemove }: TagChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium"
      style={{
        backgroundColor: "var(--tag-chip-bg)",
        color: "var(--tag-chip-text)",
      }}
    >
      {name}
      {editable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer le tag ${name}`}
          className="relative -mr-1 inline-flex h-4 w-4 items-center justify-center text-current opacity-60 transition-opacity hover:opacity-100 before:absolute before:-inset-3 before:content-['']"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
