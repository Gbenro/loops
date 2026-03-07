// Cosmic Loops - Generate Phrases Edge Function
// Securely proxies Anthropic API calls for generative language

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Simple rate limiting (resets on cold start, but provides basic protection)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

const VOICE_SYSTEM_PROMPT = `You are the voice of Cosmic Loops. You write in the register of a poet who also understands astronomy — spare, grounded, warm. Never twee, never grandiose. Think Mary Oliver meets NASA mission control.

Your role: Generate 10 short phrases that will appear throughout the app. Each phrase should feel fresh yet timeless, specific to the current cosmic moment yet universally resonant.

CRITICAL CONSTRAINTS:
- Each phrase must be 3-12 words
- No clichés, no "journey" or "manifest" or "universe has plans"
- Ground abstractions in sensory detail
- Vary rhythm and structure across the set
- Match energy to the moon phase (waxing = building, full = peak/clarity, waning = releasing, new = stillness/seeds)

Return ONLY valid JSON with these exact keys:
{
  "phaseGuidance": "The main guidance for this phase - what to focus on",
  "cosmicSynthesis": "How the moon, zodiac, and season weave together now",
  "energyDescription": "2-3 word energy label for this moment",
  "phaseBanner": "A short phrase describing the phase energy",
  "addLoopPrompt": "What wants to open? / What needs attention?",
  "newMoonQuestion": "A question for the new moon intention",
  "transitionInvitation": "Invitation as the phase is about to shift",
  "deepSheetPhase": "Deeper insight about this phase's meaning",
  "deepSheetMoon": "Insight about this lunar month's quality",
  "deepSheetSign": "How the moon in this zodiac sign affects you",
  "deepSheetSeason": "The seasonal energy right now",
  "deepSheetWeave": "How all the cycles weave together in this moment",
  "deepSheetArcs": "The larger patterns at play behind your days",
  "deepSheetNatal": "How the sky relates to your personal chart",
  "echoesWritePrompt": "Prompt for written reflection",
  "echoesVoicePrompt": "Prompt for voice reflection"
}`;

const ALLOWED_ORIGINS = [
  "https://lunaloops.app",
  "https://www.lunaloops.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] ||
                   req.headers.get("cf-connecting-ip") ||
                   "unknown";

  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.warn("Rate limit exceeded for IP:", clientIP);
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please wait a minute." }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const { cycleState } = await req.json();

    const userPrompt = `Current cosmic state:
- Moon Phase: ${cycleState.phase} (${cycleState.phaseStatus})
- Moon Age: ${cycleState.moonAge} days
- Illumination: ${cycleState.pct}%
- Moon in: ${cycleState.zodiac}
- Phase Type: ${cycleState.phaseType}
- Hours remaining in phase: ${cycleState.remainingHours}
- Next phase: ${cycleState.nextPhase} (${cycleState.nextEnergy} energy)
- Season: ${cycleState.season}
- Days from last threshold: ${cycleState.daysFromLastThreshold}
- Days to next threshold: ${cycleState.daysToNextThreshold}

Generate the 10 phrases for this moment. Remember: spare, specific, no clichés.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: VOICE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Parse the JSON response
    const phrases = JSON.parse(jsonStr);

    console.log("Generated phrases:", phrases);

    return new Response(JSON.stringify({ phrases }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
