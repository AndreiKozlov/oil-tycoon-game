import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { CenterStage } from '../components/CenterStage';
import { PlotHeader } from '../components/PlotHeader';
import { QuickActions } from '../components/QuickActions';
import { StatusStrip } from '../components/StatusStrip';
import { TopBar } from '../components/TopBar';
import { mockPlayer, mockPlot } from '../data/mockData';

export function PlotScreen() {
  const [activeTab, setActiveTab] = useState<
    'build' | 'world' | 'market' | 'leaderboard' | 'settings'
  >('build');

  return (
    <div className="flex h-full flex-col">
      <TopBar player={mockPlayer} />
      <PlotHeader plotName={mockPlot.name} />
      <CenterStage buildings={mockPlot.buildings} />
      <StatusStrip plot={mockPlot} />
      <QuickActions />
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
