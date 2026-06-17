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
      why: "Injectors often discuss a subtle lip enhancement to bring the lower lip toward the classic ~1.6:1 ratio that reads full but natural — usually starting conservatively.",
      confidence: "medium",
      priority: 2,
    });
  } else if (m.lipVerdict === "long") {
    areas.push({
      area: "lips",
      title: "Lip balance",
      observation: "Your lower lip carries more height than the upper.",
      why: "A small amount of upper-lip support is sometimes discussed to even the balance, rather than adding overall volume.",
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
      why: "Chin filler is commonly discussed to lengthen and balance the lower third and define the profile. Projection is best confirmed from a side view in a consult.",
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
      why: "Jawline filler is often discussed to add definition and a cleaner angle — a popular, structure-led treatment, especially for a stronger profile.",
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
      why: "An injector may discuss small, targeted adjustments to even balance. This is best evaluated in person.",
      confidence: "low",
      priority: 5,
    });
  }

  areas.sort((a, b) => a.priority - b.priority);

  const summary = areas.length
    ? "Here's what a skilled injector would likely notice about your facial balance. These are starting points for a conversation, not a plan."
    : "Your proportions read well-balanced overall. An injector might still discuss subtle, optional refinements in person.";

  return { summary, areas };
}
