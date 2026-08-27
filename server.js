/**
 * KaamBatao — Backend server
 * -----------------------------------------------------------
 * A small Express server whose only job right now is to expose
 * POST /api/analyze, which securely forwards an uploaded image
 * to an AI vision API and returns a structured explanation.
 *
 * The AI API key NEVER touches the frontend — it lives only in
 * this server's environment variables (see .env.example).
 * -----------------------------------------------------------
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");
const chatRouter = require("./routes/chat");

const app = express();
const PORT = process.env.PORT || 4000;

// Allow requests from your frontend. In production, replace "*"
// with your actual deployed frontend URL for better security.
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
  })
);

app.use(express.json());

// Simple health check — useful to confirm the backend is alive
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    analyzeConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    chatConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.use("/api/analyze", analyzeRouter);
app.use("/api/chat", chatRouter);

app.listen(PORT, () => {
  console.log(`Tavunera backend running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠️  ANTHROPIC_API_KEY is not set. /api/analyze will return a clear " +
        "'not configured' error until you add it to your .env file."
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "⚠️  OPENAI_API_KEY is not set. /api/chat will return a clear " +
        "'not configured' error until you add it to your .env file."
    );
  }
});
