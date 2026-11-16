import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-white border-t border-slate-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>
          <span className="font-semibold text-slate-700">UpgradeLens</span> — Dependency Upgrade Impact Verifier for Pull Requests
        </div>
        <div className="flex items-center gap-4">
          <span>Project Owner: <strong className="text-slate-700">G. Anil Kumar</strong></span>
          <span>•</span>
          <a
            href="https://github.com/anilkumargadi27-hub/Upgrade-Impact-Verifier"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </footer>
  );
};
