import { NextResponse } from "next/server";

import Groq from "groq-sdk";

import type {
  AdvisorContext,
  AdvisorResult,
  RiskBand,
} from "@/types";

// HAVEN's heat-safety advisor. The model's job is to EXPLAIN the
// already-computed deterministic risk data (score, factors, trend, conditions)
// in plain language tailored to the person — it must never invent numbers,
// scores, or trend figures. The deterministic engine is the source of truth;
// the LLM is only the narrator.

const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are HAVEN's heat-safety advisor. You explain ALREADY-COMPUTED risk data in calm, plain language and give practical heat-safety guidance tailored to this person.

You MUST NOT invent or change any numbers, scores, risk levels, or trend figures — use ONLY the values provided in the context. Do not contradict the provided band or score.

You are not a doctor. For medical emergencies (chest pain, confusion, fainting) tell them to call emergency services. Do not give specific medical dosing or diagnosis.

Be concise, warm, non-alarmist. Tailor to the profile (e.g. 65+, no AC, outdoor worker, heart/respiratory conditions) — these are why their risk is what it is.

Return ONLY valid JSON, no markdown, no preamble, no code fences. The JSON shape MUST be exactly:
{
  "headline": "<one calm sentence summarizing today for THIS person>",
  "why": "<1-2 sentences explaining the score using the factors>",
  "actions": ["<concrete action 1>", "<concrete action 2>"],
  "trendNote": "<one plain sentence about the place's trajectory, faithful to the trend summary>"
}
"actions" must contain 2-4 short strings, prioritized.
If the provided trend.direction is "flat" but earlyAvg differs from recentAvg, acknowledge both faithfully — do not over-claim a trend.`;

const BAND_LABEL: Record<RiskBand, string> = {
  green: "Low",
  yellow: "Moderate",
  orange: "High",
  red: "Severe",
};

function firstCity(label: string): string {
  return label.split(",")[0]?.trim() || "this area";
}

function buildFallback(ctx: AdvisorContext): AdvisorResult {
  const city = firstCity(ctx.place.label);
  const bandLabel = BAND_LABEL[ctx.score.band];
  const topFactors = ctx.score.factors
    .slice(0, 3)
    .map((f) => f.label.toLowerCase())
    .join(", ");

  const baseActions = [
    "Hydrate before you feel thirsty — water beats sugary drinks.",
    "Take breaks in shade or air conditioning, especially mid-afternoon.",
  ];
  if (!ctx.profile.hasAC) {
    baseActions.push(
      "Find a cool space (library, mall, cooling center) during the hottest hours.",
    );
  }
  if (ctx.profile.outdoorWorker) {
    baseActions.push(
      "Reschedule strenuous outdoor work to early morning or evening if possible.",
    );
  }
  if (ctx.profile.ageBand === "65plus" || ctx.profile.conditions.length > 0) {
    baseActions.push(
      "Check on yourself or a loved one regularly — call emergency services for chest pain, confusion, or fainting.",
    );
  }

  return {
    headline: `${bandLabel} heat risk in ${city} today.`,
    why: `Your ${ctx.score.score}/100 score reflects ${topFactors || "today's conditions"}.`,
    actions: baseActions.slice(0, 4),
    trendNote: ctx.trend?.summary ?? "Long-term trend not available for this location.",
  };
}

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function isAdvisorResult(x: unknown): x is AdvisorResult {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.headline === "string" &&
    typeof r.why === "string" &&
    Array.isArray(r.actions) &&
    r.actions.every((a) => typeof a === "string") &&
    typeof r.trendNote === "string"
  );
}

export async function POST(request: Request) {
  let context: AdvisorContext;
  try {
    context = (await request.json()) as AdvisorContext;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // No key configured — return the deterministic fallback so the UI always
    // has something safe to render. Vercel must have GROQ_API_KEY set for the
    // real LLM path.
    return NextResponse.json(buildFallback(context));
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(context) },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const text = stripFences(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(buildFallback(context));
    }

    if (!isAdvisorResult(parsed)) {
      return NextResponse.json(buildFallback(context));
    }

    return NextResponse.json({
      headline: parsed.headline,
      why: parsed.why,
      actions: parsed.actions.slice(0, 4),
      trendNote: parsed.trendNote,
    });
  } catch {
    return NextResponse.json(buildFallback(context));
  }
}
