import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { postJSON, API_HTTP_BASE, API_WS_BASE } from "./services/api";
import type { ChatMessage, CodeRequiredEvt, RecipientChoicesEvt, StreamEvt, CardChoicesEvt, ChatResponse } from "./types";
import ChatInterface from "./components/ChatInterface";

export default function App() {
  const [TOKEN, setTOKEN] = useState<string | null>(null);
  const [USER_ID, setUSER_ID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    const tokenParam = sp.get("token") || sp.get("TOKEN");
    const userIdParam = sp.get("userId") || sp.get("USER_ID");

    if (tokenParam && userIdParam) {
      setTOKEN(tokenParam);
      setUSER_ID(userIdParam);
      setError(null);
      sp.delete("token"); sp.delete("TOKEN");
      sp.delete("userId"); sp.delete("USER_ID");
      const cleaned = url.pathname + (sp.toString() ? `?${sp.toString()}` : "") + url.hash;
      window.history.replaceState({}, "", cleaned);
    } else {
      // setError("Missing userId or token in URL. Use ?userId=...&token=...");
    }
  }, []);

  const httpBase = API_HTTP_BASE;
  const wsBase = API_WS_BASE;
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([
    { role: "assistant", query: "Salom sizga qanday yordam bera olishim mumkin?" }
  ]);
  const [busy, setBusy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = useMemo(() => {
    if (!TOKEN || !wsBase) return "";
    const base = wsBase.replace(/\/+$/, "");
    return `${base}?token=${encodeURIComponent(TOKEN)}`;
  }, [wsBase, TOKEN]);

  const connectWS = useCallback(() => {
    if (!TOKEN || !wsBase) return;
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = (event: CloseEvent) => {
      setConnected(false);
      const reason = event.reason || "No reason provided";
      if (!event.wasClean) {
        let userMessage = "Tarmoqda uzilish yuz berdi.";
        if (event.code === 1006) {
          userMessage = "Tarmoqda xatolik yuz berdi. Iltimos qayta ulaning.";
        }
        setHistory(prev => [...prev, { role: "assistant", query: userMessage }]);
      }
    };

    ws.onmessage = (ev) => {
      try {
        const data: StreamEvt = JSON.parse(ev.data);
        if (data.type === "RECIPIENT_CHOICES") {
          const evt = data as RecipientChoicesEvt;
          const newMessage: ChatMessage = {
            role: "assistant",
            query: `Please choose a recipient for the ${evt.amount.toLocaleString()} UZS transfer.`,
            recipientChoices: { list: evt.list || [], sessionId: evt.session_id, amount: evt.amount }
          };
          setHistory(prev => [...prev, newMessage]);
        } else if (data.type === "CARD_CHOICES") {
          const evt = data as CardChoicesEvt;
          const newMessage: ChatMessage = {
            role: "assistant",
            query: `Please choose a card to pay ${evt.amount.toLocaleString()} UZS.`,
            cardChoices: { list: evt.list || [], sessionId: evt.session_id, amount: evt.amount }
          };
          setHistory(prev => [...prev, newMessage]);
        } else if (data.type === "CODE_REQUIRED") {
          const evt = data as CodeRequiredEvt;
          const newMessage: ChatMessage = {
            role: "assistant",
            query: "Please enter the OTP code sent to your device to confirm the payment.",
            otpRequired: { paymentId: evt.payment_id, expiresIn: evt.expires_in || 180 }
          };
          setHistory(prev => [...prev, newMessage]);
        }
      } catch (e) {
        console.error("[evt] parse_error", { raw: ev.data });
      }
    };
  }, [wsUrl, wsBase, TOKEN]);

  const disconnectWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    connectWS();
    return () => disconnectWS();
  }, [wsUrl, connectWS, disconnectWS]);

  const guardAuth = () => {
    if (!TOKEN || !USER_ID) {
      const msg = "Missing userId or token. Open the app with ?userId=...&token=....";
      setError(msg);
      toast.error(msg)
      setHistory(prev => [...prev, { role: "assistant", query: msg }]);
      return false;
    }
    return true;
  };

  const onChooseRecipient = async (rid: string, name: string, sessionId: string) => {
    if (!guardAuth()) return;
    await postJSON(`${httpBase}/v1/transactions/choose/${sessionId}`, TOKEN!, { recipient_id: rid });
    setHistory(prev => prev.concat({ role: "user", query: `Selected recipient: ${name}` }));
  };

  const onChooseCard = async (cid: string, name: string, sessionId: string) => {
    if (!guardAuth()) return;
    await postJSON(`${httpBase}/v1/transactions/choose/${sessionId}`, TOKEN!, { card_id: cid });
    setHistory(prev => prev.concat({ role: "user", query: `Selected card: ${name}` }));
  };

  const onSubmitOtp = async (code: string, paymentId: string) => {
    if (!guardAuth()) return;
    await postJSON(`${httpBase}/v1/transactions/${paymentId}/confirm`, TOKEN!, { code });
    setHistory(prev => [...prev, { role: "assistant", query: "OTP confirmed successfully!" }]);
  };

  const sendChat = async (q: string) => {
    if (!guardAuth()) return;
    setBusy(true);
    const newHistory: ChatMessage[] = [...history, { role: "user", query: q }];
    setHistory(newHistory);
    try {
      const res = await postJSON<ChatResponse>(`${httpBase}/v1/${encodeURIComponent(USER_ID!)}/chat`, TOKEN!, { query: q, history: newHistory });
      setHistory([...newHistory, { role: "assistant", query: res.answer }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="w-screen h-[calc(100vh-100px)] bg-white text-slate-900 font-sans overflow-hidden">
      <div className="flex flex-col h-full w-full">
        <header className="flex-shrink-0 flex items-center gap-2 sm:gap-4 p-3 sm:p-4 border-b border-slate-200 bg-slate-100">
          <div className="h-8 w-8 sm:h-10 sm:w-10 bg-[#2AA8EE] rounded-full flex items-center justify-center font-bold text-xs sm:text-base text-white"
           >
          </div>

          {/* Title + status */}
          <div className="flex-1">
            <h1 className="text-sm sm:text-lg font-bold text-slate-900">
              Sello AI Agent
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Your AI-powered transaction assistant
              <span className="inline-flex items-center ml-2 sm:ml-3">
                <span
                  className={`h-1.5 w-1.5 sm:h-2 sm:w-2 mr-1 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"
                    }`}
                ></span>
                <span className="text-xs sm:text-sm">
                  {connected ? "Connected" : "Disconnected"}
                </span>
              </span>
            </p>
          </div>

          {/* Error bubble */}
          {/* {error && (
            <div className="text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-2 rounded bg-red-100 text-red-700 border border-red-300">
              {error}
            </div>
          )} */}
        </header>
        <section className="h-[80%] bg-red-500">
          <ChatInterface
            history={history}
            busy={busy}
            onSend={sendChat}
            onChooseRecipient={onChooseRecipient}
            onChooseCard={onChooseCard}
            onSubmitOtp={onSubmitOtp}
          />
        </section>

      </div>
       <Toaster position="top-right" richColors />
    </main>
  );
}
