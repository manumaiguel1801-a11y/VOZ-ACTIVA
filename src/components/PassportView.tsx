import React from 'react';
import {
  Download,
  Lock,
  Star,
  ShieldCheck
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import { cn } from '../lib/utils';

const SCORE = 0;

const SCORE_DATA = [
  { name: 'Score', value: SCORE },
  { name: 'Resto', value: 1000 - SCORE },
];

export const PassportView = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="space-y-12">
    <section className="flex flex-col items-center justify-center py-8">
      <div className="relative w-64 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={SCORE_DATA}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={100}
              startAngle={180}
              endAngle={-180}
              paddingAngle={0}
              dataKey="value"
            >
              <Cell fill={isDarkMode ? "#333" : "#e3e3df"} />
              <Cell fill={isDarkMode ? "#333" : "#e3e3df"} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-5xl">0</span>
          <span className={cn(
            "text-sm font-semibold",
            isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]"
          )}>/ 1000</span>
        </div>
      </div>
      <div className="mt-8 text-center">
        <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-3xl mb-2">Score de Confianza</h2>
        <p className={cn(
          "font-medium px-4 py-2 rounded-full inline-block transition-colors duration-500",
          isDarkMode ? "bg-white/5 text-[#FDFBF0]/60" : "bg-[#f1f1ee] text-[#5b5c5a]"
        )}>
          Completa tu perfil para construir tu score
        </p>
      </div>
    </section>

    <button className="w-full h-16 flex items-center justify-center gap-3 bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform">
      <Download className="w-6 h-6" />
      Descargar Pasaporte PDF
    </button>

    <section>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-2xl">Tus Logros</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "p-6 rounded-xl flex flex-col items-center text-center shadow-sm transition-colors duration-500 opacity-40",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-white"
        )}>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mb-4",
            isDarkMode ? "bg-[#2A2A2A]" : "bg-[#f1f1ee]"
          )}>
            <Star className="w-8 h-8" />
          </div>
          <span className="font-bold text-sm">Ahorrador Estrella</span>
          <span className={cn(
            "text-xs mt-1 flex items-center gap-1",
            isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]"
          )}>
            <Lock className="w-3 h-3" /> Bloqueado
          </span>
        </div>
        <div className={cn(
          "p-6 rounded-xl flex flex-col items-center text-center shadow-sm transition-colors duration-500 opacity-40",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-white"
        )}>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mb-4",
            isDarkMode ? "bg-[#2A2A2A]" : "bg-[#f1f1ee]"
          )}>
            <ShieldCheck className="w-8 h-8" />
          </div>
          <span className="font-bold text-sm">Negocio Verificado</span>
          <span className={cn(
            "text-xs mt-1 flex items-center gap-1",
            isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]"
          )}>
            <Lock className="w-3 h-3" /> Bloqueado
          </span>
        </div>
      </div>
      <p className={cn(
        "text-center text-xs mt-4",
        isDarkMode ? "text-[#FDFBF0]/30" : "text-[#5b5c5a]/60"
      )}>
        Registra actividad para desbloquear logros
      </p>
    </section>
  </div>
);
