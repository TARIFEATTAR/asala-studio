import { Check } from "lucide-react";
import { MobileBottomSheet } from "./MobileBottomSheet";

interface MobileSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: { value: string; label: string; description?: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function MobileSettingModal({isOpen, onClose, title, options, selectedValue, onSelect}: MobileSettingModalProps) {
  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-2" role="group" aria-label={title}>
        {options.map(option => (
          <button key={option.value} type="button" aria-pressed={option.value === selectedValue}
            className={`flex min-h-14 w-full items-center gap-3 rounded-lg border p-4 text-left ${option.value === selectedValue ? 'border-aged-brass bg-aged-brass/10' : 'border-white/10 hover:bg-white/5'}`}
            onClick={() => { onSelect(option.value); onClose(); }}>
            <span className="min-w-0 flex-1"><span className="block font-medium">{option.label}</span>
              {option.description && <span className="mt-1 block text-sm text-white/60">{option.description}</span>}
            </span>
            {option.value === selectedValue && <Check className="h-5 w-5 shrink-0 text-aged-brass" />}
          </button>
        ))}
      </div>
    </MobileBottomSheet>
  );
}
