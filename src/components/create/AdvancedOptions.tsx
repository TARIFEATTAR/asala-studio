import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AdvancedOptionsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    style: string;
    onStyleChange: (style: string) => void;
    additionalContext: string;
    onAdditionalContextChange: (context: string) => void;
    brandName?: string | null;
}

export const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
    open,
    onOpenChange,
    style,
    onStyleChange,
    additionalContext,
    onAdditionalContextChange,
    brandName
}) => {
    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className="border-t border-warm-gray/20 pt-6"
        >
            <CollapsibleTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between hover:bg-brass/5 text-ink-black p-4"
                >
                    <span className="text-base font-medium">
                        Advanced Options
                    </span>
                    {open ? (
                        <ChevronUp className="w-5 h-5 text-brass" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-brass" />
                    )}
                </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-6 pt-4">
                {/* Writing Style */}
                <div>
                    <Label htmlFor="style" className="text-base mb-2 text-ink-black">
                        Select Writing Style
                    </Label>
                    <Select value={style} onValueChange={onStyleChange}>
                        <SelectTrigger
                            id="style"
                            className="mt-2 bg-parchment-white border-warm-gray/20"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="brand-voice">
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {brandName ? `${brandName} Voice` : "Your Brand Voice"}
                                    </span>
                                    <span className="text-xs text-warm-gray">Your brand's authentic voice</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="poetic">
                                <div className="flex flex-col">
                                    <span className="font-medium">Storytelling</span>
                                    <span className="text-xs text-warm-gray">Engaging narratives & romance</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="direct">
                                <div className="flex flex-col">
                                    <span className="font-medium">Direct Sales</span>
                                    <span className="text-xs text-warm-gray">Conversion-focused & persuasive</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="educational">
                                <div className="flex flex-col">
                                    <span className="font-medium">Educational</span>
                                    <span className="text-xs text-warm-gray">Explanatory & reason-why</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="minimal">
                                <div className="flex flex-col">
                                    <span className="font-medium">Minimalist</span>
                                    <span className="text-xs text-warm-gray">Clean, modern & concise</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs italic mt-2 text-warm-gray/70">
                        Choose the writing style that best fits your content needs
                    </p>
                </div>

                {/* Mobile brief appears in the main form. */}
                <div className="hidden md:block">
                    <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="context" className="text-base text-ink-black">
                            Additional Editorial Direction
                        </Label>
                        <span className="text-xs text-warm-gray/70">
                            {additionalContext.length} / 1000 characters
                        </span>
                    </div>
                    <Textarea
                        id="context"
                        value={additionalContext}
                        onChange={(e) => onAdditionalContextChange(e.target.value)}
                        placeholder="Provide specific requirements or creative mandates..."
                        className="mt-2 min-h-[120px] bg-vellum-cream border-warm-gray/20 text-ink-black"
                        maxLength={1000}
                    />
                    <p className="text-xs italic mt-2 text-warm-gray/70">
                        Any specific themes, angles, seasonal notes, or key messages to include (max 1000 characters)
                    </p>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
