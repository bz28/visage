// One-off: edit test-face.jpg to a relaxed CLOSED mouth via Gemini, for a
// closed-mouth test fixture (the gated norm, where the lip texture-finish lands).
// Run: node --env-file=.env.local scripts/make-closed-mouth-fixture.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!key) throw new Error("no GEMINI_API_KEY");

const src = readFileSync("test/fixtures/test-face.jpg");
const dataUrl = `data:image/jpeg;base64,${src.toString("base64")}`;

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
            "Edit this photo so the person has a relaxed, gently CLOSED mouth — " +
            "lips softly together, NO teeth showing, a calm neutral expression. " +
            "Keep EVERYTHING else identical: same identity, face shape, skin, " +
            "eyes, hair, lighting, pose, framing, and background. Photorealistic. " +
            "Output only the edited photo.",
        },
        { type: "image", image: dataUrl },
      ],
    },
  ],
});

const img = res.files.find((f) => f.mediaType.startsWith("image/"));
if (!img) throw new Error("no image back (refusal?)");
writeFileSync("test/fixtures/test-face-closed.jpg", Buffer.from(img.base64, "base64"));
console.log("wrote test/fixtures/test-face-closed.jpg");
