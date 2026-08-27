/**
 * POST /api/chat
 * -----------------------------------------------------------
 * Accepts a JSON body:
 * {
 *   "message": "user's new message",
 *   "conversation": [ { "role": "user"|"assistant", "content": "..." }, ... ]
 * }
 *
 * Calls OpenAI's official server-side SDK using OPENAI_API_KEY
 * (backend-only, never sent to the frontend) and returns:
 * {
 *   "reply": "AI response"
 * }
 *
 * If OPENAI_API_KEY is not set, this route responds with a clear
 * 501 error instead of ever inventing a fake reply.
 * -----------------------------------------------------------
 */

const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const SYSTEM_PROMPT = `You are Tavunera, a friendly, helpful AI assistant for everyday Indian users. Reply in simple, natural Hinglish (a mix of Hindi and English, written in Roman/Latin script) when the user writes in Hinglish or Hindi, and in plain English when the user writes in English. Keep answers clear, honest, and not unnecessarily long.`;

// Basic shape validation for the incoming conversation history.
function sanitizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20) // keep only the most recent turns to stay within token limits
    .map((m) => ({ role: m.role, content: m.content }));
}

router.post("/", async (req, res) => {
  try {
    const { message, conversation } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Koi message nahi mila. Pehle kuch likhein." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(501).json({
        message:
          "Chat backend abhi configure nahi hai. Server par OPENAI_API_KEY environment variable set karein (README dekhein).",
      });
    }

    const client = new OpenAI({ apiKey });

    const history = sanitizeConversation(conversation);

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: message.trim() },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({ message: "AI se jawab nahi mila. Phir try karein." });
    }

    return res.json({ reply });
  } catch (err) {
    // Log full detail server-side only; never leak internals to the client.
    console.error("Unexpected /api/chat error:", err?.status || "", err?.message || err);

    if (err?.status === 401) {
      return res.status(502).json({ message: "AI service authentication fail hui. API key check karein." });
    }
    if (err?.status === 429) {
      return res.status(502).json({ message: "AI service abhi busy hai. Thodi der baad try karein." });
    }

    return res.status(500).json({ message: "Kuch galat ho gaya. Phir try karein." });
  }
});

module.exports = router;
