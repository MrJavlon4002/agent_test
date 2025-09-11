
import React, { useEffect, useRef } from "react";

type Props = {
  logs: string[];
};

export default function EventLog({ logs }: Props) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs]);

  return (
    <div className="flex flex-col flex-grow min-h-0">
      <div className="flex justify-between items-center p-4 border-b border-slate-800">
        <h2 className="text-base font-semibold text-slate-200">Event Log</h2>
        <span className="bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-0.5 rounded-full">{logs.length}</span>
      </div>
      <div ref={logContainerRef} className="flex-grow overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
            {logs.map((log, i) => (
              <div key={i} className="font-mono text-xs text-slate-400 break-all leading-relaxed">{log}</div>
            ))}
            {logs.length === 0 && (
              <div className="text-center text-slate-500 pt-8">No events yet.</div>
            )}
        </div>
      </div>
    </div>
  );
}
