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
import type { Intake } from "./intake-schema";

export function baselineAssessment(
  m: Measurements,
  intake?: Intake,
): Assessment {
  const areas: AssessmentArea[] = [];
  const masculine = intake?.look === "masculine";

  // --- Lips (a fuller lip is more commonly a feminine goal) ---
  if (m.lipVerdict === "short" && !masculine) {
    areas.push({
      area: "lips",
      title: "Lip proportion",
      observation:
        "Your upper and lower lip are close in height, which can read a little thin in balance.",
      why: "Lips are a common thing to talk through here — a little more in the lower lip can balance the two, the kind of full that still looks like you. Best explored in person.",
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
      why: "The chin is a common area people explore to balance a shorter lower third and refine the profile — though projection is really best judged from the side, in person.",
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
      why: "The jawline is a popular area to discuss for added definition and a cleaner angle — a structure-led look that's worth exploring together.",
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
