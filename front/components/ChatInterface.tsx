import React, { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage, RecipientItem, CardItem } from "../types";

// --- Sub-components for Interactive Bubbles ---

const RecipientChooser: React.FC<{
  choices: NonNullable<ChatMessage['recipientChoices']>;
  onChoose: (rid: string, name: string, sessionId: string) => void;
}> = ({ choices, onChoose }) => (
  <div className="mt-2 border-t border-slate-700/50 pt-3">
    <div className="flex flex-col gap-2">
      {choices.list.map(r => (
        <div 
          key={r.id} 
          className="w-full flex items-center gap-4 p-3 bg-slate-700/60 border border-slate-600/50 rounded-lg hover:bg-slate-700/90 hover:border-sky-500/50 transition-all duration-200 cursor-pointer group" 
          onClick={() => onChoose(r.id, r.name, choices.sessionId)}>
          <div className="w-12 h-12 flex-shrink-0 bg-slate-600 rounded-full flex items-center justify-center font-bold text-xl text-sky-300 border-2 border-slate-500 group-hover:border-sky-400 transition-colors">
            {(r.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-grow min-w-0">
            <div className="font-bold text-md text-slate-100 truncate">{r.name}</div>
            <div className="text-sm text-slate-400 font-mono">{r.masked || "****"}</div>
            {r.pan_last4 && <div className="text-xs text-slate-500 font-mono">Card ending in {r.pan_last4}</div>}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onChoose(r.id, r.name, choices.sessionId); }} 
            className="flex-shrink-0 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 text-sm font-semibold transition-colors">
            Select
          </button>
        </div>
      ))}
    </div>
  </div>
);

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
      const scrollWidth = el.scrollWidth;
      const clientWidth = el.clientWidth;
      
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
      const scrollAmount = el.clientWidth * 0.8;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="mt-2 border-t border-slate-700/50 pt-3 relative group/carousel">
      <div ref={scrollContainerRef} className="flex overflow-x-auto gap-4 pb-3 -mb-3 snap-x scroll-smooth">
        {choices.list.map(c => (
          <div 
            key={c.id} 
            onClick={() => onChoose(c.id, c.holder, choices.sessionId)}
            className="group flex-shrink-0 w-80 snap-start rounded-xl overflow-hidden shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-sky-500/20 cursor-pointer"
          >
            <div className="h-full flex flex-col justify-between p-5 bg-gradient-to-br from-slate-800 to-slate-900 text-white relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                         <path d="M4 4h16v2H4V4zm0 14h16v2H4v-2zM4 9h16v6H4V9zm2 2v2h2v-2H6z" />
                      </svg>
                   </div>
                   <div className="font-bold text-xl tracking-wide text-slate-200">{c.bank || 'Your Bank'}</div>
                </div>
                <div className="w-12 h-8 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-md flex items-center justify-center shadow-inner">
                  <div className="w-10 h-6 bg-yellow-700/80 rounded-sm border border-yellow-800/50"></div>
                </div>
              </div>
              <div className="font-mono text-2xl text-center text-slate-300 tracking-wider my-6" aria-label={`Card number ${c.masked}`}>
                {c.masked.replace(/(.{4})/g, '$1 ').trim()}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-slate-400 uppercase">Card Holder</div>
                  <div className="text-base font-medium text-slate-100 truncate">{c.holder}</div>
                </div>
                {typeof c.balance === 'number' && (
                  <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase">Balance</div>
                    <div className="text-xl font-semibold text-green-400">
                      {c.balance.toLocaleString()}
                      <span className="text-sm ml-1 text-green-300/80">{c.currency || 'UZS'}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                 <span className="text-white  font-semibold border-2 border-white rounded-full px-6 py-2">Choose Card</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {canScrollLeft && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-slate-700/80 hover:bg-slate-600 rounded-full w-10 h-10 flex items-center justify-center text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          aria-label="Previous card"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      {canScrollRight && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-slate-700/80 hover:bg-slate-600 rounded-full w-10 h-10 flex items-center justify-center text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          aria-label="Next card"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  );
};

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
    <div className="mt-2 border-t border-slate-700/50 pt-3">
       <div className="text-xs text-slate-400 mb-2">
        <span>Payment ID:</span>
        <span className="font-mono ml-2 p-1 bg-slate-900/70 rounded">{prompt.paymentId}</span>
      </div>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="******"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full text-center text-xl tracking-[0.3em] font-mono bg-slate-900/80 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 outline-none"
      />
      <div className="flex justify-between items-center mt-3">
        <div className="text-sm text-slate-400">Expires in: {left}s</div>
        <button 
          onClick={() => onSubmit(code, prompt.paymentId)} 
          disabled={code.length < 4 || left === 0}
          className="bg-sky-600 text-white px-4 py-1.5 rounded-md hover:bg-sky-700 font-semibold disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
};


// --- Main Chat Interface Component ---

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
    <div className="flex-grow flex flex-col min-h-0 bg-slate-800/50">
      <div className="flex-grow overflow-y-auto p-6">
        <div className="flex flex-col gap-5">
          {history.map((msg, i) => (
            <div key={i} className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'assistant' && <div className="h-8 w-8 bg-sky-500 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0">S</div>}
              <div className={`max-w-lg rounded-2xl p-3.5 shadow ${msg.role === 'user' ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.query}</p>
                {msg.recipientChoices && <RecipientChooser choices={msg.recipientChoices} onChoose={onChooseRecipient} />}
                {msg.cardChoices && <CardChooser choices={msg.cardChoices} onChoose={onChooseCard} />}
                {msg.otpRequired && <OtpInput prompt={msg.otpRequired} onSubmit={onSubmitOtp} />}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-end gap-3 flex-row">
              <div className="h-8 w-8 bg-sky-500 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0">S</div>
              <div className="max-w-lg rounded-2xl p-3.5 shadow bg-slate-700 text-slate-200 rounded-bl-none">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse delay-0"></span>
                  <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse delay-150"></span>
                  <span className="h-2 w-2 bg-sky-400 rounded-full animate-pulse delay-300"></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={endOfMessagesRef} />
      </div>

      <div className="flex-shrink-0 p-4 border-t border-slate-800">
        <div className="relative">
          <textarea
            rows={1}
            className="w-full bg-slate-700/80 border border-slate-600 rounded-lg p-3 pr-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-50"
            placeholder="Type your message..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
          />
          <button onClick={handleSend} disabled={busy || !query.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 bg-sky-600 text-white px-4 py-1.5 rounded-md hover:bg-sky-700 transition-colors font-semibold disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}