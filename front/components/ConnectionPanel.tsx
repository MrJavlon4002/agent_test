
import React, { useState } from "react";

type Props = {
  httpBase: string;
  setHttpBase: (v: string) => void;
  wsBase: string;
  setWsBase: (v: string) => void;
  connected: boolean;
  connectWS: () => void;
  disconnectWS: () => void;
};

const StatusIndicator: React.FC<{ connected: boolean }> = ({ connected }) => (
  <div className="flex items-center gap-2">
    <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`}></span>
    <span className={`text-sm font-semibold ${connected ? 'text-green-400' : 'text-slate-400'}`}>
      {connected ? "Connected" : "Disconnected"}
    </span>
  </div>
);

export default function ConnectionPanel({ httpBase, setHttpBase, wsBase, setWsBase, connected, connectWS, disconnectWS }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex-shrink-0 border-b border-slate-800">
      <button 
        className="w-full flex justify-between items-center p-4 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-base font-semibold text-slate-200">Connection Settings</h2>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-4 pt-0 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="httpBase" className="text-xs font-medium text-slate-400">API HTTP Base</label>
            <input 
              id="httpBase"
              value={httpBase}
              onChange={e => setHttpBase(e.target.value)}
              className="w-full bg-slate-900/70 border border-slate-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wsBase" className="text-xs font-medium text-slate-400">API WS Base</label>
            <input 
              id="wsBase"
              value={wsBase}
              onChange={e => setWsBase(e.target.value)}
              className="w-full bg-slate-900/70 border border-slate-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-md">
            <span className="text-sm text-slate-300">Status</span>
            <StatusIndicator connected={connected} />
          </div>
          <div className="flex gap-2">
            <button onClick={connectWS} className="w-full bg-sky-600 text-white px-3 py-1.5 rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold disabled:opacity-50" disabled={connected}>Connect</button>
            <button onClick={disconnectWS} className="w-full bg-slate-600 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors text-sm font-semibold disabled:opacity-50" disabled={!connected}>Disconnect</button>
          </div>
        </div>
      )}
    </div>
  );
}
