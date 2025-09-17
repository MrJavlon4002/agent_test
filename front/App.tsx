
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { postJSON, API_HTTP_BASE, API_WS_BASE } from "./services/api";
import type { ChatMessage, CodeRequiredEvt, RecipientChoicesEvt, StreamEvt, CardChoicesEvt, ChatResponse } from "./types";
import ChatInterface from "./components/ChatInterface";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiZjY0ZDgyNWYtMGE5NC00NzEwLWJmOTAtZTVmZWM5NWEyMmNjIiwibG9naW4iOiI5OTg5NTAyMTA5MTIiLCJyZWFsbSI6InNlbGxvLWlkIiwicGFzc3dvcmQiOmZhbHNlLCJzZXNzaW9uSWQiOiJiMGUwMjQyMC01N2I4LTRlNDgtOGFlZC1mZmM1MmJmNTM5YTkiLCJwYXkiOnRydWUsInJvbGUiOltdLCJwZXJtaXNzaW9uIjpbXX0sImlhdCI6MTc1NjM2MDE4NiwiZXhwIjoxNzU4OTUyMTg2fQ.JoTcNkNchwYXlMxgEaQY4KeZslmAp_UUs6ngQIMewjQ";
const USER_ID = "f64d825f-0a94-4710-bf90-e5fec95a22cc";

export default function App() {
  const httpBase = API_HTTP_BASE;
  const wsBase = API_WS_BASE;
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([
    { role: "assistant", query: "Hello! How can I help you with your transactions today?" }
  ]);
  const [busy, setBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = useMemo(() => {
    if (!TOKEN || !wsBase) return '';
    const base = wsBase.replace(/\/+$/, "");
    return `${base}?token=${encodeURIComponent(TOKEN)}`;
  }, [wsBase]);

  const connectWS = useCallback(() => {
    if (!TOKEN || !wsBase) {
      console.error("WebSocket base URL is not set.");
      return;
    }
    
    if (wsRef.current) wsRef.current.close();
    
    console.log(`[ws] connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { 
      setConnected(true); 
      console.log("[ws] Connection established."); 
    };

    ws.onclose = (event: CloseEvent) => { 
      setConnected(false);
      const reason = event.reason || "No reason provided";
      if (event.wasClean) {
        console.log(`[ws] Connection closed cleanly. Code: ${event.code}, Reason: ${reason}`);
      } else {
        console.error(`[ws] Connection closed abnormally. Code: ${event.code}, Reason: ${reason}`);
        
        let userMessage = "The connection to the server was lost. Please try again later.";
        // 1006 is a generic "abnormal closure" code, often indicates server is down or unreachable.
        if (event.code === 1006) {
          userMessage = "Could not connect to the server. It may be offline or unreachable. Please check your network and try again.";
        }
        
        setHistory(prev => {
            const lastMessage = prev[prev.length - 1];
            // Avoid adding duplicate connection error messages
            if (lastMessage?.role === 'assistant' && lastMessage.query.startsWith('Could not connect')) {
                return prev;
            }
            return [...prev, { role: "assistant", query: userMessage }];
        });
      }
    };
    
    // The 'onerror' event is generic and followed by 'onclose', which has more specific details.
    // We rely on 'onclose' for error handling to avoid redundant logging.

    ws.onmessage = (ev) => {
      try {
        const data: StreamEvt = JSON.parse(ev.data);
        if (data.type === "RECIPIENT_CHOICES") {
          const evt = data as RecipientChoicesEvt;
          console.log("[evt] RECIPIENT_CHOICES", { count: (evt.list||[]).length });
          const newMessage: ChatMessage = {
            role: "assistant",
            query: `Please choose a recipient for the ${evt.amount.toLocaleString()} UZS transfer.`,
            recipientChoices: { list: evt.list || [], sessionId: evt.session_id, amount: evt.amount }
          };
          setHistory(prev => [...prev, newMessage]);
        } else if (data.type === "CARD_CHOICES") {
          const evt = data as CardChoicesEvt;
          console.log("[evt] CARD_CHOICES", { count: (evt.list||[]).length });
           const newMessage: ChatMessage = {
            role: "assistant",
            query: `Please choose a card to pay ${evt.amount.toLocaleString()} UZS.`,
            cardChoices: { list: evt.list || [], sessionId: evt.session_id, amount: evt.amount }
          };
          setHistory(prev => [...prev, newMessage]);
        } else if (data.type === "CODE_REQUIRED") {
          const evt = data as CodeRequiredEvt;
          console.log("[evt] CODE_REQUIRED", { payment_id: evt.payment_id });
          const newMessage: ChatMessage = {
            role: "assistant",
            query: "Please enter the OTP code sent to your device to confirm the payment.",
            otpRequired: { paymentId: evt.payment_id, expiresIn: evt.expires_in || 180 }
          };
          setHistory(prev => [...prev, newMessage]);
        } else {
          console.log("[evt] other", data);
        }
      } catch (e) {
        console.error("[evt] parse_error", { raw: ev.data });
      }
    };
  }, [wsUrl, wsBase]);

  const disconnectWS = useCallback(() => {
    if (wsRef.current) {
      console.log("[ws] disconnecting...");
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }
  }, []);
  
  useEffect(() => {
    connectWS();
    return () => {
      disconnectWS();
    }
  }, [connectWS, disconnectWS]);

  const onChooseRecipient = async (rid: string, name: string, sessionId: string) => {
    try {
      console.log("[choose recipient] sent", { recipient_id: rid });
      // Add explicit ChatMessage type to the map callback to prevent TypeScript from inferring a too-specific type.
      // This ensures that the array type remains ChatMessage[] and allows concatenating a new user message without type errors.
      setHistory(prev => prev.map((msg): ChatMessage => ({ ...msg, recipientChoices: undefined }))
        .concat({ role: "user", query: `Selected recipient: ${name}`}));
      await postJSON(`${httpBase}/v1/transactions/choose/${sessionId}`, TOKEN, { recipient_id: rid });
    } catch(error) {
      const err = error as Error;
      console.error("[choose recipient] error", { err: err.message });
      setHistory(prev => [...prev, { role: "assistant", query: `Error choosing recipient: ${err.message}` }]);
    }
  };
  
  const onChooseCard = async (cid: string, name: string, sessionId: string) => {
    try {
      console.log("[choose card] sent", { card_id: cid });
      // Add explicit ChatMessage type to the map callback to prevent TypeScript from inferring a too-specific type.
      // This ensures that the array type remains ChatMessage[] and allows concatenating a new user message without type errors.
      setHistory(prev => prev.map((msg): ChatMessage => ({ ...msg, cardChoices: undefined }))
        .concat({ role: "user", query: `Selected card: ${name}`}));
      await postJSON(`${httpBase}/v1/transactions/choose/${sessionId}`, TOKEN, { card_id: cid });
    } catch(error) {
      const err = error as Error;
      console.error("[choose card] error", { err: err.message });
      setHistory(prev => [...prev, { role: "assistant", query: `Error choosing card: ${err.message}` }]);
    }
  };

  const onSubmitOtp = async (code: string, paymentId: string) => {
    try {
      console.log("[otp] submitted", { payment_id: paymentId });
      // Add explicit ChatMessage type to the map callback to prevent TypeScript from inferring a too-specific type.
      // This ensures that the array type remains ChatMessage[] and allows concatenating a new user message without type errors.
      setHistory(prev => prev.map((msg): ChatMessage => ({ ...msg, otpRequired: undefined }))
        .concat({ role: "user", query: `Entered OTP: ${code.replace(/./g, '*')}` }));
      await postJSON(`${httpBase}/v1/transactions/${paymentId}/confirm`, TOKEN, { code });
      setHistory(prev => [...prev, {role: "assistant", query: "OTP confirmed successfully!"}]);
    } catch (error) {
      const err = error as Error;
      console.error("[otp] error", { err: err.message });
      setHistory(prev => [...prev, { role: "assistant", query: `Error submitting OTP: ${err.message}` }]);
    }
  };

  const sendChat = async (q: string) => {
    console.log("[chat] sending query", { query: q });
    setBusy(true);
    const newHistory: ChatMessage[] = [...history, { role: "user", query: q }];
    setHistory(newHistory);
    try {
      const res = await postJSON<ChatResponse>(`${httpBase}/v1/${encodeURIComponent(USER_ID)}/chat`, TOKEN, {
        query: q,
        history
      });
      const answer = res.answer;
      console.log("[chat] ok", { answer });
      setHistory([...newHistory, { role: "assistant", query: answer }]);
    } catch (error) {
      const err = error as Error;
      console.error("[chat] error", { err: err.message });
      setHistory([...newHistory, { role: "assistant", query: `Error: ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="h-screen w-full bg-slate-900 text-slate-200 font-sans">
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
        <header className="flex-shrink-0 flex items-center gap-4 p-4 border-b border-slate-800">
           <div className="h-10 w-10 bg-sky-500 rounded-full flex items-center justify-center font-bold text-lg text-white">S</div>
           <div>
              <h1 className="text-lg font-bold text-slate-100">Sello AI Agent</h1>
              <p className="text-sm text-slate-400">
                Your AI-powered transaction assistant
                 <span className="inline-flex items-center ml-3">
                    <span className={`h-2 w-2 mr-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`}></span>
                    <span>{connected ? "Connected" : "Disconnected"}</span>
                </span>
              </p>
           </div>
        </header>
        <ChatInterface
          history={history}
          busy={busy}
          onSend={sendChat}
          onChooseRecipient={onChooseRecipient}
          onChooseCard={onChooseCard}
          onSubmitOtp={onSubmitOtp}
        />
      </div>
    </main>
  );
}
