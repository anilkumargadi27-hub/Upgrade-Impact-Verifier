import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface Props {
  code: string;
  language?: string;
  fileName?: string;
  startLine?: number;
  className?: string;
}

export const CodeSnippet: React.FC<Props> = ({
  code,
  language = 'javascript',
  fileName,
  startLine = 1,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden font-mono text-xs ${className}`}>
      {fileName && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700 text-slate-400">
          <span className="text-[11px] font-medium text-slate-300">{fileName}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <div className="p-3 overflow-x-auto leading-relaxed">
        <table className="border-collapse w-full">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-800/50">
                <td className="pr-4 text-slate-500 select-none text-right w-8 align-top text-[11px]">
                  {startLine + idx}
                </td>
                <td className="whitespace-pre align-top text-slate-200">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
