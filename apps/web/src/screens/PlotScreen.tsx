import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { BuildingModal } from '../components/BuildingModal';
import { CenterStage } from '../components/CenterStage';
import { PlotHeader } from '../components/PlotHeader';
import { QuickActions } from '../components/QuickActions';
import { StatusStrip } from '../components/StatusStrip';
import { TopBar } from '../components/TopBar';
import { useGameStore } from '../store/gameStore';
import { useGameTick } from '../store/useGameTick';

export function PlotScreen() {
  useGameTick();
  const player = useGameStore((s) => s.player);
  const plot = useGameStore((s) => s.plot);

  const [activeTab, setActiveTab] = useState<
    'build' | 'world' | 'market' | 'leaderboard' | 'settings'
  >('build');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  return (
    <div className="relative flex h-full flex-col">
      <TopBar player={player} />
      <PlotHeader plotName={plot.name} />
      <CenterStage buildings={plot.buildings} onSelect={setSelectedBuildingId} />
      <StatusStrip plot={plot} />
      <QuickActions />
      <BottomNav active={activeTab} onChange={setActiveTab} />
      <BuildingModal
        buildingId={selectedBuildingId}
        onClose={() => setSelectedBuildingId(null)}
      />
    </div>
  );
}
