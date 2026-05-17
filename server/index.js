import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://speakmate.kurukshetraanalytics.com",
        ],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json({ limit: "10mb" }));

const voiceMap = {
    british_female: "shimmer",
    british_male: "verse",
    american_female: "alloy",
    american_male: "echo",
    indian_female: "sage",
    indian_male: "ballad",
};

app.get("/", (req, res) => {
    res.send("✅ SpeakMate backend is running");
});

// ── Session endpoint: creates Realtime API session ────────────────────────────
app.post("/session", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing on server",
            });
        }

        const { voice = "british_female", speed = 1 } = req.body || {};
        const selectedVoice = voiceMap[voice] || "shimmer";

        const response = await fetch(
            "https://api.openai.com/v1/realtime/client_secrets",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session: {
                        type: "realtime",
                        model: "gpt-realtime-mini",
                        audio: {
                            input: {
                                transcription: {
                                    model: "gpt-realtime-whisper",
                                },
                                turn_detection: null,
                            },
                            output: {
                                voice: selectedVoice,
                                speed,
                            },
                        },
                        instructions: `
You are SpeakMate — a warm, patient English coach for beginners.
Your job is to help users improve their English through simple conversation.
Be encouraging and supportive. Keep everything simple and short.
For your first message: greet warmly and ask one simple everyday question.
`,
                    },
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI realtime session error:", data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error("Session error:", error);
        res.status(500).json({
            error: "Failed to create realtime session",
        });
    }
});

// ── Analyze endpoint: uses Chat Completions API ───────────────────────────────
app.post("/analyze", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing on server",
            });
        }

        const { userText } = req.body || {};

        if (!userText) {
            return res.status(400).json({
                error: "Missing userText",
            });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an English coach. Analyze the user's sentence and output EXACTLY these four sections:

[MISTAKES] Each grammar/vocabulary mistake as a bullet. If none, write "No mistakes! Great job."
[CORRECT] The corrected sentence. Wrap each corrected word in *asterisks*. If nothing needed fixing, repeat as-is.
[WHY] One simple sentence explaining each correction.
[NATIVE] How a confident native speaker would naturally say the same thing.

Output ONLY these four sections. No greeting, no question, no extra text.`,
                    },
                    {
                        role: "user",
                        content: userText,
                    },
                ],
                max_tokens: 300,
                temperature: 0.3,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI analyze error:", data);
            return res.status(response.status).json({
                error: "Analysis failed",
                details: data,
            });
        }

        const analysis = data.choices?.[0]?.message?.content || "";

        res.json({
            analysis,
        });
    } catch (error) {
        console.error("Analyze error:", error);
        res.status(500).json({
            error: "Analysis failed",
        });
    }
});
// Server static frontend in production (Removed - frontend is hosted on Hostinger)


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});