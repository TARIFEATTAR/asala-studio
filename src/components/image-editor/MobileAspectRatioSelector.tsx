import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, RectangleVertical, Smartphone } from "lucide-react";

const MOBILE_ASPECT_RATIOS = [
  { value: "5:4", label: "Landscape", icon: RectangleVertical, description: "5:4" },
  { value: "1:1", label: "Square", icon: Square, description: "1:1" },
  { value: "9:16", label: "Vertical", icon: Smartphone, description: "9:16" },
];

interface MobileAspectRatioSelectorProps {
  value: string;
  onChange: (value: string) => void;
  marketplace?: string;
  className?: string;
}

export default function MobileAspectRatioSelector({ value, onChange, marketplace, className }: MobileAspectRatioSelectorProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {MOBILE_ASPECT_RATIOS.map((ratio) => {
        const Icon = ratio.icon;
        const isEtsyOptimized = ratio.value === "5:4";
        const displayLabel = isEtsyOptimized && marketplace === "etsy" ? "Etsy" : ratio.label;
        
        return (
          <Button
            key={ratio.value}
            aria-pressed={value === ratio.value}
            aria-label={`${ratio.label} ${ratio.value}`}
            variant="outline"
            size="sm"
            onClick={() => onChange(ratio.value)}
            className={cn(
              "flex flex-col items-center gap-1 h-auto py-3 px-1 min-w-0 transition-all flex-1",
              value === ratio.value
                ? "border-2 border-aged-brass bg-aged-brass/10 text-aged-brass"
                : "border border-charcoal bg-ink-black text-parchment-white/70 hover:bg-charcoal hover:text-parchment-white"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium">{displayLabel}</span>
            <span className="text-[10px] text-parchment-white/50">{ratio.description}</span>
          </Button>
        );
      })}
    </div>
  );
}
