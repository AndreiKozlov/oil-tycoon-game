import { useEffect, useMemo, useState } from 'react';
import { BottomNav, type NavTabId } from '../components/BottomNav';
import { BuildingModal } from '../components/BuildingModal';
import { BuildSheet } from '../components/BuildSheet';
import { CenterStage } from '../components/CenterStage';
import { LevelUpBanner } from '../components/LevelUpBanner';
import { PlotHeader } from '../components/PlotHeader';
import { QuickActions } from '../components/QuickActions';
import { ResearchDoneToast } from '../components/ResearchDoneToast';
import { SaleToast } from '../components/SaleToast';
import { StatusStrip } from '../components/StatusStrip';
import { TopBar } from '../components/TopBar';
import { useGameStore } from '../store/gameStore';
import { useGameTick } from '../store/useGameTick';
import { formatMoney } from '../lib/format';
import { getTelegramUserFirstName, haptic } from '../lib/telegram';
import { useTelegramMainButton } from '../lib/useTelegramMainButton';
import { ResearchScreen } from './ResearchScreen';

// Оболочка вокруг главного экрана. TopBar + BottomNav остаются всегда,
// центральная зона меняется по табу.
export function GameShell() {
  useGameTick();
  const player = useGameStore((s) => s.player);
  const plot = useGameStore((s) => s.plot);
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const sellOil = useGameStore((s) => s.sellOil);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const pendingLevelUp = useGameStore((s) => s.pendingLevelUp);
  const pendingResearchDone = useGameStore((s) => s.pendingResearchDone);

  const [activeTab, setActiveTab] = useState<NavTabId>('build');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [buildSheetOpen, setBuildSheetOpen] = useState(false);
  const [lastSale, setLastSale] = useState<number | null>(null);

  // Подхватить имя из Telegram один раз при монтировании.
  useEffect(() => {
    const tgName = getTelegramUserFirstName();
    if (tgName) setPlayerName(tgName);
  }, [setPlayerName]);

  useEffect(() => {
    if (pendingLevelUp !== null) haptic('success');
  }, [pendingLevelUp]);

  useEffect(() => {
    if (pendingResearchDone !== null) haptic('success');
  }, [pendingResearchDone]);

  // Telegram MainButton: видна только на вкладке Участок.
  const tankValue = Math.round(plot.tankFill * oilPrice);
  const mainBtnText = plot.tankFill > 0 ? `Продать ${formatMoney(tankValue)}` : '';
  const mainBtnVisible = activeTab === 'build' && plot.tankFill > 0;
  const mainBtnOpts = useMemo(
    () => ({
      text: mainBtnText,
      visible: mainBtnVisible,
      onClick: () => {
        const revenue = sellOil();
        if (revenue > 0) {
          setLastSale(revenue);
          haptic('success');
        }
      },
    }),
    [mainBtnText, mainBtnVisible, sellOil],
  );
  useTelegramMainButton(mainBtnOpts);

  return (
    <div className="relative flex h-full flex-col">
      <TopBar player={player} />

      {activeTab === 'build' && (
        <>
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
        </>
      )}

      {activeTab === 'research' && <ResearchScreen />}

      {(activeTab === 'world' || activeTab === 'market' || activeTab === 'leaderboard') && (
        <div className="flex flex-1 items-center justify-center px-8 text-center text-slate-500">
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-300">
              {activeTab === 'world' && 'Карта мира'}
              {activeTab === 'market' && 'Биржа'}
              {activeTab === 'leaderboard' && 'Рейтинг'}
            </p>
            <p className="text-xs">Скоро. Сейчас идёт работа над технологиями (вкладка «Наука»).</p>
          </div>
        </div>
      )}

      <BottomNav active={activeTab} onChange={setActiveTab} />
      <BuildingModal
        buildingId={selectedBuildingId}
        onClose={() => setSelectedBuildingId(null)}
      />
      <BuildSheet open={buildSheetOpen} onClose={() => setBuildSheetOpen(false)} />
      <SaleToast amount={lastSale} onDone={() => setLastSale(null)} />
      <LevelUpBanner />
      <ResearchDoneToast />
    </div>
  );
}
