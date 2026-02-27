// Cosmic Loops - Generate Phrases Edge Function
// Proxies Anthropic API calls with server-side API key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const VOICE_SYSTEM_PROMPT = `You are the voice of Cosmic Loops. You write in the register of a poet who also understands astronomy — spare, grounded, warm. Never explain. Never decorate. Never use the words "embrace", "journey", "beautiful", "harness", or "tap into". Name where the person is in the cycles with the precision of someone who has been watching the sky for a long time. Each phrase should feel like something that could be carved into stone or whispered at dawn. Terse is better than elaborate. One sentence is better than two. Return only a valid JSON object with the exact keys provided. No preamble, no explanation, no markdown.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const { cycleState } = await req.json();

    if (!cycleState) {
      throw new Error("cycleState is required");
    }

    const userPrompt = buildContext(cycleState);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: VOICE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const text = data.content.find((b: { type: string }) => b.type === "text")?.text || "";

    // Parse the JSON response
    const phrases = JSON.parse(text);

    return new Response(JSON.stringify({ phrases }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating phrases:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

function buildContext(state: {
  phase: string;
  moonAge: number;
  pct: number;
  zodiac: string;
  phaseType: string;
  phaseStatus: string;
  remainingHours: number;
  nextPhase: string;
  nextEnergy: string;
  season: string;
  daysFromLastThreshold?: number;
  daysToNextThreshold?: number;
}) {
  return `Generate phrases for these 10 surfaces given the exact cycle state below.

CYCLE STATE:
- Lunar phase: ${state.phase} (day ${state.moonAge.toFixed(1)} of 29.5, ${state.pct}% illuminated)
- Moon in: ${state.zodiac}
- Phase type: ${state.phaseType === 'threshold' ? 'Threshold — a turning point, short and potent' : 'Flow — sustained energy, the work happens here'}
- Phase position: ${state.phaseStatus} — ${state.remainingHours.toFixed(0)} hours remaining in this phase
- Next phase: ${state.nextPhase} (${state.nextEnergy})
- Solar season: ${state.season}
- Days past last solar threshold: ${state.daysFromLastThreshold ?? 'unknown'}
- Days to next solar threshold: ${state.daysToNextThreshold ?? 'unknown'}
- Solar cycle: near maximum (heightened electromagnetic output)
- Natal: Sun Libra 0.6°, Moon Scorpio 21.1°, Rising Libra 23.5°

SURFACES — return exactly these keys:
{
  "phaseGuidance": "1 sentence for the main Sky tab. Names what this phase asks of the person right now.",
  "cosmicSynthesis": "1 sentence. Reads the lunar phase + solar season + solar cycle together. What are they all saying at once?",
  "energyDescription": "3–5 words only. The felt quality of this phase. Not the phase name.",
  "phaseBanner": "1 sentence for the Loops tab banner. What this phase wants from the person's loops.",
  "addLoopPrompt": "A question, 4–7 words. What wants to open as a loop right now?",
  "newMoonQuestion": "Only generate if phase is New Moon. Otherwise: null. The ceremonial question for setting the cycle intention.",
  "echoesWritePrompt": "A question or open invitation, 6–12 words. What to write about right now.",
  "echoesVoicePrompt": "2–5 words. The voice listening prompt. What to speak into.",
  "transitionInvitation": "1 sentence. If within 24h of next phase, speak to the incoming energy. Otherwise speak to the current phase closing.",
  "deepSheetPhase": "2–3 sentences. The deeper texture of this phase — body, emotion, what it asks and what it gives."
}`;
}
