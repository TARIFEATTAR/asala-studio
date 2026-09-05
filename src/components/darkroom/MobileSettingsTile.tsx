/**
 * MobileSettingsTile - Individual settings tile for mobile Dark Room
 * 
 * Displays a single setting option with icon, label, and current value.
 * Tapping opens the corresponding settings modal.
 */

import { useCallback } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileSettingsTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function MobileSettingsTile({
  icon: Icon,
  label,
  value,
  onClick,
  disabled = false,
  className,
}: MobileSettingsTileProps) {
  // Handle both click and touch events
  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    // For touch events, prevent the subsequent click
    if (e.type === "touchend") {
      e.preventDefault();
    }
    
    onClick();
  }, [disabled, onClick]);

  return (
    <button
      className={cn(
        "mobile-settings-tile",
        disabled && "mobile-settings-tile--disabled",
        className
      )}
      onClick={handleInteraction}
      disabled={disabled}
      type="button"
    >
      <div className="mobile-settings-tile__icon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="mobile-settings-tile__content">
        <span className="mobile-settings-tile__label">{label}</span>
        <span className="mobile-settings-tile__value">{value}</span>
      </div>
    </button>
  );
}

