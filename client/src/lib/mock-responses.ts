/**
 * Realistic-looking mocked responses. Each model has a distinct "voice":
 *  - GPT-5 / GPT-4o: structured, hedged, balanced
 *  - Claude: more literary, careful, paragraph-driven
 *  - Gemini: research-oriented, lists facts, cites
 *  - Llama: direct, slightly informal
 *  - DeepSeek: technical, math-leaning
 *  - Grok: contrarian, dry humor
 */

const VOICES: Record<string, (q: string) => string> = {
  "gpt-5": (q) =>
    `Let me think through this carefully.

There are three angles worth separating before answering "${truncate(q)}":

1. The framing — what we're actually being asked. The implicit assumption here is that a single best answer exists, but for most questions of this shape the answer depends on constraints we haven't surfaced yet.
2. The evidence — what we can say with confidence versus what we're inferring. I'll mark inferences explicitly.
3. The recommendation — what I'd actually do given the most likely reading of the question.

On (1): the question collapses two distinct concerns into one. Separating them clarifies the trade-off.

On (2): the strongest piece of evidence is convergent — multiple independent sources point the same direction. The weakest is the timing, which is contested.

On (3): I'd start with the smallest reversible step that surfaces information, then commit harder once the signal is clear. The cost of being wrong on a small bet is low; the cost of being right early is high.

Happy to go deeper on any branch.`,

  "gpt-4o": (q) =>
    `Quick take on "${truncate(q)}":

The core question splits into two: what's true, and what to do about it. They're often confused.

What's true: the situation is more constrained than it looks. The headline framing oversells the optionality.

What to do: pick the option that preserves the most future moves. Optionality compounds.

I can expand on either branch — just say the word.`,

  "claude-opus-4": (q) =>
    `There's a way of approaching "${truncate(q)}" that I want to offer carefully, because the question is doing more work than it might appear to.

When we ask this, we are usually asking three things at once: what is the case, what we want to be the case, and what we believe we can change. These three things drift apart under pressure, and it is the gap between them — not the question itself — that is the source of the difficulty.

Start with the first. The empirical situation is, I think, less unsettled than it sometimes feels. Several converging observations point the same direction; the dissent is largely about emphasis. We can hold this conclusion lightly without holding it weakly.

The second question — what we want — deserves more honesty than it usually gets. Naming the preference plainly, rather than dressing it as analysis, tends to shorten arguments considerably.

The third — what we can change — is where most of the leverage actually lives. The reframing I would suggest is to look not for the right answer but for the most reversible next step.`,

  "claude-sonnet-4": (q) =>
    `On "${truncate(q)}" — a few things stand out.

The framing matters more than the answer. Most disagreements about questions like this turn out to be disagreements about which question we're answering, not about the facts. So I'd start by naming the version you actually care about.

Once that's settled, the path narrows quickly. The strongest move is usually the one that buys information at the lowest cost — small bets, reversible commitments, and explicit checkpoints where you decide whether to keep going.

I can sketch a concrete plan if useful.`,

  "gemini-2.5-pro": (q) =>
    `Research summary on "${truncate(q)}":

Key findings:
• Three recent surveys (2024) converge on the same direction with moderate confidence.
• The methodology in two of the three is broadly aligned; the third uses a different sampling frame and may not be directly comparable.
• Counter-evidence exists but is concentrated in a single cluster of sources that share authors.

Notable references:
• Chen et al. (2024) — large-N observational study; clean design, limited generalization.
• Park & Owusu (2023) — natural experiment with strong identification.
• Bauer (2024, working paper) — dissenting view; not yet peer-reviewed.

Synthesis: the weight of evidence supports the mainstream interpretation, with two qualifications worth tracking — the time horizon over which the effect persists, and whether it holds in lower-resource settings where most of the original data was not collected.

Want me to drill into any of the underlying studies?`,

  "llama-4": (q) =>
    `Honestly, "${truncate(q)}" is one of those questions where the obvious answer is mostly right but for the wrong reasons.

The obvious answer: yes, the mainstream view holds.
The actual reason: it's not that the alternatives are wrong — most of them have a defensible core — it's that they require assumptions that don't survive contact with how this stuff actually plays out in practice.

So: go with the boring answer, but understand why the spicy ones keep showing up. They're tracking real friction in the standard story.`,

  "deepseek-v3": (q) =>
    `Working through "${truncate(q)}" formally.

Let \\( X \\) denote the variable of interest and \\( \\Theta \\) the parameter space. We want \\( \\arg\\max_{\\theta \\in \\Theta} P(X \\mid \\theta) \\) subject to the constraints implied by the question.

Three observations:
(i) The posterior concentrates more tightly than the prior would suggest, indicating the data is informative.
(ii) The MAP estimate and the posterior mean diverge slightly, hinting at skew in the likelihood — worth checking before acting.
(iii) Sensitivity to the prior is low in the relevant region, which is reassuring.

Practical translation: the answer is robust to most reasonable modeling choices. If we were going to be wrong, it would be on the tails — the rare cases where the standard assumptions break down.`,

  "grok-3": (q) =>
    `Okay, "${truncate(q)}" — the answer everyone wants is the cautious one, and the answer everyone actually needs is slightly spicier than that.

The cautious answer is fine. It will not get you fired. It will also not get you anywhere.

The spicier reading: most of the debate around this is really a proxy fight about something else — incentives, status, or who gets to be in the room. Once you notice that, the surface arguments stop mattering as much.

My take: pick the option that's easiest to reverse if you're wrong, and that makes the proxy fight visible if you're right.`,
};

function truncate(s: string, n: number = 80): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n) + "…" : t || "your question";
}

export function mockResponse(modelId: string, userText: string): string {
  const voice = VOICES[modelId] ?? VOICES["gpt-5"];
  return voice(userText);
}

/* Pre-written outputs for orchestration workflows so the chain feels intentional */
export const WORKFLOW_OUTPUTS = {
  draftCritiqueRefine: {
    draft: (input: string) =>
      `Draft v1 on ${stripPrompt(input)}:

The question sits at the intersection of two long-running tensions: the pull toward shorter feedback loops, and the pull toward larger, harder-to-reverse commitments. Most teams resolve this implicitly, by defaulting to whichever mode their environment rewards. The teams that resolve it explicitly — by naming which mode they're in this quarter — outperform.

The first move is to map the work into two columns: what is reversible within a week, and what is not. The reversible work belongs to fast iteration; the irreversible work deserves slower, more deliberate process. Confusing the two is the single most expensive mistake.

The second move is to build the muscle of asking, before any significant commitment: "what would convince me I was wrong, and how cheaply can I get that signal?" Teams that ask this routinely make better bets — not because they're smarter, but because they're cheaper to be wrong.`,
    critique: () =>
      `Critique of the draft:

Strengths:
• Clear core argument (reversible vs. irreversible).
• Concrete second-move heuristic that's easy to remember.

Weaknesses:
• The opening is abstract. A reader doesn't yet know whose problem this is or why they should care by the end of sentence one.
• The two-column framing is good but underdeveloped — we never see what falls into each column in a real example.
• "Outperform" is a load-bearing claim and goes unsupported. Either soften it or back it.
• No counter-argument addressed. The piece would be stronger if it conceded the case for batching irreversible decisions together (cheaper, sometimes, despite the surface logic).

Recommended revisions:
1. Lead with a concrete example.
2. Tighten the abstract framing into one sentence.
3. Add a paragraph acknowledging when the heuristic breaks.`,
    refine: () =>
      `Refined version:

A team I worked with last year shipped twelve small experiments and one large reorg in the same quarter. The experiments succeeded or failed within a week and taught us something each time. The reorg cost six months of momentum and we are still not sure if it worked. Same team, same quarter, opposite economics.

That is the distinction worth building a process around: reversible work and irreversible work want completely different treatment. Reversible work rewards velocity — many small bets, fast feedback, cheerful tolerance for being wrong. Irreversible work rewards deliberation — fewer commitments, more pre-mortems, expensive conviction.

The single most useful question, before any commitment, is the cheap one: "what would convince me I'm wrong, and how fast can I find out?" When that question is cheap to answer, move fast. When it's expensive, slow down.

The honest counter-argument is that batching irreversible decisions has real benefits — coherent strategy, fewer context switches, a single political fight instead of five. That's true, and worth respecting. But it's the exception, not the operating mode. Default to separating the two, and batch only when the costs of separation are obvious and large.`,
  },
  researchAnalyzeSummarize: {
    research: (input: string) =>
      `Research notes on ${stripPrompt(input)}:

Primary sources reviewed:
• Three industry surveys from the last 18 months (n > 800 each).
• Two academic working papers using observational data.
• Earnings transcripts from the four largest public players in the space.

Convergent findings:
1. Adoption has accelerated since late 2023, with the steepest growth in mid-market segments.
2. Cost-per-unit-output has fallen approximately 5–7x over the same window.
3. Quality variance across providers has widened, not narrowed — counter to the early consensus.

Open questions:
• Whether the cost decline is sustainable at current investment levels.
• How regulation in the EU and emerging markets will alter the competitive landscape.
• Whether the open-source tier reaches feature parity in 2025 or 2026.`,
    analyze: () =>
      `Analysis:

The research presents a picture of a market in mid-adoption with two structural surprises.

First, the cost curve is real but the quality dispersion suggests that "AI" is rapidly becoming a misleading category — what users buy is increasingly a specific provider's stack, not the underlying capability. This will likely produce stronger lock-in than the early reports anticipated.

Second, the mid-market acceleration is the more strategically important signal. Mid-market buyers tend to commit harder and switch less than either enterprise or SMB. If they are anchoring now, the next 24 months may compress the addressable market faster than headcount projections imply.

Risk factors that deserve more weight than they receive in the source material: regulatory drag, infrastructure constraints, and the possibility that the cost curve flattens once frontier models stop subsidizing inference.`,
    summarize: () =>
      `Executive summary:

The space is in mid-adoption with falling unit costs (5–7x) and rising provider differentiation. Mid-market is the segment driving the curve; enterprise is slower; SMB is fragmented. Quality dispersion across providers is widening, which favors lock-in and makes provider choice more strategically consequential than it looked twelve months ago.

Three implications:
• Choose the provider stack carefully — switching costs are growing.
• Watch the mid-market segment for the strongest near-term signal.
• Build the optionality to absorb a regulatory shock; it is the most likely source of disruption.`,
  },
  debate: {
    pro: (input: string) =>
      `Arguing for ${stripPrompt(input)}:

The case rests on three observations.

First, the historical track record is unambiguous. Every comparable transition produced the same pattern: early skepticism, a period of overpromising, then a quiet decade in which the technology became the substrate everything else ran on. The current moment fits the pattern.

Second, the cost curve. When the cost of a thing falls reliably and steeply, demand rises non-linearly. We are watching that play out in real time.

Third, the second-order effects. The first-order use cases are interesting but limited. The second-order effects — what becomes possible because the first-order capability is cheap and ubiquitous — are where the value accrues. We have not begun to see them.`,
    con: () =>
      `Arguing against:

Three reasons to be skeptical.

First, the historical analogy cuts both ways. Yes, some transitions followed the pattern described. Many did not. Survivorship bias is doing heavy lifting in the optimistic case.

Second, the cost decline is partially synthetic. A large share of the apparent cost drop is venture subsidy, not technological improvement. When that ends — and it will — the unit economics may look quite different.

Third, the second-order argument is unfalsifiable in its current form. If the value is always one layer further out, the claim cannot be tested and should be treated with the suspicion that any unfalsifiable claim earns.`,
    judge: () =>
      `Judge's verdict:

Both sides land partial blows. The pro side has the stronger empirical anchor: the cost curve is real, the second-order argument has historical precedent. The con side has the sharper epistemological point: the optimistic case relies on selecting analogies that fit, and the cost-decline argument deserves the scrutiny it received.

On balance, the pro position is more likely correct in direction, but the con position is more likely correct in magnitude — the effect will be real but smaller and slower than the most enthusiastic forecasts. A reasonable observer should bet on the trend while sizing the bet for the con side's correction.`,
  },
  translate: {
    spanish: (input: string) =>
      `Traducción al español: La idea central de "${truncate(stripPrompt(input), 60)}" se traduce con razonable fidelidad, aunque las connotaciones idiomáticas del original se aplanan ligeramente — particularmente los matices de tono que en inglés dependen del orden de las palabras.`,
    japanese: () =>
      `日本語訳: 元の主張の論理構造はおおむね保たれていますが、文の主語が明示されることで、英語版にあった含みのあるニュアンスがやや直接的になっています。`,
    arabic: () =>
      `الترجمة العربية: تنتقل الفكرة الأساسية بوضوح، ولكن البنية البلاغية للغة العربية تضفي وزنا إضافيا على الجملة الافتتاحية لم يكن مقصودا في النص الأصلي.`,
    back: () =>
      `Translated back to English:

"The central idea has remained largely intact, but three things have shifted in transit. The implied subject — which the original English left ambiguous on purpose — has been forced into the open, making the claim sound more confident than the author intended. The rhetorical weight has migrated from the verb to the opening clause. And a small amount of irony, present in the original phrasing, has been smoothed away entirely.

The information survived. The voice did not."`,
  },
};

function stripPrompt(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "the question";
  return trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed;
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Synthesis response used by Compare mode */
export function mockSynthesis(): string {
  return `Synthesizing across responses:

The three answers converge on a common skeleton — separate the reversible from the irreversible, ask the cheap falsification question early, and treat the rest as bets sized to their reversibility. Where they differ is in tone, not substance.

The most useful contributions from each:
• The first response provided the cleanest framing of the two-column model.
• The second sharpened the practical heuristic ("what would convince me I'm wrong?") into something portable.
• The third surfaced the strongest counter-argument — that batching irreversible decisions has its own benefits — and dealt with it honestly.

Final position: act on the consensus, with the third response's caveat as a guardrail. The synthesis is stronger than any individual response because it inherits the discipline of all three.`;
}
