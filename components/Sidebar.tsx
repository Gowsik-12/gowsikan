import React, { useState, useRef } from 'react';
import { CompanyConfig, HandbookSection, Holiday } from '../types';
import { Button } from './Button';
import { GoogleGenAI, Type } from "@google/genai";

interface SidebarProps {
  company: CompanyConfig;
  onUpdateCompany: (config: CompanyConfig) => void;
  onQuickAction: (prompt: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ company, onUpdateCompany, onQuickAction }) => {
  const [activeTab, setActiveTab] = useState<'handbook' | 'holidays'>('handbook');
  const [showConfig, setShowConfig] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState(company.name);
  const [newHandbookText, setNewHandbookText] = useState("");
  const [newHolidaysText, setNewHolidaysText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setNewHandbookText(text);
      if (text.length > 0 && text.split('\n')[0].length < 50) {
        setNewCompanyName(text.split('\n')[0].replace(/[^a-zA-Z ]/g, "").trim());
      }
    };
    reader.readAsText(file);
  };

  const handleAdoptCompany = async () => {
    if (!newCompanyName.trim()) return;
    setIsProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      let parsedHolidays = company.holidays;
      let parsedSections = company.handbookSections;

      // Parallelize AI parsing for speed
      const tasks = [];

      if (newHolidaysText.trim()) {
        tasks.push(
          ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Extract holidays from the following text and return them as a JSON array of objects with 'date' (format YYYY-MM-DD) and 'name'. 
            If the year is not specified, assume 2025. Text to parse:
            ---
            ${newHolidaysText}
            ---`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: 'ISO date string YYYY-MM-DD' },
                    name: { type: Type.STRING, description: 'The holiday name' }
                  },
                  required: ['date', 'name']
                }
              }
            }
          }).then(res => {
            try {
              const data = JSON.parse(res.text || "[]");
              if (Array.isArray(data)) parsedHolidays = data;
            } catch (e) {
              console.error("Failed to parse AI holiday JSON", e);
            }
          })
        );
      }

      if (newHandbookText.trim()) {
        tasks.push(
          ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Split the following company handbook text into 4-6 logical, well-organized sections. 
            Return a JSON array of objects with 'title' (short, uppercase) and 'content' (full paragraph). Text to parse:
            ---
            ${newHandbookText}
            ---`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING }
                  },
                  required: ['title', 'content']
                }
              }
            }
          }).then(res => {
            try {
              const data = JSON.parse(res.text || "[]");
              if (Array.isArray(data)) parsedSections = data;
            } catch (e) {
              console.error("Failed to parse AI handbook JSON", e);
            }
          })
        );
      }

      await Promise.all(tasks);

      onUpdateCompany({
        name: newCompanyName,
        handbookSections: parsedSections,
        holidays: parsedHolidays
      });
      
      setShowConfig(false);
    } catch (err) {
      console.error("AI Workspace Setup Error:", err);
      // Fallback: Just update name if AI fails
      onUpdateCompany({
        ...company,
        name: newCompanyName
      });
      setShowConfig(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <aside className="w-full lg:w-[380px] flex flex-col gap-6">
      {/* Dynamic Company Badge */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-100 flex flex-col gap-4 relative overflow-hidden group">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center font-black text-xl border border-white/30">
            {company.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight leading-tight">{company.name}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Authenticated Tenant</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowConfig(!showConfig)}
          className="bg-white/10 border-white/20 text-white hover:bg-white hover:text-blue-600 text-[10px] font-black tracking-widest uppercase py-3 rounded-xl relative z-10"
        >
          {showConfig ? "Cancel Setup" : "Adopt New Company"}
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[550px]">
        {showConfig ? (
          <div className="flex-1 flex flex-col p-8 bg-slate-50 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Setup Workspace</h2>
            
            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Company Identity</label>
                <input 
                  type="text" 
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full text-sm font-bold p-4 bg-white rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                  placeholder="e.g. Zoho"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Handbook Content (RAG)</label>
                <textarea 
                  value={newHandbookText}
                  onChange={(e) => setNewHandbookText(e.target.value)}
                  className="w-full text-xs font-medium p-4 bg-white rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 transition-all outline-none h-32 resize-none"
                  placeholder="Paste policies, dress code, leave rules from PDF..."
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  Or upload .txt / .md
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Office Holidays</label>
                  <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase">Smart AI Parsing</span>
                </div>
                <textarea 
                  value={newHolidaysText}
                  onChange={(e) => setNewHolidaysText(e.target.value)}
                  className="w-full text-xs font-medium p-4 bg-white rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 transition-all outline-none h-32 resize-none"
                  placeholder="Paste holiday list here (e.g. New Year Jan 1, Republic Day Jan 26...)"
                />
              </div>
            </div>

            <Button 
              onClick={handleAdoptCompany} 
              isLoading={isProcessing}
              className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-widest py-5 shadow-xl shadow-blue-200"
            >
              {isProcessing ? "AI structuring data..." : "Initialize Workspace"}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex bg-slate-50/80 p-2 m-3 rounded-2xl border border-gray-100 shrink-0">
              {[
                { id: 'handbook', label: 'KNOWLEDGE' },
                { id: 'holidays', label: 'HOLIDAYS' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-[10px] font-black tracking-widest transition-all rounded-xl ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === 'handbook' ? (
                <div className="space-y-6">
                  {company.handbookSections.map((section, idx) => (
                    <div 
                      key={idx} 
                      className="group p-5 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all cursor-pointer" 
                      onClick={() => onQuickAction(`Tell me about ${section.title} in ${company.name}`)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{section.title}</h4>
                        <div className="w-5 h-5 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2.5 h-2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                           </svg>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-3">
                        {section.content}
                      </p>
                    </div>
                  ))}
                  {company.handbookSections.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                      <p className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">No Knowledge Found</p>
                      <Button variant="outline" size="sm" onClick={() => setShowConfig(true)} className="rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest">Setup Knowledge Base</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 mb-6 px-1">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{company.name.toUpperCase()} HOLIDAYS</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active for current calendar year</p>
                  </div>
                  <div className="grid gap-2.5">
                    {company.holidays.length > 0 ? company.holidays.map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between p-5 rounded-2xl border border-slate-50 bg-slate-50/30">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 tracking-tight">{h.name}</span>
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                            {new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' })}
                          </span>
                        </div>
                        <span className="text-sm font-black text-blue-600">
                          {new Date(h.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No Holidays Configured</p>
                        <p className="text-[9px] text-slate-300 mt-2">Paste your list in Adopt Company settings</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-gray-100 shrink-0">
               <Button variant="outline" size="sm" className="w-full text-[11px] font-black tracking-widest uppercase py-4 rounded-2xl bg-white shadow-sm hover:text-blue-600 transition-all">
                 Generate Onboarding Deck
               </Button>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 shrink-0">
        {[
          { icon: '💼', label: 'IT Assets', color: 'bg-blue-50 text-blue-700', prompt: `How do I request IT equipment at ${company.name}?` },
          { icon: '🤝', label: 'Mentors', color: 'bg-emerald-50 text-emerald-700', prompt: `Who are the mentors for new hires at ${company.name}?` },
          { icon: '🔐', label: 'Security', color: 'bg-orange-50 text-orange-700', prompt: `What are the security and firewall policies at ${company.name}?` },
          { icon: '📈', label: 'Benefits', color: 'bg-indigo-50 text-indigo-700', prompt: `Summarize the employee benefits and healthcare for ${company.name}.` },
        ].map((btn, i) => (
          <button 
            key={i} 
            onClick={() => onQuickAction(btn.prompt)}
            className={`flex flex-col items-start p-6 rounded-3xl shadow-sm border border-white/50 hover:scale-[1.05] active:scale-[0.98] transition-all ${btn.color} group text-left`}
          >
            <span className="text-2xl mb-3 group-hover:scale-110 transition-transform">{btn.icon}</span>
            <span className="text-[11px] font-black uppercase tracking-tight">{btn.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};