// One-off: generate a realistic 3/4-view (turned ~35°) closed-mouth portrait via
// Gemini, for a real PROFILE test fixture — the warp's home turf, which the e2e
// currently fakes with a front-on face. MediaPipe detects up to ~70-85° turn, so
// a 3/4 view both exercises the angle-aware projection AND detects reliably.
// Run: node --env-file=.env.local scripts/make-profile-fixture.mjs
import { writeFileSync } from "node:fs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!key) throw new Error("no GEMINI_API_KEY");

const google = createGoogleGenerativeAI({ apiKey: key });
const res = await generateText({
  model: google("gemini-2.5-flash-image"),
  providerOptions: { google: { responseModalities: ["IMAGE"] } },
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "A photorealistic head-and-shoulders portrait of a person with their " +
            "head turned about 35 degrees to a three-quarter view (you can see the " +
            "side of the nose and the jawline in profile, but both eyes are still " +
            "visible). Relaxed neutral expression, mouth gently CLOSED, no teeth. " +
            "Even soft studio lighting, plain light background, sharp focus, " +
            "natural skin texture. Centered, face fills most of the frame.",
        },
      ],
    },
  ],
});

const img = res.files.find((f) => f.mediaType.startsWith("image/"));
if (!img) throw new Error("no image back (refusal?)");
writeFileSync("public/dev-profile.jpg", Buffer.from(img.base64, "base64"));
console.log("wrote public/dev-profile.jpg");
