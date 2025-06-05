import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SlidersHorizontal, BrainCircuit, Sigma, Clock4, Activity, BarChartBig } from 'lucide-react';

const generateSampleTokenData = (currentUsage) => {
  const baseTokens = currentUsage?.callCount || 0;
  return [
    { name: 'Jan', tokens: Math.max(0, baseTokens - Math.floor(Math.random() * 100)) },
    { name: 'Feb', tokens: Math.max(0, baseTokens - Math.floor(Math.random() * 80)) },
    { name: 'Mar', tokens: Math.max(0, baseTokens - Math.floor(Math.random() * 60)) },
    { name: 'Apr', tokens: Math.max(0, baseTokens - Math.floor(Math.random() * 40)) },
    { name: 'May', tokens: Math.max(0, baseTokens - Math.floor(Math.random() * 20)) },
    { name: 'Jun', tokens: baseTokens },
  ];
};

export default function MCPXAnalytics({ configurationData, mcpServers, aiAgents }) {
  if (!configurationData) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-[var(--color-text-secondary)]">Configuration data not available.</p>
      </div>
    );
  }

  const totalToolInvocations = configurationData.usage?.callCount || 0;
  const lastUpdated = configurationData.lastUpdatedAt ? new Date(configurationData.lastUpdatedAt) : new Date();
  
  const llmModels = aiAgents
    .filter(agent => agent.llm && agent.llm.model !== "unknown")
    .map(agent => `${agent.llm.provider}/${agent.llm.model}`)
    .join(", ") || "No LLM data";

  const estimatedTokens = totalToolInvocations * 150;

  const analyticsTiles = [
    { 
      title: "Tokens Used (Est.)", 
      value: estimatedTokens.toLocaleString(), 
      icon: Sigma, 
      color: "var(--color-data-series-1)",
      comingSoon: true
    },
    { 
      title: "LLM Models Active", 
      value: llmModels, 
      icon: BrainCircuit, 
      color: "var(--color-data-series-2)",
      comingSoon: true
    },
    { 
      title: "Total Tool Invocations", 
      value: totalToolInvocations.toLocaleString(), 
      icon: SlidersHorizontal, 
      color: "var(--color-data-series-3)",
      comingSoon: true
    },
    { 
      title: "Config Last Updated", 
      value: lastUpdated.toLocaleTimeString(), 
      icon: Clock4, 
      color: "var(--color-fg-success)",
      comingSoon: false
    },
  ];

  const tokenData = generateSampleTokenData(configurationData.usage);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {analyticsTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <Card key={tile.title} className={`bg-[var(--color-bg-container-overlay)] border-[var(--color-border-primary)] ${tile.comingSoon ? 'opacity-50' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2 px-2.5">
                <CardTitle className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                  {tile.title}
                  {tile.comingSoon && (
                    <Badge variant="outline" className="ml-1 text-[6px] px-1 py-0">
                      Coming Soon
                    </Badge>
                  )}
                </CardTitle>
                <Icon className="h-3 w-3 text-[var(--color-text-disabled)]" style={{ color: tile.color }} />
              </CardHeader>
              <CardContent className="pb-2 px-2.5">
                <div className={`text-xs font-bold truncate ${tile.comingSoon ? 'text-[var(--color-text-disabled)]' : 'text-[var(--color-text-primary)]'}`} style={{ color: tile.comingSoon ? undefined : tile.color }}>
                  {tile.comingSoon ? 'N/A' : tile.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h4 className="font-medium text-xs text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          Tool Invocations Over Time 
          <Badge variant="outline" className="text-[6px] px-1 py-0 opacity-50">
            Coming Soon
          </Badge>
        </h4>
        <div className="h-[140px] bg-[var(--color-bg-container-overlay)] p-2 rounded-md border border-[var(--color-border-primary)] opacity-50">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tokenData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 8 }} stroke="var(--color-border-primary)" />
              <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 8 }} stroke="var(--color-border-primary)" />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'var(--color-bg-container)', 
                  borderColor: 'var(--color-border-interactive)',
                  borderRadius: '0.375rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '9px',
                  padding: '4px 8px'
                }}
                itemStyle={{ color: 'var(--color-text-primary)' }}
              />
              <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '4px' }} />
              <Line 
                type="monotone" 
                dataKey="tokens" 
                stroke="var(--color-data-series-4)" 
                strokeWidth={1}
                dot={{ r: 1.5, fill: 'var(--color-data-series-4)' }}
                activeDot={{ r: 3 }} 
                name="Invocations" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-[var(--color-text-secondary)] mt-1 text-center opacity-50">
          Sample data - Real analytics coming soon.
        </p>
      </div>
    </div>
  );
}