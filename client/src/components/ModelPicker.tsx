import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MODELS, modelById, providerClass } from "@/lib/models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  align?: "start" | "end";
  compact?: boolean;
}

export function ModelPicker({ value, onChange, align = "end", compact = false }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const current = modelById(value);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`${providerClass(current.provider)} group inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 hover-elevate transition-colors ${
            compact ? "text-xs" : "text-sm"
          }`}
          data-testid="button-model-picker"
        >
          <span className="w-2 h-2 rounded-full provider-dot" />
          <span className="font-mono uppercase tracking-wider text-foreground">{current.name}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Available models
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`${providerClass(m.provider)} flex items-start gap-2.5 py-2 cursor-pointer`}
            data-testid={`option-model-${m.id}`}
          >
            <span className="w-2 h-2 rounded-full provider-dot mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono uppercase tracking-wider text-xs">{m.name}</span>
                {m.id === value && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {m.providerName}
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">{m.description}</span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
