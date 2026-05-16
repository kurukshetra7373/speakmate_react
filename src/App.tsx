import { useRealtime } from "./hooks/useRealtime";
import { Bot, Mic, Volume2, AudioLines, User } from "lucide-react";
import { useState } from "react";



// ── extract a [SECTION] block ─────────────────────────────────────────────────
function extractSection(text: string, tag: string): string {
  const re = new RegExp(`\\[${tag}\\]\\s*(.*?)(?=\\[|$)`, "is");
  return text.match(re)?.[1]?.trim() ?? "";
}

// ── underline corrected words (wrapped in *asterisks*) ───────────────────────
function highlightCorrections(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith("*") && p.endsWith("*") ? (
      <span key={i} style={{
        textDecoration: "underline wavy #ef4444",
        textDecorationThickness: 2,
        color: "#b91c1c", fontWeight: 700,
        background: "#fef2f2", borderRadius: 3, padding: "0 3px",
      }}>
        {p.slice(1, -1)}
      </span>
    ) : p
  );
}

// ── speak button ──────────────────────────────────────────────────────────────
function SpeakBtn({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  function handleClick() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }

  return (
    <button
      onClick={handleClick}
      title="Listen"
      style={{
        border: "none", background: "transparent",
        cursor: "pointer", padding: "4px 6px", borderRadius: 8,
        display: "flex", alignItems: "center", gap: 4,
        color: speaking ? "#7c3aed" : "#94a3b8",
        fontSize: 12, fontWeight: 600,
        transition: "color 0.2s",
      }}
    >
      <Volume2 size={14} />
      {speaking ? "Playing…" : "Listen"}
    </button>
  );
}

// ── single card component ─────────────────────────────────────────────────────
function Card({
  emoji, label, labelColor, bg, border, children, speakContent,
}: {
  emoji: string; label: string; labelColor: string;
  bg: string; border: string;
  children: React.ReactNode;
  speakContent?: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: labelColor,
          textTransform: "uppercase", letterSpacing: "0.06em",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span>{emoji}</span> {label}
        </div>
        {speakContent && <SpeakBtn text={speakContent} />}
      </div>
      {children}
    </div>
  );
}

// ── feedback cards ────────────────────────────────────────────────────────────
function FeedbackCards({ text }: { text: string }) {
  const mistakes = extractSection(text, "MISTAKES");
  const correct  = extractSection(text, "CORRECT");
  const why      = extractSection(text, "WHY");
  const native   = extractSection(text, "NATIVE");

  // Plain AI message — opening question or no sections found
  if (!mistakes && !correct && !why && !native) {
    return (
      <p style={{ color: "#334155", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
        {text}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── mistakes ── */}
      {mistakes && (
        <Card emoji="❌" label="Mistakes" labelColor="#dc2626" bg="#fef2f2" border="#fecaca"
          speakContent={mistakes}>
          <p style={{ margin: 0, color: "#7f1d1d", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {mistakes}
          </p>
        </Card>
      )}

      {/* ── corrected sentence ── */}
      {correct && (
        <Card emoji="✅" label="Corrected sentence" labelColor="#0369a1" bg="#f0f9ff" border="#bae6fd"
          speakContent={correct.replace(/\*/g, "")}>
          <p style={{ margin: 0, color: "#0c4a6e", fontSize: 15, lineHeight: 1.7, fontStyle: "italic" }}>
            {highlightCorrections(correct)}
          </p>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 11 }}>
            Underlined = what was corrected
          </p>
        </Card>
      )}

      {/* ── grammar tip ── */}
      {why && (
        <Card emoji="💡" label="Grammar tip" labelColor="#92400e" bg="#fffbeb" border="#fde68a"
          speakContent={why}>
          <p style={{ margin: 0, color: "#78350f", fontSize: 13, lineHeight: 1.6 }}>
            {why}
          </p>
        </Card>
      )}

      {/* ── native speaker ── */}
      {native && (
        <Card emoji="🗣️" label="Native speaker would say" labelColor="#6d28d9" bg="#f5f3ff" border="#ddd6fe"
          speakContent={native}>
          <p style={{ margin: 0, color: "#3b0764", fontSize: 14, lineHeight: 1.7, fontWeight: 600 }}>
            "{native}"
          </p>
        </Card>
      )}


    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const {
    connect,
    disconnect,
    isConnected,
    isRecording,
    isAiSpeaking,
    messages,
    liveAiText,
    liveUserText,
    toggleRecording,
  } = useRealtime();

  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc", color: "#1e293b",
      fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column",
    }}>
      {/* ── header ── */}
      <header style={{
        padding: "16px 24px", background: "white", borderBottom: "1px solid #e2e8f0",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: "#7c3aed",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot color="white" size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>
              SpeakMate
            </h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontWeight: 500 }}>
              English Coach for Beginners
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isConnected && (
            <button
              onClick={disconnect}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid #fee2e2",
                background: "#fff1f1", color: "#ef4444", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              End
            </button>
          )}
          <div style={{
            padding: "6px 12px", borderRadius: 20,
            background: isConnected ? "#f0fdf4" : "#f1f5f9",
            border: `1px solid ${isConnected ? "#dcfce7" : "#e2e8f0"}`,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: isConnected ? "#22c55e" : "#94a3b8",
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: isConnected ? "#16a34a" : "#64748b" }}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* ── chat area ── */}
      <main style={{
        flex: 1, padding: "20px 16px 140px", maxWidth: 800, margin: "0 auto", width: "100%",
        display: "flex", flexDirection: "column",
      }}>
        {!isConnected && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center", gap: 20, opacity: 0.8,
          }}>
            <Mic size={48} color="#94a3b8" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>
              Ready to practise?
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
              Tap the mic, speak your answer, tap again when done.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              {msg.role === "ai" && (
                <div style={{
                  width: 32, height: 32, flexShrink: 0, borderRadius: "50%",
                  background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                  display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
                }}>
                  <Bot size={16} color="white" />
                </div>
              )}

              <div style={{
                maxWidth: "84%",
                background: msg.role === "ai" ? "#fff" : "#eef2ff",
                border: msg.role === "ai" ? "1px solid #e2e8f0" : "1px solid #c7d2fe",
                borderRadius: msg.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                padding: "14px 16px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                {msg.role === "ai" && msg.type === "analysis" ? (
                  <FeedbackCards text={msg.text} />
                ) : (
                  <p style={{ margin: 0, color: msg.role === "ai" ? "#334155" : "#312e81", fontSize: 14, lineHeight: 1.6 }}>
                    {msg.text}
                  </p>
                )}
              </div>

              {msg.role === "user" && (
                <div style={{
                  width: 32, height: 32, flexShrink: 0, borderRadius: "50%",
                  background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
                }}>
                  <User size={16} color="white" />
                </div>
              )}
            </div>
          ))}

          {/* ── live status ── */}
          {liveAiText && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: "50%",
                background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bot size={16} color="white" />
              </div>
              <div style={{
                maxWidth: "84%", background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: "4px 18px 18px 18px", padding: "14px 16px",
              }}>
                <p style={{ margin: 0, color: "#334155", fontSize: 14, lineHeight: 1.6 }}>{liveAiText}</p>
              </div>
            </div>
          )}

          {liveUserText && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "flex-end" }}>
              <div style={{
                maxWidth: "84%", background: "#eef2ff", border: "1px solid #c7d2fe",
                borderRadius: "18px 4px 18px 18px", padding: "14px 16px",
              }}>
                <p style={{ margin: 0, color: "#312e81", fontSize: 14 }}>{liveUserText}</p>
              </div>
              <div style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: "50%",
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
              }}>
                <User size={16} color="white" />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── mic bar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, width: "100%",
        background: "linear-gradient(to top, #f8fafc 65%, transparent)",
        paddingTop: 40, paddingBottom: 28,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        pointerEvents: "none",
      }}>
        {isAiSpeaking && isConnected && (
          <div style={{
            pointerEvents: "auto",
            display: "flex", alignItems: "center", gap: 6,
            background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: 20, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, color: "#1d4ed8",
          }}>
            <AudioLines size={14} />
            AI is asking the next question…
          </div>
        )}

        {isRecording && (
          <div style={{
            pointerEvents: "auto",
            display: "flex", alignItems: "center", gap: 6,
            background: "#fff5f5", border: "1px solid #fecaca",
            borderRadius: 20, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, color: "#dc2626",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block",
            }} />
            Recording… tap again when done
          </div>
        )}

        <button
          onClick={!isConnected ? connect : toggleRecording}
          style={{
            pointerEvents: "auto",
            width: 68, height: 68, borderRadius: "50%",
            border: "none", cursor: "pointer",
            background: isRecording
              ? "linear-gradient(135deg,#ef4444,#dc2626)"
              : "linear-gradient(135deg,#7c3aed,#4f46e5)",
            boxShadow: isRecording
              ? "0 0 0 8px rgba(239,68,68,0.15), 0 4px 20px rgba(239,68,68,0.35)"
              : "0 4px 20px rgba(124,58,237,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          {isRecording ? <Volume2 size={28} color="white" /> : <Mic size={28} color="white" />}
        </button>

        <span style={{
          fontSize: 12, fontWeight: 700, color: "#94a3b8",
          textTransform: "uppercase", letterSpacing: "0.08em",
          pointerEvents: "none",
        }}>
          {!isConnected ? "Tap to start" : isRecording ? "Tap to finish" : "Tap to speak"}
        </span>
      </div>
    </div>
  );
}