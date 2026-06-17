/**
 * Deterministic baseline assessment — rules that turn measurements into
 * educational observations. This runs on-device with no AI, so the user always
 * gets a real, private result. The AI layer (opt-in) refines and adds the
 * soft-tissue reads geometry can't see.
 *
 * Tone rule everywhere: describe what an injector would *notice and discuss*,
 * and why — never "you need X." See DISCLAIMER.
 */
import type { Assessment, AssessmentArea } from "./assessment-schema";
import type { Measurements } from "./measurements-schema";

export function baselineAssessment(m: Measurements): Assessment {
  const areas: AssessmentArea[] = [];

  // --- Lips ---
  if (m.lipVerdict === "short") {
    areas.push({
      area: "lips",
      title: "Lip proportion",
      observation:
        "Your upper and lower lip are close in height, which can read a little thin in balance.",
      why: "We'd often suggest a subtle lip enhancement to bring the lower lip toward the natural ~1.6:1 ratio — full, never overdone.",
      confidence: "medium",
      priority: 2,
    });
  } else if (m.lipVerdict === "long") {
    areas.push({
      area: "lips",
      title: "Lip balance",
      observation: "Your lower lip carries more height than the upper.",
      why: "We might add a touch of support to the upper lip to even the balance, rather than more volume.",
      confidence: "medium",
      priority: 3,
    });
  }

  // --- Chin / lower third ---
  if (m.lowerThird === "short") {
    areas.push({
      area: "chin",
      title: "Chin & lower third",
      observation:
        "Your lower third sits a touch shorter than the upper and middle thirds.",
      why: "We often use chin filler to lengthen and balance the lower third and sharpen the profile — though projection is best judged from the side, in person.",
      confidence: "low",
      priority: 1,
    });
  }

  // --- Jawline ---
  if (m.jawVerdict === "narrow") {
    areas.push({
      area: "jawline",
      title: "Jawline definition",
      observation:
        "Your jaw width is narrower relative to your cheekbones than the typical balanced range.",
      why: "We'd look at jawline filler to add definition and a cleaner angle — a popular, structure-led treatment for a stronger profile.",
      confidence: "low",
      priority: 2,
    });
  }

  // --- Symmetry (informational, never alarmist) ---
  if (m.asymmetry > 0.08) {
    areas.push({
      area: "chin",
      title: "Subtle asymmetry",
      observation:
        "There's a mild left-right asymmetry, which is completely normal — almost everyone has some.",
      why: "We can sometimes even this out with small, targeted adjustments — best judged in person.",
      confidence: "low",
      priority: 5,
    });
  }

  areas.sort((a, b) => a.priority - b.priority);

  const summary = areas.length
    ? "Here are a few things we might talk through, based on your proportions. It's just a starting point — your features are best read in person, which is what a consultation's for."
    : "Your features read beautifully balanced — there's nothing we'd push. If you're curious, we might still point out a subtle refinement or two in person.";

  return { summary, areas };
}
