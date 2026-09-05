import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A portalled sheet: scroll stays inside, focus returns to the opening control. */
export function MobileBottomSheet({isOpen, onClose, title, icon, children, className}: MobileBottomSheetProps) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/70" />
        <Dialog.Content aria-describedby={undefined} onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus({preventScroll: true}); }}
          className={cn("mobile-studio-sheet", className)}>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4">
            <Dialog.Title className="flex items-center gap-2 font-serif text-xl text-aged-brass">{icon}{title}</Dialog.Title>
            <Dialog.Close className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label={`Close ${title}`}>
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
