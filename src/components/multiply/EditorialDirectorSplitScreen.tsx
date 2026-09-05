import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Sparkles, Mail, Instagram, Twitter, Tag, MessageSquare, FileText, Save, CheckCircle2, XCircle, Maximize2, Minimize2, Copy } from "lucide-react";
import { EditorialAssistantPanel } from "@/components/assistant/EditorialAssistantPanel";
import { ScheduleButton } from "@/components/forge/ScheduleButton";
import { useToast } from "@/hooks/use-toast";
import { parseEmailSequence } from "@/lib/emailSequence";

import type { DerivativeContent } from "@/types/multiply";
import { serializeSequenceEmails } from "@/lib/multiplyUtils";

interface EditorialDirectorSplitScreenProps {
  derivative: DerivativeContent;
  derivatives: DerivativeContent[];
  onClose: () => void;
  onUpdateDerivative: (derivative: DerivativeContent) => Promise<void>;
}

const DERIVATIVE_ICONS = {
  instagram: Instagram,
  email: Mail,
  twitter: Twitter,
  product: Tag,
  sms: MessageSquare,
  pinterest: FileText,
};

const DERIVATIVE_LABELS = {
  instagram: "Instagram",
  email: "Email",
  twitter: "Twitter",
  product: "Product Description",
  sms: "SMS",
  pinterest: "Pinterest",
};

const DERIVATIVE_COLORS = {
  instagram: "#E4405F",
  email: "#B8956A",
  twitter: "#1DA1F2",
  product: "#3A4A3D",
  sms: "#6B2C3E",
  pinterest: "#E60023",
};

const CHAR_LIMITS = {
  instagram: 2200,
  email: 2000,
  twitter: 280,
  product: 500,
  sms: 160,
  pinterest: 500,
};

const buildSequenceEmails = (source: DerivativeContent) => {
  if (source.sequenceEmails && source.sequenceEmails.length > 0) {
    return source.sequenceEmails;
  }

  if (!source.content) {
    return [];
  }

  const parsed = parseEmailSequence(source.content);

  return parsed.map((part, index) => ({
    id: `${source.id}-parsed-${index + 1}`,
    sequenceNumber: index + 1,
    subject: part.subject || `Email ${index + 1}`,
    preview: part.preview || part.content.slice(0, 140),
    content: part.content,
    charCount: part.content.length,
  }));
};

export function EditorialDirectorSplitScreen({
  derivative,
  derivatives,
  onClose,
  onUpdateDerivative,
}: EditorialDirectorSplitScreenProps) {
  const [editedContent, setEditedContent] = useState(derivative.content);
  const [selectedDerivativeId, setSelectedDerivativeId] = useState(derivative.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSequenceEmails, setEditedSequenceEmails] = useState(() => buildSequenceEmails(derivative));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const selectedDerivative = derivatives.find(d => d.id === selectedDerivativeId) || derivative;
  const Icon = DERIVATIVE_ICONS[selectedDerivative.typeId as keyof typeof DERIVATIVE_ICONS] || FileText;
  const label = DERIVATIVE_LABELS[selectedDerivative.typeId as keyof typeof DERIVATIVE_LABELS] || selectedDerivative.typeId;
  const color = DERIVATIVE_COLORS[selectedDerivative.typeId as keyof typeof DERIVATIVE_COLORS] || "#B8956A";
  const charLimit = CHAR_LIMITS[selectedDerivative.typeId as keyof typeof CHAR_LIMITS];
  const charCount = editedContent.length;
  const sequenceType = selectedDerivative.isSequence || selectedDerivative.typeId.includes("email_");
  const isSequence = sequenceType && editedSequenceEmails.length > 0;

  const persistChanges = async (status = selectedDerivative.status) => {
    if (isSaving) return;
    setIsSaving(true);
    const content = isSequence
      ? serializeSequenceEmails(editedSequenceEmails)
      : editedContent;
    try {
      await onUpdateDerivative({
        ...selectedDerivative, content, generated_content: content,
        charCount: content.length, status,
        sequenceEmails: isSequence ? editedSequenceEmails : undefined,
      });
      toast({ title: "Changes saved", description: "Your edition has been saved." });
    } catch (error) {
      toast({ title: "Couldn't save changes", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  const handleSave = () => persistChanges();
  const handleApprove = () => persistChanges("approved");
  const handleReject = () => persistChanges("rejected");

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent);
    toast({
      title: "Content copied",
      description: "Derivative content has been copied to clipboard",
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const cursorPosition = e.target.selectionStart;
    setEditedContent(e.target.value);
    
    // Preserve cursor position after state update
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = cursorPosition;
        textareaRef.current.selectionEnd = cursorPosition;
      }
    });
  };

  const handleSequenceEmailChange = (emailId: string, field: 'subject' | 'preview' | 'content', value: string) => {
    setEditedSequenceEmails(prev =>
      prev.map(email =>
        email.id === emailId
          ? { ...email, [field]: value, charCount: field === 'content' ? value.length : email.charCount }
          : email
      )
    );
  };

  useEffect(() => {
    setEditedSequenceEmails(buildSequenceEmails(selectedDerivative));
    setEditedContent(selectedDerivative.content);
  }, [selectedDerivativeId, selectedDerivative]);

  return (
    <fieldset disabled={isSaving} aria-busy={isSaving} aria-label="Edition editor" className="mobile-derivative-editor fixed inset-0 z-50 m-0 min-w-0 border-0 p-0 flex flex-col bg-brand-vellum">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-brand-stone bg-brand-parchment">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-brand-charcoal hover:text-brand-ink"
          >
            <X className="w-4 h-4 mr-2" />
            Exit Editor
          </Button>
        </div>
        
        <h1 className="text-lg font-serif font-semibold text-brand-ink">
          Edit Derivatives
        </h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand-charcoal hover:text-brand-ink"
        >
          {isExpanded ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {/* Main Content Area - Fixed 60/40 Split */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Derivatives Editor (60% width) */}
        <div 
          className={`${isExpanded ? 'flex-1' : 'flex-1'} overflow-y-auto border-r border-brand-stone py-4 sm:py-6 px-2 sm:px-4`} 
        >
          <div className="max-w-5xl mx-auto">
            <p className="text-sm mb-6 text-brand-charcoal">
              Review and refine your channel-specific content with the Editorial Director
            </p>
            
            {/* Derivative Selector */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge
                  variant="secondary"
                  className="gap-2"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Badge>
                <Badge variant="outline" className="border-brand-stone text-brand-charcoal">
                  {selectedDerivative.status.charAt(0).toUpperCase() + selectedDerivative.status.slice(1)}
                </Badge>
              </div>

              {/* Content Editor - Email Sequence or Regular */}
              {isSequence ? (
                <div className="space-y-4">
                  <Accordion type="multiple" defaultValue={editedSequenceEmails.map(e => e.id)} className="space-y-3">
                    {editedSequenceEmails.map((email, index) => (
                      <AccordionItem 
                        key={email.id} 
                        value={email.id}
                        className="border rounded-lg overflow-hidden border-brand-stone bg-brand-parchment"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="border-brand-brass text-brand-brass">
                                Email {email.sequenceNumber}
                              </Badge>
                              <span className="text-sm font-medium text-brand-ink">
                                {email.subject || 'Untitled'}
                              </span>
                            </div>
                            <span className="text-xs text-brand-stone/80">
                              {email.charCount} chars
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 text-brand-ink">
                              Subject Line
                            </Label>
                            <Input
                              value={email.subject}
                              onChange={(e) => handleSequenceEmailChange(email.id, 'subject', e.target.value)}
                              placeholder="Enter subject line..."
                              className="mt-1 bg-brand-vellum"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 text-brand-ink">
                              Preview Text
                            </Label>
                            <Input
                              value={email.preview}
                              onChange={(e) => handleSequenceEmailChange(email.id, 'preview', e.target.value)}
                              placeholder="Enter preview text..."
                              className="mt-1 bg-brand-vellum"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium text-brand-ink">
                                Email Body
                              </Label>
                              <span className="text-xs text-brand-stone/80">
                                {email.charCount} chars
                              </span>
                            </div>
                            <Textarea
                              value={email.content}
                              onChange={(e) => handleSequenceEmailChange(email.id, 'content', e.target.value)}
                              className={isExpanded ? "min-h-96" : "min-h-64"}
                              style={{ backgroundColor: "#F5F1E8" }}
                              placeholder="Write your email content..."
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      variant="outline"
                      size="sm"
                      className="border-brand-stone text-brand-charcoal"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    {selectedDerivative.status === "pending" && (
                      <>
                        <Button
                          onClick={handleApprove}
                          disabled={isSaving}
                          variant="outline"
                          size="sm"
                          style={{ borderColor: "#3A4A3D", color: "#3A4A3D" }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={handleReject}
                          disabled={isSaving}
                          variant="outline"
                          size="sm"
                          style={{ borderColor: "#6B2C3E", color: "#6B2C3E" }}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="border-brand-stone text-brand-charcoal"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <ScheduleButton
                      contentTitle={label}
                      contentType={selectedDerivative.typeId}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-brand-ink">
                        Content
                      </label>
                      <span 
                        className="text-xs"
                        style={{ 
                          color: charLimit && charCount > charLimit ? "#DC2626" : "#A8A39E" 
                        }}
                      >
                        {charCount}{charLimit && `/${charLimit}`} chars
                      </span>
                    </div>
                    <Textarea
                      ref={textareaRef}
                      value={editedContent}
                      onChange={handleContentChange}
                      className={`font-sans bg-brand-parchment ${isExpanded ? "min-h-96" : "min-h-64"}`}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      variant="outline"
                      size="sm"
                      className="border-brand-stone text-brand-charcoal"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    {selectedDerivative.status === "pending" && (
                      <>
                        <Button
                          onClick={handleApprove}
                          disabled={isSaving}
                          variant="outline"
                          size="sm"
                          style={{ borderColor: "#3A4A3D", color: "#3A4A3D" }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={handleReject}
                          disabled={isSaving}
                          variant="outline"
                          size="sm"
                          style={{ borderColor: "#6B2C3E", color: "#6B2C3E" }}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="border-brand-stone text-brand-charcoal"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <ScheduleButton
                      contentTitle={label}
                      contentType={selectedDerivative.typeId}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            {/* Other Derivatives List */}
            {derivatives.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-brand-ink">
                  Other Derivatives
                </h3>
                <div className="space-y-2">
                  {derivatives.filter(d => d.id !== selectedDerivativeId).map((d) => {
                    const DIcon = DERIVATIVE_ICONS[d.typeId as keyof typeof DERIVATIVE_ICONS] || FileText;
                    const dLabel = DERIVATIVE_LABELS[d.typeId as keyof typeof DERIVATIVE_LABELS] || d.typeId;
                    const dColor = DERIVATIVE_COLORS[d.typeId as keyof typeof DERIVATIVE_COLORS] || "#B8956A";

                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          setSelectedDerivativeId(d.id);
                          setEditedContent(d.content);
                        }}
                        className="w-full p-3 rounded-lg border text-left hover:shadow-sm transition-all bg-brand-parchment border-brand-stone"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="gap-1.5"
                            style={{ backgroundColor: `${dColor}15`, color: dColor }}
                          >
                            <DIcon className="w-3.5 h-3.5" />
                            {dLabel}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="text-xs border-brand-stone text-brand-stone/80"
                          >
                            {d.status}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Editorial Director (fills remaining space) */}
        {!isExpanded && (
          <div 
            className="derivative-assistant w-[550px] overflow-hidden flex flex-col bg-brand-parchment"
          >
            {/* Panel Header */}
            <div 
              className="px-4 py-3 border-b border-brand-stone bg-brand-brass/5" 
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-brass/10"
                >
                  <Sparkles className="w-4 h-4 text-brand-brass" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif font-semibold text-sm sm:text-base text-brand-ink">
                    Editorial Director
                  </h2>
                  <p className="text-xs text-brand-stone/80">
                    <Icon className="w-3 h-3 inline mr-1" style={{ color }} />
                    {label} • {charCount} chars
                  </p>
                </div>
              </div>
            </div>

            {/* Assistant Panel */}
            <div className="flex-1 overflow-hidden">
              <EditorialAssistantPanel
                onClose={onClose}
                initialContent={editedContent}
              />
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
