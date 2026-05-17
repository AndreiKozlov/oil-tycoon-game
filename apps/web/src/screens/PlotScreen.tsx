import { useEffect, useMemo, useState } from 'react';
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
import { formatMoney } from '../lib/format';
import { getTelegramUserFirstName, haptic } from '../lib/telegram';
import { useTelegramMainButton } from '../lib/useTelegramMainButton';

export function PlotScreen() {
  useGameTick();
  const player = useGameStore((s) => s.player);
  const plot = useGameStore((s) => s.plot);
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const sellOil = useGameStore((s) => s.sellOil);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const pendingLevelUp = useGameStore((s) => s.pendingLevelUp);

  const [activeTab, setActiveTab] = useState<
    'build' | 'world' | 'market' | 'leaderboard' | 'settings'
  >('build');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [buildSheetOpen, setBuildSheetOpen] = useState(false);
  const [lastSale, setLastSale] = useState<number | null>(null);

  // Подхватить имя из Telegram один раз при монтировании.
  useEffect(() => {
    const tgName = getTelegramUserFirstName();
    if (tgName) setPlayerName(tgName);
  }, [setPlayerName]);

  // Хаптик при level up — приятно для игрока в Telegram.
  useEffect(() => {
    if (pendingLevelUp !== null) haptic('success');
  }, [pendingLevelUp]);

  // Telegram MainButton: «Продать $X» когда есть нефть, скрыта когда нет.
  const tankValue = Math.round(plot.tankFill * oilPrice);
  const mainBtnText = plot.tankFill > 0 ? `Продать ${formatMoney(tankValue)}` : '';
  const mainBtnOpts = useMemo(
    () => ({
      text: mainBtnText,
      visible: plot.tankFill > 0,
      onClick: () => {
        const revenue = sellOil();
        if (revenue > 0) {
          setLastSale(revenue);
          haptic('success');
        }
      },
    }),
    [mainBtnText, plot.tankFill, sellOil],
  );
  useTelegramMainButton(mainBtnOpts);

  return (
    <div className="relative flex h-full flex-col">
      <TopBar player={player} />
      <PlotHeader plotName={plot.name} />
      <CenterStage buildings={plot.buildings} onSelect={setSelectedBuildingId} />
      <StatusStrip plot={plot} />
      <QuickActions
        onSold={(rev) => {
          setLastSale(rev);
          haptic('success');
        }}
        onOpenBuild={() => setBuildSheetOpen(true)}
      />
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
