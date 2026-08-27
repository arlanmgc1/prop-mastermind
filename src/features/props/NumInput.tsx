import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { parseNumberOrNull } from "@/domain/validation/validators";

export function NumInput({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));

  useEffect(() => {
    const parsed = parseNumberOrNull(text);
    if (parsed !== value) setText(value == null ? "" : String(value).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      aria-label={ariaLabel}
      inputMode="decimal"
      value={text}
      placeholder={placeholder ?? "—"}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumberOrNull(e.target.value));
      }}
      className={cn(
        "num w-full rounded-lg border border-input bg-secondary px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary",
        className,
      )}
    />
  );
}
