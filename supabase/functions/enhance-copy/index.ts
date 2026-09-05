import { withWritingAi } from "../_shared/writingAiEdge.ts";
/**
 * Enhance Copy - AI-powered text enhancement for image overlays
 * 
 * Uses Gemini to enhance headlines and subtext for product images,
 * making them more compelling and brand-appropriate.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateWriting } from "../_shared/writingAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(withWritingAi(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headline, subtext, context, style } = await req.json();

    if (!headline && !subtext) {
      return new Response(
        JSON.stringify({ error: "Either headline or subtext is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const prompt = `You are a luxury brand copywriter. Enhance the following text for a product image overlay.

Context: ${context || "luxury product advertisement"}
Style: ${style || "elegant, compelling, sophisticated"}

Current text:
${headline ? `Headline: "${headline}"` : ""}
${subtext ? `Subtext: "${subtext}"` : ""}

Rules:
1. Keep the enhanced text SHORT and PUNCHY (headline max 5 words, subtext max 10 words)
2. Make it sound luxurious and compelling
3. Maintain the core message but elevate the language
4. Use action words and emotional triggers
5. Avoid clichés

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"headline": "enhanced headline here", "subtext": "enhanced subtext here"}

If only headline was provided, only enhance headline. If only subtext was provided, only enhance subtext.`;

    const result = await generateWriting({ messages: [{ role: 'user', content: prompt }], responseMimeType: 'application/json' });
    const responseText = result.text.trim();

    // Parse the JSON response
    let enhanced;
    try {
      // Remove any markdown code blocks if present
      const cleanJson = responseText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      enhanced = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      // Fallback
      enhanced = {
        headline: headline ? headline.toUpperCase() : null,
        subtext: subtext || null,
      };
    }

    return new Response(
      JSON.stringify({
        headline: enhanced.headline || headline,
        subtext: enhanced.subtext || subtext,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("❌ Enhance copy error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to enhance text",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
}));
