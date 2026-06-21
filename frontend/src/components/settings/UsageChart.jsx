import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '@/services/apiClient';
import { API_ROUTES } from '@/config/constants';

/**
 * UsageChart — Uses Recharts to render a bar chart of daily LLM token consumption.
 */
function UsageChart() {
  const [data, setData] = useState([]);
  const [totalTokens, setTotalTokens] = useState(0);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await apiClient.get(API_ROUTES.USAGE.WEEKLY);
        setData(response.data);
        
        const sum = response.data.reduce((acc, curr) => acc + curr.tokens, 0);
        setTotalTokens(sum);
      } catch (err) {
        console.error('Failed to fetch token usage data:', err);
      }
    };
    fetchUsage();
  }, []);

  return (
    <div className="glass-card p-6 border-forge-border shadow-xl">
      <h3 className="text-sm font-bold text-forge-text mb-6 uppercase tracking-wider">Weekly LLM Token Usage</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
            <Tooltip 
              cursor={{ fill: '#27272a', opacity: 0.4 }} 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
              itemStyle={{ color: '#a855f7', fontWeight: 'bold' }}
            />
            <Bar dataKey="tokens" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-800/50 flex justify-between text-sm text-zinc-500">
        <span>Current Billing Cycle: <strong className="text-white">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</strong></span>
        <span>Total Usage: <strong className="text-forge-accent">{totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} Tokens</strong></span>
      </div>
    </div>
  );
}

export default UsageChart;
