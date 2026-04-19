import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { translations, Language } from '../lib/translations';

interface DocumentationContentProps {
  tab: 'ear' | 'principles';
  language: Language;
}

export function DocumentationContent({ tab, language }: DocumentationContentProps) {
  const t = translations[language];

  const m3BeatData = [
    { name: 'F3-A3', hz: 6.9, color: '#3b82f6' },
    { name: 'F#3-A#3', hz: 7.3, color: '#3b82f6' },
    { name: 'G3-B3', hz: 7.8, color: '#3b82f6' },
    { name: 'G#3-C4', hz: 8.2, color: '#10b981' },
    { name: 'A3-C#4', hz: 8.7, color: '#10b981' },
    { name: 'A#3-D4', hz: 9.2, color: '#10b981' },
    { name: 'B3-D#4', hz: 9.8, color: '#f59e0b' },
    { name: 'C4-E4', hz: 10.4, color: '#f59e0b' },
    { name: 'C#4-F4', hz: 11.0, color: '#ef4444' },
  ];

  if (tab === 'principles') {
    return (
      <div className="space-y-8 text-zinc-600">
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">{t.appPrinciplesTitle}</h3>
          <p className="text-sm leading-relaxed">{t.appPrinciplesP1}</p>
          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Technical Note</p>
            <p className="text-xs italic leading-relaxed">{t.appPrinciplesP2}</p>
          </div>
          <p className="text-sm leading-relaxed">{t.appPrinciplesP3}</p>
        </section>

        <section className="space-y-6 pt-4 border-t border-zinc-100">
          <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Functional Guide</h4>
          
          <div className="grid gap-6">
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                {t.guideFunction}
              </h5>
              <p className="text-xs leading-relaxed">{t.guideFunctionDesc}</p>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                {t.knobFunction}
              </h5>
              <p className="text-xs leading-relaxed">{t.knobFunctionDesc}</p>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                {t.modesFunction}
              </h5>
              <p className="text-xs leading-relaxed">{t.modesFunctionDesc}</p>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                {t.conditionFunction}
              </h5>
              <p className="text-xs leading-relaxed">{t.conditionFunctionDesc}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-zinc-600">
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">{t.tuningByEarTitle}</h3>
        <p className="text-sm leading-relaxed">{t.tuningByEarP1}</p>
        <p className="text-sm leading-relaxed">{t.tuningByEarP2}</p>
      </section>

      <section className="space-y-4 bg-primary/5 p-6 rounded-3xl border border-primary/10">
        <h4 className="text-sm font-bold text-primary uppercase tracking-wider">{t.tuningSequence}</h4>
        <div className="flex flex-wrap justify-center gap-2">
          {t.tuningSteps.split(' → ').map((step, i, arr) => (
            <React.Fragment key={i}>
              <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-primary/10 text-[10px] md:text-xs font-mono font-bold text-zinc-700">
                {step}
              </div>
              {i < arr.length - 1 && (
                <div className="flex items-center text-primary/30">
                  <span className="text-[10px]">→</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">{t.coincidentalSpeed}</h4>
        <p className="text-xs text-zinc-500 italic mb-2">{t.beatSpeedGoal}</p>
        
        <div className="h-[240px] w-full bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m3BeatData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8, fontWeight: 'bold' }} 
                angle={-45} 
                textAnchor="end"
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8, fontWeight: 'bold' }} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="hz" radius={[4, 4, 0, 0]} barSize={20}>
                {m3BeatData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-6 pt-4 border-t border-zinc-100">
        <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">{t.checkpoints}</h4>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {t.towerOfThirds}
            </h5>
            <p className="text-xs leading-relaxed">{t.towerOfThirdsDesc}</p>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              {t.earlyProgress}
            </h5>
            <p className="text-xs leading-relaxed">{t.earlyProgressDesc}</p>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              {t.thirdProgression}
            </h5>
            <p className="text-xs leading-relaxed">{t.thirdProgressionDesc}</p>
          </div>
        </div>
      </section>

      <p className="text-sm leading-relaxed pb-4">{t.tuningByEarP3}</p>
    </div>
  );
}
