import { useRef, useState } from "react";

type Message = {
    role: "user" | "ai";
    text: string;
    type?: "analysis" | "question";
};

export function useRealtime() {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [liveAiText, setLiveAiText] = useState("");
    const [liveUserText, setLiveUserText] = useState("");
    const [userTranscript, setUserTranscript] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const aiTextRef = useRef("");
    const userTextRef = useRef("");
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const lastUserText = useRef(""); // store last user text for analysis

    // Fetch analysis from Chat API (silent — no voice), then trigger spoken question
    async function fetchAnalysisThenQuestion(userText: string) {
        try {
            const res = await fetch("http://localhost:3001/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userText }),
            });
            const data = await res.json();
            if (data.analysis) {
                setMessages((prev) => [
                    ...prev,
                    { role: "ai", text: data.analysis, type: "analysis" },
                ]);
            }
        } catch (err) {
            console.error("Analysis fetch failed:", err);
        }

        // NOW trigger the spoken follow-up question (after cards are shown)
        dataChannelRef.current?.send(JSON.stringify({
            type: "response.create",
            response: {
                instructions:
                    "Ask ONE short, warm follow-up question to continue the conversation. Say ONLY the question — no corrections, no analysis, no labels. Just ask the question naturally.",
            },
        }));
    }

    async function connect() {
        try {
            setMessages([]);
            setLiveAiText("");
            setLiveUserText("");
            setUserTranscript("");
            aiTextRef.current = "";
            userTextRef.current = "";
            lastUserText.current = "";

            const sessionRes = await fetch("http://localhost:3001/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ voice: "shimmer", speed: 1 }),
            });

            const session = await sessionRes.json();
            const clientSecret = session.client_secret?.value || session.value;

            if (!clientSecret) {
                console.error(session);
                alert("Could not create OpenAI session.");
                return;
            }

            const pc = new RTCPeerConnection();
            peerConnectionRef.current = pc;

            const audio = document.createElement("audio");
            audio.autoplay = true;
            audioRef.current = audio;
            document.body.appendChild(audio);

            pc.ontrack = (event) => {
                audio.srcObject = event.streams[0];
            };

            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
            });
            micStreamRef.current = micStream;

            micStream.getTracks().forEach((track) => {
                track.enabled = false;
                pc.addTrack(track, micStream);
            });

            const dataChannel = pc.createDataChannel("oai-events");
            dataChannelRef.current = dataChannel;

            dataChannel.addEventListener("open", () => {
                dataChannel.send(JSON.stringify({
                    type: "session.update",
                    session: {
                        input_audio_transcription: { model: "whisper-1" },
                    },
                }));

                // Opening greeting — spoken
                dataChannel.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: "user",
                        content: [{
                            type: "input_text",
                            text: "Greet me warmly and ask one simple English question.",
                        }],
                    },
                }));
                dataChannel.send(JSON.stringify({ type: "response.create" }));
            });

            dataChannel.addEventListener("message", (event) => {
                const data = JSON.parse(event.data);
                const t = data.type;

                // ── User live transcript ──────────────────────────────────
                if (t === "conversation.item.input_audio_transcription.delta") {
                    userTextRef.current += data.delta || "";
                    setLiveUserText(userTextRef.current);
                }

                // ── User transcript complete ──────────────────────────────
                if (t === "conversation.item.input_audio_transcription.completed") {
                    const transcript = data.transcript || userTextRef.current;
                    if (transcript?.trim()) {
                        const finalText = transcript.trim();
                        setUserTranscript(finalText);
                        lastUserText.current = finalText;
                        setMessages((prev) => [
                            ...prev,
                            { role: "user", text: finalText },
                        ]);
                        setLiveUserText("");
                        userTextRef.current = "";

                        // Cards first, then spoken question
                        fetchAnalysisThenQuestion(finalText);
                    }
                }

                // ── AI audio transcript (spoken question) ─────────────────
                if (t === "response.output_audio_transcript.delta") {
                    setIsAiSpeaking(true);
                    aiTextRef.current += data.delta || "";
                    setLiveAiText(aiTextRef.current);
                }

                if (t === "response.output_audio_transcript.done") {
                    const txt = data.transcript || aiTextRef.current;
                    if (txt?.trim()) {
                        setMessages((prev) => [
                            ...prev,
                            { role: "ai", text: txt.trim(), type: "question" },
                        ]);
                    }
                    aiTextRef.current = "";
                    setLiveAiText("");
                    setIsAiSpeaking(false);
                }

                // ── Error handling ────────────────────────────────────────
                if (t === "error") {
                    console.error("Realtime API error:", data.error);
                }
            });

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${clientSecret}`,
                    "Content-Type": "application/sdp",
                },
            });

            await pc.setRemoteDescription({
                type: "answer" as RTCSdpType,
                sdp: await sdpRes.text(),
            });
            setIsConnected(true);
        } catch (error) {
            console.error(error);
            alert("Connection failed");
        }
    }

    function toggleRecording() {
        if (!dataChannelRef.current || !micStreamRef.current) return;
        const track = micStreamRef.current.getAudioTracks()[0];
        if (!track) return;

        if (!isRecording) {
            track.enabled = true;
            setIsRecording(true);
            setIsMuted(false);
            userTextRef.current = "";
            setLiveUserText("");
        } else {
            track.enabled = false;
            setIsRecording(false);
            setIsMuted(true);

            // Commit audio — the spoken question will be triggered
            // AFTER the analysis cards appear (see fetchAnalysisThenQuestion)
            dataChannelRef.current.send(JSON.stringify({
                type: "input_audio_buffer.commit",
            }));
        }
    }

    function disconnect() {
        if (audioRef.current) {
            audioRef.current.srcObject = null;
            audioRef.current.remove();
            audioRef.current = null;
        }
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;

        setIsConnected(false);
        setIsMuted(false);
        setIsRecording(false);
        setIsAiSpeaking(false);
        setLiveAiText("");
        setLiveUserText("");
        aiTextRef.current = "";
        userTextRef.current = "";
        lastUserText.current = "";
    }

    return {
        connect,
        disconnect,
        isConnected,
        isMuted,
        isRecording,
        isAiSpeaking,
        messages,
        liveAiText,
        liveUserText,
        userTranscript,
        toggleRecording,
    };
}