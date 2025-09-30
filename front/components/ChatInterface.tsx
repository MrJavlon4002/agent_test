import React, { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage, RecipientItem, CardItem } from "../types";

/* Primary color & background (from user):
   Elements: #2AA8EE  (rgb(42,168,238))
   Background: #FFFFFF
*/

/* =========================
   RecipientChooser (mobile-first, light theme)
========================= */
const RecipientChooser: React.FC<{
  choices: NonNullable<ChatMessage['recipientChoices']>;
  onChoose: (rid: string, name: string, sessionId: string) => void;
}> = ({ choices, onChoose }) => (
  <div className="mt-2 border-t border-slate-200 pt-2 sm:pt-3 bg-white">
    <div className="flex flex-col gap-2 sm:gap-3">
      {choices.list.map(r => (
        <div
          key={r.id}
          className="w-full flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg hover:bg-[#2AA8EE]/5 hover:border-[#2AA8EE] transition-all duration-200 cursor-pointer group"
          onClick={() => onChoose(r.id, r.name, choices.sessionId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChoose(r.id, r.name, choices.sessionId)}
        >
          <div className="w-9 h-9 sm:w-12 sm:h-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-base sm:text-xl text-[#2AA8EE] border border-[#2AA8EE]/30 bg-[#2AA8EE]/10 group-hover:border-[#2AA8EE] transition-colors">
            {(r.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-grow min-w-0">
            <div className="font-semibold text-sm sm:text-base text-slate-900 truncate">{r.name}</div>
            <div className="text-xs sm:text-sm text-slate-500 font-mono truncate">{r.masked || "****"}</div>
            {r.pan_last4 && (
              <div className="text-[11px] sm:text-xs text-slate-400 font-mono">Card ending in {r.pan_last4}</div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onChoose(r.id, r.name, choices.sessionId); }}
            className="flex-shrink-0 bg-[#2AA8EE] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg hover:brightness-95 text-xs sm:text-sm font-semibold transition-colors">
            Select
          </button>
        </div>
      ))}
    </div>
  </div>
);

/* =========================
   CardChooser (mobile-first, light theme)
========================= */
const CardChooser: React.FC<{
  choices: NonNullable<ChatMessage['cardChoices']>;
  onChoose: (cid: string, name: string, sessionId: string) => void;
}> = ({ choices, onChoose }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollLeft = Math.ceil(el.scrollLeft);
      const { scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      checkScrollability();
      el.addEventListener('scroll', checkScrollability, { passive: true });
      window.addEventListener('resize', checkScrollability);

      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(el);

      return () => {
        el.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
        resizeObserver.disconnect();
      };
    }
  }, [choices, checkScrollability]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = Math.max(240, el.clientWidth * 0.8);
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="mt-2 border-t border-slate-200 pt-2 sm:pt-3 relative group/carousel bg-white">
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto gap-3 sm:gap-4 pb-2.5 -mb-2.5 snap-x scroll-smooth no-scrollbar"
      >
        {choices.list.map(c => (
          <div
            key={c.id}
            onClick={() => onChoose(c.id, c.holder, choices.sessionId)}
            className="group flex-shrink-0 w-64 sm:w-80 snap-start rounded-xl overflow-hidden shadow-md border border-slate-200 bg-gradient-to-br from-white to-slate-50 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-[#2AA8EE]/20 cursor-pointer"
          >
            <div className="h-full flex flex-col justify-between p-4 sm:p-5 text-slate-900 relative">
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#2AA8EE]/10 rounded-full flex items-center justify-center border border-[#2AA8EE]/20">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#2AA8EE]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 4h16v2H4V4zm0 14h16v2H4v-2zM4 9h16v6H4V9zm2 2v2h2v-2H6z" />
                    </svg>
                  </div>
                  <div className="font-bold text-lg sm:text-xl tracking-wide text-slate-900">{c.bank || 'Your Bank'}</div>
                </div>
                <div className="w-10 h-7 sm:w-12 sm:h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-md flex items-center justify-center shadow-inner">
                  <div className="w-8 h-5 sm:w-10 sm:h-6 bg-yellow-600/70 rounded-sm border border-yellow-700/40"></div>
                </div>
              </div>

              <div className="font-mono text-xl sm:text-2xl text-center text-slate-700 tracking-wider my-4 sm:my-6" aria-label={`Card number ${c.masked}`}>
                {c.masked.replace(/(.{4})/g, '$1 ').trim()}
              </div>

              <div className="flex justify-between items-end gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-xs text-slate-500 uppercase">Card Holder</div>
                  <div className="text-sm sm:text-base font-medium text-slate-900 truncate">{c.holder}</div>
                </div>
                {typeof c.balance === 'number' && (
                  <div className="text-right">
                    <div className="text-[10px] sm:text-xs text-slate-500 uppercase">Balance</div>
                    <div className="text-base sm:text-xl font-semibold text-emerald-600">
                      {c.balance.toLocaleString()}
                      <span className="text-xs sm:text-sm ml-1 text-emerald-700/80">{c.currency || 'UZS'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 bg-[#2AA8EE]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="text-[#2AA8EE] text-sm sm:text-base font-semibold border-2 border-[#2AA8EE] rounded-full px-4 sm:px-6 py-1.5 sm:py-2 bg-white/70 backdrop-blur">
                  Choose Card
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-white border border-slate-200 hover:border-[#2AA8EE] rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#2AA8EE] shadow-sm"
          aria-label="Previous card"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white border border-slate-200 hover:border-[#2AA8EE] rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#2AA8EE] shadow-sm"
          aria-label="Next card"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

/* =========================
   OtpInput (mobile-first, light theme)
========================= */
const OtpInput: React.FC<{
  prompt: NonNullable<ChatMessage['otpRequired']>;
  onSubmit: (code: string, paymentId: string) => void;
}> = ({ prompt, onSubmit }) => {
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(prompt.expiresIn);

  useEffect(() => {
    const timer = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-2 border-t border-slate-200 pt-2 sm:pt-3 bg-white">
      <div className="text-[11px] sm:text-xs text-slate-600 mb-2">
        <span>Payment ID:</span>
        <span className="font-mono ml-2 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">{prompt.paymentId}</span>
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full text-center text-lg sm:text-xl tracking-[0.3em] font-mono bg-white border border-slate-300 rounded-lg p-2 sm:p-2.5 focus:ring-2 focus:ring-[#2AA8EE] outline-none"
      />
      <div className="flex justify-between items-center mt-3">
        <div className="text-xs sm:text-sm text-slate-600">Expires in: {left}s</div>
        <button
          onClick={() => onSubmit(code, prompt.paymentId)}
          disabled={code.length < 4 || left === 0}
          className="min-w-[88px] sm:min-w-[96px] bg-[#2AA8EE] text-white px-3 sm:px-4 py-1.5 rounded-md hover:brightness-95 font-semibold disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

/* =========================
   ChatInterface (light theme + mobile tweaks)
========================= */

type Props = {
  history: ChatMessage[];
  busy: boolean;
  onSend: (q: string) => void;
  onChooseRecipient: (rid: string, name: string, sessionId: string) => void;
  onChooseCard: (cid: string, name: string, sessionId: string) => void;
  onSubmitOtp: (code: string, paymentId: string) => void;
};

export default function ChatInterface({ history, busy, onSend, onChooseRecipient, onChooseCard, onSubmitOtp }: Props) {
  const [query, setQuery] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleSend = () => {
    if (!query.trim() || busy) return;
    onSend(query.trim());
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-grow flex flex-col min-h-0 bg-white">
      <div className="flex-grow p-3 sm:p-6 h-[calc(100vh-250px)]">
        <div className="flex flex-col gap-3.5 sm:gap-5 overflow-y-auto max-h-[calc(100vh-160px)] no-scrollbar">
          {history.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2.5 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-sm text-white shrink-0"
                  style={{ backgroundColor: '#2AA8EE' }}>
                  S
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-lg rounded-2xl p-3 sm:p-3.5 shadow ${msg.role === 'user' ? 'text-white rounded-br-none' : 'text-slate-900 rounded-bl-none'}`}
                style={msg.role === 'user'
                  ? { backgroundColor: '#2AA8EE' }
                  : { backgroundColor: '#F1F5F9' } /* slate-100 */}>
                <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{msg.query}</p>
                {msg.recipientChoices && <RecipientChooser choices={msg.recipientChoices} onChoose={onChooseRecipient} />}
                {msg.cardChoices && <CardChooser choices={msg.cardChoices} onChoose={onChooseCard} />}
                {msg.otpRequired && <OtpInput prompt={msg.otpRequired} onSubmit={onSubmitOtp} />}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-end gap-2.5 sm:gap-3 flex-row">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-sm text-white shrink-0"
                style={{ backgroundColor: '#2AA8EE' }}>
                S
              </div>
              <div className="max-w-[85%] sm:max-w-lg rounded-2xl p-3 sm:p-3.5 shadow rounded-bl-none"
                style={{ backgroundColor: '#F1F5F9', color: '#0F172A' }}>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full animate-pulse delay-0" style={{ backgroundColor: '#2AA8EE' }} />
                  <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full animate-pulse delay-150" style={{ backgroundColor: '#2AA8EE' }} />
                  <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full animate-pulse delay-300" style={{ backgroundColor: '#2AA8EE' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={endOfMessagesRef} />
      </div>

      <div className="flex-shrink-0 p-3 sm:p-4 border-t border-slate-200 sticky bottom-0 bg-white/90 backdrop-blur">
        <div className="flex items-between gap-2 items-center">
          <textarea
            rows={1}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 sm:p-3 text-sm sm:text-base resize-none focus:ring-2 outline-none text-black"
            style={{ boxShadow: 'none', caretColor: '#2AA8EE' }}
            placeholder="Type your message..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
          />
          <button
            onClick={handleSend}
            disabled={busy || !query.trim()}
            className="text-white p-3 sm:p-2 rounded-md font-semibold text-sm sm:text-base disabled:opacity-50 hover:brightness-95 transition-colors"
            style={{ backgroundColor: '#2AA8EE' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* Optional (global.css):
.no-scrollbar::-webkit-scrollbar{ display:none; }
.no-scrollbar{ -ms-overflow-style:none; scrollbar-width:none; }
*/
