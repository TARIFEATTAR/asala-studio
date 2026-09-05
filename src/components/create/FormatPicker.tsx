import React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { DELIVERABLE_CATEGORIES, getDeliverableByValue } from "@/config/deliverableFormats";

interface FormatPickerProps {
    value: string;
    onSelect: (value: string) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const FormatPicker: React.FC<FormatPickerProps> = ({ value, onSelect, open, onOpenChange }) => {
    const selectedDeliverable = getDeliverableByValue(value);
    const SelectedIcon = selectedDeliverable?.icon;

    return (
        <div>
            <Label htmlFor="format" className="text-base mb-2 text-ink-black">
                Deliverable Format <span className="text-brass">*</span>
            </Label>
            <Popover open={open} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        id="format" role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between mt-2 bg-parchment-white border-warm-gray/20 hover:bg-parchment-white/80",
                            !value && "text-muted-foreground"
                        )}
                    >
                        {value ? (
                            <span className="flex items-center gap-2">
                                {SelectedIcon && <SelectedIcon className="h-4 w-4" />}
                                {selectedDeliverable?.label}
                            </span>
                        ) : (
                            "Select format..."
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] md:w-[600px] p-0 bg-parchment-white border-warm-gray/20" align="start">
                    <Command className="bg-parchment-white">
                        <CommandInput
                            placeholder="Search deliverables..."
                            className="border-none focus:ring-0"
                        />
                        <CommandList className="max-h-[min(400px,45dvh)]">
                            <CommandEmpty>No deliverable found.</CommandEmpty>
                            {DELIVERABLE_CATEGORIES.map((category) => {
                                const CategoryIcon = category.icon;
                                return (
                                    <CommandGroup
                                        key={category.name}
                                        heading={
                                            <span className="flex items-center gap-2 text-ink-black/70">
                                                <CategoryIcon className="h-4 w-4" />
                                                {category.name}
                                            </span>
                                        }
                                    >
                                        {category.deliverables.map((deliverable) => {
                                            const DeliverableIcon = deliverable.icon;
                                            return (
                                                <CommandItem
                                                    key={deliverable.value}
                                                    value={`${deliverable.label} ${deliverable.description}`}
                                                    onSelect={() => {
                                                        onSelect(deliverable.value);
                                                        onOpenChange(false);
                                                    }}
                                                    className="min-h-11 cursor-pointer"
                                                >
                                                    <div className="flex items-start gap-3 w-full">
                                                        <DeliverableIcon className="h-4 w-4 mt-0.5 text-brass shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-ink-black">
                                                                {deliverable.label}
                                                            </div>
                                                            <div className="text-xs text-warm-gray/70">
                                                                {deliverable.description}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                );
                            })}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};
