
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Product, ExpiryStatus } from '../types';
import { calculateDaysRemaining, getExpiryStatus } from '../utils/helpers';
import { AlertCircle, CheckCircle2, Clock, Package } from 'lucide-react';

interface DashboardProps {
  products: Product[];
}

const Dashboard: React.FC<DashboardProps> = ({ products }) => {
  const stats = useMemo(() => {
    const s = { expired: 0, warning: 0, safe: 0 };
    products.forEach(p => {
      const days = calculateDaysRemaining(p.expiryDate);
      const status = getExpiryStatus(days);
      if (status === ExpiryStatus.EXPIRED) s.expired++;
      else if (status === ExpiryStatus.WARNING) s.warning++;
      else s.safe++;
    });
    return s;
  }, [products]);

  const chartData = [
    { name: 'Vencidos', value: stats.expired, color: '#f43f5e' }, // rose-500
    { name: 'Atenção', value: stats.warning, color: '#f59e0b' }, // amber-500
    { name: 'OK', value: stats.safe, color: '#10b981' }, // emerald-500
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total" value={products.length} icon={<Package className="w-5 h-5" />} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard title="Vencidos" value={stats.expired} icon={<AlertCircle className="w-5 h-5" />} color="text-rose-600" bg="bg-rose-50" />
        <StatCard title="Atenção" value={stats.warning} icon={<Clock className="w-5 h-5" />} color="text-amber-600" bg="bg-amber-50" />
        <StatCard title="Seguros" value={stats.safe} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8">
        <div className="w-full h-64 md:w-1/2">
          {products.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 italic">
              Nenhum dado para exibir
            </div>
          )}
        </div>
        <div className="w-full md:w-1/2 space-y-4">
          <h3 className="text-xl font-bold text-slate-800">Status do Estoque</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            Mantenha seu controle em dia. Atualmente, 
            <span className="font-bold text-rose-500 mx-1">{(stats.expired / products.length * 100 || 0).toFixed(0)}%</span> 
            dos seus itens estão fora do prazo.
          </p>
          <div className="pt-2">
             <div className="w-full bg-slate-100 rounded-full h-3">
                <div 
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-700 shadow-sm" 
                  style={{ width: `${(stats.safe / products.length * 100) || 0}%` }}
                ></div>
             </div>
             <p className="text-xs font-bold text-slate-400 mt-3 text-right uppercase tracking-wider">Eficiência: {((stats.safe / products.length * 100) || 0).toFixed(0)}% saudável</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, bg }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-transform hover:scale-[1.02]">
    <div className="flex items-center justify-between mb-3">
      <div className={`${bg} ${color} p-2.5 rounded-xl`}>{icon}</div>
      <span className="text-2xl font-black text-slate-800">{value}</span>
    </div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
  </div>
);

export default Dashboard;
