import type { Model } from "@/lib/models";
import { providerClass } from "@/lib/models";

interface ModelBadgeProps {
  model: Model;
  size?: "xs" | "sm" | "md";
  active?: boolean;
  className?: string;
}

export function ModelBadge({ model, size = "sm", active = false, className = "" }: ModelBadgeProps) {
  const sizes = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-[11px] px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
  };
  const dot = size === "xs" ? "w-1.5 h-1.5" : "w-2 h-2";
  return (
    <span
      className={`${providerClass(model.provider)} inline-flex items-center rounded-full font-mono uppercase tracking-wider border ${sizes[size]} ${
        active ? "provider-glow provider-text" : "provider-border text-muted-foreground"
      } ${className}`}
      data-testid={`badge-model-${model.id}`}
    >
      <span className={`${dot} rounded-full provider-dot`} />
      <span className="tracking-wider">{model.name}</span>
    </span>
  );
}

export function ModelDot({ provider, size = 8, className = "" }: { provider: string; size?: number; className?: string }) {
  return (
    <span
      className={`provider-${provider} inline-block rounded-full provider-dot ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
