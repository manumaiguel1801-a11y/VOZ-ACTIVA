import React, { useMemo } from 'react';
import {
  Download,
  Lock,
  TrendingUp,
  CreditCard,
  Users,
  Package,
  FileCheck,
  Star,
  Zap,
  ShieldCheck,
  Clock,
  BarChart2,
  Share2,
  CalendarDays,
  ArrowUpCircle,
  ShoppingBag,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { Sale, Expense, Debt, UserProfile } from '../types';
import {
  calculateScore, getScoreLabel, getScoreColor,
  getBusinessAgeDays, formatBusinessAge,
  getTopProducts, getMonthlyProjection, getNextLevel,
} from '../services/scoringService';
import { generatePassportPDF } from '../services/pdfService';

interface Props {
  isDarkMode: boolean;
  sales: Sale[];
  expenses: Expense[];
  debts: Debt[];
  profile: UserProfile | null;
}

interface FactorCard {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  tip: string;
}

function qualitativeLabel(pct: number): { text: string; color: string } {
  if (pct >= 0.8) return { text: 'Excelente', color: '#22c55e' };
  if (pct >= 0.6) return { text: 'Bien',      color: '#DAA520' };
  if (pct >= 0.35) return { text: 'Mejorable', color: '#f97316' };
  return { text: 'Bajo', color: '#ef4444' };
}

interface Logro {
  icon: React.ReactNode;
  label: string;
  hint: string;
  unlocked: boolean;
}

export const PassportView = ({ isDarkMode, sales, expenses, debts, profile }: Props) => {
  const [isGenerating, setIsGenerating] = React.useState(false);

  const breakdown = useMemo(
    () => calculateScore(sales, expenses, debts),
    [sales, expenses, debts],
  );

  const { scoreFinal, hasEnoughData } = breakdown;
  const scoreColor = getScoreColor(scoreFinal);
  const scoreLabel = getScoreLabel(scoreFinal);

  const ageDays = useMemo(() => getBusinessAgeDays(sales, expenses, debts), [sales, expenses, debts]);
  const topProducts = useMemo(() => getTopProducts(sales), [sales]);
  const monthlyProjection = useMemo(() => getMonthlyProjection(sales), [sales]);
  const nextLevel = useMemo(() => getNextLevel(scoreFinal), [scoreFinal]);

  const handleDownload = async () => {
    if (!hasEnoughData) return;
    setIsGenerating(true);
    try {
      await generatePassportPDF(profile, sales, expenses, debts);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!hasEnoughData) return;
    const label = getScoreLabel(scoreFinal);
    const text = [
      '📊 Mi Pasaporte Financiero Voz-Activa',
      `🏆 Score: ${scoreFinal}/950 — ${label}`,
      `📅 Antigüedad del negocio: ${formatBusinessAge(ageDays)}`,
      `💰 Proyección mensual: $${monthlyProjection.toLocaleString('es-CO')}`,
      '',
      'Generado con Voz-Activa — Scoring Crediticio Alternativo',
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mi Pasaporte Financiero Voz-Activa', text });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    } catch (_) { /* share cancelado */ }
  };

  // Donut chart escala colombiana 150–950
  const scoreRange = 950 - 150;
  const scoreValue = scoreFinal - 150;
  const chartData = [
    { name: 'Score', value: scoreValue },
    { name: 'Resto', value: scoreRange - scoreValue },
  ];

  const factors: FactorCard[] = useMemo(() => [
    {
      label: 'Consistencia de ingresos',
      description: 'Regularidad con la que registras ventas',
      icon: <TrendingUp className="w-5 h-5" />,
      value: breakdown.consistenciaIngresos,
      max: 30,
      tip: 'Registra tus ventas con más frecuencia, idealmente cada día que vendas.',
    },
    {
      label: 'Capacidad de pago',
      description: 'Ingresos netos después de cubrir gastos',
      icon: <CreditCard className="w-5 h-5" />,
      value: breakdown.capacidadPago,
      max: 25,
      tip: 'Tus gastos son altos vs tus ingresos. Intenta reducir costos o aumentar ventas.',
    },
    {
      label: 'Gestión de fiados',
      description: 'Recuperación de fiados y cumplimiento de deudas',
      icon: <Users className="w-5 h-5" />,
      value: breakdown.gestionFiados,
      max: 20,
      tip: 'Registra cuando te paguen los fiados y cuando pagues tus deudas.',
    },
    {
      label: 'Salud de inventario',
      description: 'Flujo coherente entre compras y ventas',
      icon: <Package className="w-5 h-5" />,
      value: breakdown.saludInventario,
      max: 15,
      tip: 'Registra también tus compras e insumos del negocio.',
    },
    {
      label: 'Calidad de datos',
      description: 'Frecuencia y claridad de tus registros',
      icon: <FileCheck className="w-5 h-5" />,
      value: breakdown.calidadDatos,
      max: 10,
      tip: 'Registra tus movimientos con descripciones claras y de forma regular.',
    },
  ], [breakdown]);

  // Logros
  const logros: Logro[] = useMemo(() => {
    const uniqueSaleDays = new Set(
      sales.map((s) => {
        const d = s.createdAt?.toDate ? s.createdAt.toDate() : null;
        return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : null;
      }).filter(Boolean),
    ).size;

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recentActivity = [...sales, ...expenses].some((r) => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : null;
      return d && d.getTime() >= sevenDaysAgo;
    });

    const totalIngresos = sales.reduce((s, v) => s + v.total, 0);
    const totalGastos = expenses.reduce((s, e) => s + e.amount, 0);
    const capacidadRatio = totalIngresos > 0 ? (totalIngresos - totalGastos) / totalIngresos : 0;

    const meDeben = debts.filter((d) => d.type === 'me-deben');
    const fiadoTotal = meDeben.reduce((s, d) => s + d.amount, 0);
    const fiadoRecuperado = meDeben.reduce((s, d) => s + (d.amountPaid ?? 0), 0);
    const recuperacion = fiadoTotal > 0 ? fiadoRecuperado / fiadoTotal : 0;

    return [
      {
        icon: <Star className="w-7 h-7" />,
        label: 'Vendedor Constante',
        hint: 'Registra ventas ≥20 días',
        unlocked: uniqueSaleDays >= 20,
      },
      {
        icon: <TrendingUp className="w-7 h-7" />,
        label: 'Ahorro Inteligente',
        hint: 'Capacidad de pago > 30%',
        unlocked: capacidadRatio > 0.3,
      },
      {
        icon: <Users className="w-7 h-7" />,
        label: 'Cobrador Eficiente',
        hint: 'Recupera > 70% de fiados',
        unlocked: recuperacion > 0.7,
      },
      {
        icon: <Zap className="w-7 h-7" />,
        label: 'Negocio Activo',
        hint: 'Actividad en los últimos 7 días',
        unlocked: recentActivity,
      },
      {
        icon: <FileCheck className="w-7 h-7" />,
        label: 'Datos Confiables',
        hint: 'Calidad de datos ≥ 7/10',
        unlocked: breakdown.calidadDatos >= 7,
      },
      {
        icon: <ShieldCheck className="w-7 h-7" />,
        label: 'Score Excelente',
        hint: 'Alcanza 750+ puntos',
        unlocked: scoreFinal >= 750,
      },
    ];
  }, [sales, expenses, debts, breakdown, scoreFinal]);

  return (
    <div className="space-y-10 pb-4">

      {/* ── Hero: donut + score ── */}
      <section className="flex flex-col items-center pt-4">
        <div className="relative w-56 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={92}
                startAngle={200}
                endAngle={-20}
                paddingAngle={0}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill={hasEnoughData ? scoreColor : (isDarkMode ? '#333' : '#e3e3df')} />
                <Cell fill={isDarkMode ? '#222' : '#e8e8e4'} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span
              className="font-['Plus_Jakarta_Sans'] font-extrabold text-5xl leading-none"
              style={{ color: hasEnoughData ? scoreColor : undefined }}
            >
              {hasEnoughData ? scoreFinal : '—'}
            </span>
            <span className={cn('text-xs font-bold mt-1', isDarkMode ? 'text-[#FDFBF0]/50' : 'text-[#5b5c5a]')}>
              / 950
            </span>
          </div>
        </div>

        <div className="mt-4 text-center space-y-1">
          <h2 className="font-['Plus_Jakarta_Sans'] font-black text-2xl">
            {hasEnoughData ? scoreLabel : 'Construyendo tu score'}
          </h2>
          <p className={cn('text-xs font-bold uppercase tracking-widest', isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')}>
            Pasaporte Financiero Voz-Activa
          </p>
        </div>

        {/* Pills de stats rápidos */}
        {hasEnoughData && (
          <div className="flex gap-2 mt-5 flex-wrap justify-center">
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
              <CalendarDays className="w-3.5 h-3.5 text-[#B8860B]" />
              {formatBusinessAge(ageDays)}
            </div>
            {monthlyProjection > 0 && (
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
                <TrendingUp className="w-3.5 h-3.5 text-[#B8860B]" />
                ${monthlyProjection.toLocaleString('es-CO')}/mes
              </div>
            )}
          </div>
        )}

        {/* Sin datos suficientes */}
        {!hasEnoughData && (
          <div className={cn(
            'mt-6 w-full rounded-2xl p-5 space-y-3',
            isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#f1f1ee]',
          )}>
            <p className="font-bold text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#B8860B]" />
              Para activar tu score registra:
            </p>
            <ul className={cn('text-xs space-y-1.5 pl-1', isDarkMode ? 'text-[#FDFBF0]/60' : 'text-[#5b5c5a]')}>
              <li>• Al menos 5 ventas o gastos en total</li>
              <li>• Usa el asistente: <span className="font-bold">"Vendí 3 almuerzos a 15 mil"</span></li>
              <li>• O registra un gasto: <span className="font-bold">"Gasté 20 mil en insumos"</span></li>
            </ul>
          </div>
        )}
      </section>

      {/* ── Desglose de factores ── */}
      <section className="space-y-4">
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl px-1">Desglose del score</h3>
        <div className="space-y-3">
          {factors.map((f) => {
            const pct = f.value / f.max;
            const { text: qlLabel, color: qlColor } = qualitativeLabel(pct);
            const showTip = pct < 0.6;
            return (
              <div
                key={f.label}
                className={cn(
                  'p-4 rounded-2xl space-y-3',
                  isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      isDarkMode ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-[#FFF8DC] text-[#B8860B]',
                    )}>
                      {f.icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-tight">{f.label}</p>
                      <p className={cn('text-[10px] leading-tight mt-0.5', isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')}>
                        {f.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-black shrink-0 px-2.5 py-1 rounded-full"
                    style={{ color: qlColor, backgroundColor: qlColor + '18' }}
                  >
                    {qlLabel}
                  </span>
                </div>
                <div className={cn('h-1.5 rounded-full overflow-hidden', isDarkMode ? 'bg-white/10' : 'bg-[#f1f1ee]')}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct * 100}%`, backgroundColor: qlColor }}
                  />
                </div>
                {showTip && (
                  <p className={cn('text-[10px] leading-snug', isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')}>
                    💡 {f.tip}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Top productos ── */}
      {topProducts.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl px-1">Tus productos estrella</h3>
          <div className="space-y-2">
            {topProducts.map((p, i) => {
              const maxTotal = topProducts[0].total;
              const pct = maxTotal > 0 ? p.total / maxTotal : 0;
              return (
                <div key={p.name} className={cn('p-4 rounded-2xl flex items-center gap-3', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                    i === 0 ? 'bg-[#FFD700]/20 text-[#B8860B]' : isDarkMode ? 'bg-white/10 text-white/40' : 'bg-[#f1f1ee] text-[#5b5c5a]/60'
                  )}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <div className={cn('h-1.5 rounded-full mt-1.5 overflow-hidden', isDarkMode ? 'bg-white/10' : 'bg-[#f1f1ee]')}>
                      <div className="h-full rounded-full bg-[#B8860B]" style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                  <p className="font-black text-sm text-[#B8860B] shrink-0">${p.total.toLocaleString('es-CO')}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Acciones: descargar + compartir ── */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={!hasEnoughData || isGenerating}
          className={cn(
            'flex-1 h-14 flex items-center justify-center gap-2 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95',
            hasEnoughData
              ? 'bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60',
          )}
        >
          <Download className="w-5 h-5" />
          {isGenerating ? 'Generando...' : 'Descargar PDF'}
        </button>
        <button
          onClick={handleShare}
          disabled={!hasEnoughData}
          className={cn(
            'h-14 px-5 flex items-center justify-center gap-2 rounded-2xl font-bold text-sm transition-all active:scale-95',
            hasEnoughData
              ? isDarkMode ? 'bg-[#1A1A1A] text-[#FFD700]' : 'bg-white text-[#B8860B] shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60',
          )}
        >
          <Share2 className="w-5 h-5" />
          Compartir
        </button>
      </div>

      {/* ── Logros ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl">Tus Logros</h3>
          <span className={cn('text-xs font-bold', isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')}>
            {logros.filter((l) => l.unlocked).length}/{logros.length} desbloqueados
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {logros.map((logro) => (
            <div
              key={logro.label}
              className={cn(
                'p-5 rounded-2xl flex flex-col items-center text-center shadow-sm transition-all duration-300',
                isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white',
                !logro.unlocked && 'opacity-40',
              )}
            >
              <div className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center mb-3',
                logro.unlocked
                  ? isDarkMode ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-[#FFF8DC] text-[#B8860B]'
                  : isDarkMode ? 'bg-[#2A2A2A] text-[#FDFBF0]/30' : 'bg-[#f1f1ee] text-[#5b5c5a]/40',
              )}>
                {logro.icon}
              </div>
              <span className="font-bold text-sm leading-tight">{logro.label}</span>
              <span className={cn(
                'text-[10px] mt-1.5 flex items-center gap-1',
                logro.unlocked
                  ? 'text-[#22c55e] font-bold'
                  : isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60',
              )}>
                {logro.unlocked
                  ? '✓ Desbloqueado'
                  : <><Lock className="w-3 h-3" />{logro.hint}</>}
              </span>
            </div>
          ))}
        </div>

        <p className={cn(
          'text-center text-[10px] font-bold uppercase tracking-wider mt-2 flex items-center justify-center gap-1',
          isDarkMode ? 'text-[#FDFBF0]/20' : 'text-[#5b5c5a]/40',
        )}>
          <Clock className="w-3 h-3" />
          Actualizado en tiempo real · datos de tu negocio
        </p>
      </section>

      {/* ── Siguiente nivel ── */}
      {nextLevel && hasEnoughData && (
        <section className={cn('rounded-2xl p-5 space-y-4', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', isDarkMode ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-[#FFF8DC] text-[#B8860B]')}>
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-sm">Para llegar a <span className="text-[#B8860B]">{nextLevel.label}</span></p>
              <p className={cn('text-[10px]', isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')}>
                Meta: {nextLevel.target} puntos · Ahora tienes {scoreFinal}
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {nextLevel.tips.map((tip) => (
              <li key={tip} className={cn('flex items-start gap-2 text-xs', isDarkMode ? 'text-[#FDFBF0]/70' : 'text-[#2e2f2d]')}>
                <span className="text-[#B8860B] font-black mt-0.5">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
