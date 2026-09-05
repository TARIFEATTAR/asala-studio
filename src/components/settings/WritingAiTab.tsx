import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_WRITING_SETTINGS,
  WRITING_MODELS,
  type WritingProvider,
  type WritingSettings,
} from "../../../supabase/functions/_shared/writingAiContract";

type Snapshot = {
  settings: WritingSettings;
  canEdit: boolean;
  connections: Record<WritingProvider, { managed: boolean; custom: boolean }>;
};
const providerNames = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  openrouter: "OpenRouter · free models",
};
export function WritingAiTab() {
  const { organizationId, isLoading } = useOrganization();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [settings, setSettings] = useState<WritingSettings>(
    DEFAULT_WRITING_SETTINGS,
  );
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const invoke = async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    const { data, error } = await supabase.functions.invoke(
      "writing-ai-settings",
      { body: { organizationId, action, ...payload } },
    );
    if (error) {
      let message = "Writing AI settings are unavailable. Please retry.";
      try {
        message = (await error.context.json()).error || message;
      } catch { /* Do not expose transport payloads. */ }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  useEffect(() => {
    const version = ++generation.current;
    setSnapshot(null);
    setApiKey("");
    setError("");
    setNotice("");
    if (!organizationId) return;
    setBusy("load");
    invoke("get").then((data: Snapshot) => {
      if (version !== generation.current) return;
      setSnapshot(data);
      setSettings(data.settings);
    }).catch((e) => {
      if (version === generation.current) setError(e.message);
    })
      .finally(() => {
        if (version === generation.current) setBusy(null);
      });
    return () => {
      generation.current++;
    };
  }, [organizationId]);
  const update = (patch: Partial<WritingSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setNotice("");
    setError("");
  };
  const changeProvider = (provider: WritingProvider) => {
    setApiKey("");
    update({
      provider,
      model: WRITING_MODELS[provider][0].id,
      keySource: snapshot?.connections[provider].custom ? "custom" : "managed",
    });
  };
  const act = async (action: "save" | "test") => {
    const version = generation.current;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const result = await invoke(action, {
        settings,
        ...(apiKey ? { apiKey } : {}),
      });
      if (version !== generation.current) return;
      if (action === "save") {
        setApiKey("");
        const next = await invoke("get");
        if (version !== generation.current) return;
        setSnapshot(next);
        setSettings(next.settings);
        setNotice("Saved. New writing requests will use this model.");
      } else {setNotice(
          `Connected successfully to ${result.model}. Save to apply this selection.`,
        );}
    } catch (e) {
      if (version === generation.current) setError((e as Error).message);
    } finally {
      if (version === generation.current) setBusy(null);
    }
  };
  if (isLoading || busy === "load") {
    return (
      <div role="status" className="flex items-center gap-2 p-6">
        <Loader2 className="h-4 w-4 animate-spin" />Loading Writing AI…
      </div>
    );
  }
  if (!organizationId) {
    return <p className="p-4">Join an organization to configure Writing AI.</p>;
  }
  const connected = apiKey.length > 0 ||
    !!snapshot?.connections[settings.provider][settings.keySource];
  const disabled = !!busy || !snapshot?.canEdit;
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Writing AI</CardTitle>
        <CardDescription>
          Choose the model Madison uses for writing, chat, and brand analysis.
          Image generation has its own settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {snapshot && !snapshot.canEdit && (
          <p className="text-sm text-muted-foreground">
            Your organization’s owner or admin can change this setting.
          </p>
        )}
        {snapshot && (
          <>
            <div className="space-y-2">
              <Label htmlFor="writing-provider">Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(v) => changeProvider(v as WritingProvider)}
                disabled={disabled}
              >
                <SelectTrigger id="writing-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(providerNames).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="writing-model">Model</Label>
              <Select
                value={WRITING_MODELS[settings.provider].some((m) =>
                    m.id === settings.model
                  )
                  ? settings.model
                  : "custom"}
                onValueChange={(v) =>
                  update({ model: v === "custom" ? "" : v })}
                disabled={disabled}
              >
                <SelectTrigger id="writing-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WRITING_MODELS[settings.provider].map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Enter a model ID</SelectItem>
                </SelectContent>
              </Select>
              {!WRITING_MODELS[settings.provider].some((m) =>
                m.id === settings.model
              ) && (
                <Input
                  aria-label="Model ID"
                  value={settings.model}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder={settings.provider === "openrouter"
                    ? "provider/model:free"
                    : "Model ID from your provider"}
                  disabled={disabled}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
              {settings.provider === "openrouter"
                ? (
                  <>
                    Uses only free models. Availability and daily limits vary;
                    model quality may change between requests. Requires an
                    OpenRouter key. PDF brand scans require OpenAI or Gemini.
                    Requests go to OpenRouter and its selected provider.{" "}
                    <a
                      href="https://openrouter.ai/docs/guides/routing/routers/free-router"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Free model details
                    </a>.
                  </>
                )
                : settings.provider === "gemini"
                ? (
                  <>
                    Free-tier eligibility depends on your Google project. A
                    billed project can incur charges. Google’s free tier may use
                    submitted content to improve its products.{" "}
                    <a
                      href="https://ai.google.dev/gemini-api/docs/pricing"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Pricing and data terms
                    </a>.
                  </>
                )
                : (
                  <>
                    OpenAI API usage is billed to the connected API project.
                    Your ChatGPT subscription does not cover these requests.
                  </>
                )}
              <p className="mt-2">
                Madison will not switch to another provider if a request fails.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="writing-connection">Connection</Label>
              <Select
                value={settings.keySource}
                onValueChange={(v) => {
                  setApiKey("");
                  update({ keySource: v as WritingSettings["keySource"] });
                }}
                disabled={disabled}
              >
                <SelectTrigger id="writing-connection">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="managed">
                    Existing Madison connection
                  </SelectItem>
                  <SelectItem value="custom">
                    Use my organization’s key
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {snapshot.connections[settings.provider][settings.keySource]
                  ? "A key is connected."
                  : "No key is connected for this option."}
              </p>
            </div>
            {settings.keySource === "custom" && snapshot.canEdit && (
              <div className="space-y-2">
                <Label htmlFor="writing-key">
                  {snapshot.connections[settings.provider].custom
                    ? "Replace API key (optional)"
                    : "API key"}
                </Label>
                <Input
                  id="writing-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setNotice("");
                  }}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={disabled}
                  placeholder={snapshot.connections[settings.provider].custom
                    ? "Leave empty to keep the saved key"
                    : "Paste your provider’s API key"}
                />
                <p className="text-sm text-muted-foreground">
                  Stored encrypted on the server for your organization. Saved
                  keys are never displayed or returned to your browser.
                </p>
              </div>
            )}
            {snapshot.canEdit && (
              <div className="space-y-2">
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => act("test")}
                    disabled={disabled || !connected || !settings.model}
                  >
                    {busy === "test" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}Test connection
                  </Button>
                  <Button
                    onClick={() => act("save")}
                    disabled={disabled || !connected || !settings.model}
                  >
                    {busy === "save" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}Save writing settings
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Testing sends a short request and may incur a small charge on
                  paid models.
                </p>
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
        {notice && (
          <p role="status" className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            {notice}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
