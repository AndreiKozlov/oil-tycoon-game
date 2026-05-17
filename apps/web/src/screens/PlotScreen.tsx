import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { BuildingModal } from '../components/BuildingModal';
import { BuildSheet } from '../components/BuildSheet';
import { CenterStage } from '../components/CenterStage';
import { LevelUpBanner } from '../components/LevelUpBanner';
import { PlotHeader } from '../components/PlotHeader';
import { QuickActions } from '../components/QuickActions';
import { SaleToast } from '../components/SaleToast';
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
  const [buildSheetOpen, setBuildSheetOpen] = useState(false);
  const [lastSale, setLastSale] = useState<number | null>(null);

  return (
    <div className="relative flex h-full flex-col">
      <TopBar player={player} />
      <PlotHeader plotName={plot.name} />
      <CenterStage buildings={plot.buildings} onSelect={setSelectedBuildingId} />
      <StatusStrip plot={plot} />
      <QuickActions onSold={setLastSale} onOpenBuild={() => setBuildSheetOpen(true)} />
      <BottomNav active={activeTab} onChange={setActiveTab} />
      <BuildingModal
        buildingId={selectedBuildingId}
        onClose={() => setSelectedBuildingId(null)}
      />
      <BuildSheet open={buildSheetOpen} onClose={() => setBuildSheetOpen(false)} />
      <SaleToast amount={lastSale} onDone={() => setLastSale(null)} />
      <LevelUpBanner />
    </div>
  );
}
