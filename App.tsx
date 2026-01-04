import React, { useState, useCallback } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { Sidebar } from './components/Sidebar';
import { COMPANY_HANDBOOK, OFFICE_HOLIDAYS_2024 } from './constants';
import { CompanyConfig } from './types';

const App: React.FC = () => {
  const [company, setCompany] = useState<CompanyConfig>({
    name: "HireHelp",
    handbookSections: COMPANY_HANDBOOK,
    holidays: OFFICE_HOLIDAYS_2024
  });

  const [externalMessage, setExternalMessage] = useState<string | null>(null);

  const handleUpdateCompany = (newConfig: CompanyConfig) => {
    setCompany(newConfig);
  };

  const handleQuickAction = (prompt: string) => {
    setExternalMessage(prompt);
    // Reset after trigger so ChatWindow can pick it up
    setTimeout(() => setExternalMessage(null), 100);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-[100]">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-100 ring-4 ring-blue-50">
              {company.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">
                {company.name}<span className="text-blue-600 font-black">AI</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Smart Onboarding Assistant</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Jordan Smith</p>
                <p className="text-[10px] font-bold text-blue-500 uppercase">Product Design • Day 2</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-slate-100 p-0.5 shadow-sm overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan&backgroundColor=b6e3f4" alt="avatar" className="rounded-xl w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-10 flex flex-col lg:flex-row gap-10">
        <Sidebar 
          company={company} 
          onUpdateCompany={handleUpdateCompany} 
          onQuickAction={handleQuickAction}
        />

        <div className="flex-1 flex flex-col min-h-[600px] h-[calc(100vh-12rem)]">
          <ChatWindow 
            company={company} 
            triggerMessage={externalMessage} 
          />
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 py-4 mt-auto">
        <div className="max-w-[1600px] mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Gemini 3.0 Cloud Active</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Context: {company.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
            <span>Enterprise Grade Encryption</span>
            <span className="text-slate-200">|</span>
            <span>v2.4.0 Production</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;