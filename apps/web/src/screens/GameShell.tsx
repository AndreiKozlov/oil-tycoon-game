import { useEffect, useMemo, useState } from 'react';
import { BottomDock } from '../components/BottomDock';
import { BuildingModal } from '../components/BuildingModal';
import { BuildSheet } from '../components/BuildSheet';
import { CenterStage } from '../components/CenterStage';
import { HudOverlay } from '../components/HudOverlay';
import { LevelUpBanner } from '../components/LevelUpBanner';
import { MenuDrawer, type NavTabId } from '../components/MenuDrawer';
import { ResearchDoneToast } from '../components/ResearchDoneToast';
import { SaleToast } from '../components/SaleToast';
import { plotSellPrice, selectActivePlot, useGameStore } from '../store/gameStore';
import { useGameTick } from '../store/useGameTick';
import { getTelegramUserFirstName, haptic } from '../lib/telegram';
import { useTelegramMainButton } from '../lib/useTelegramMainButton';
import { formatMoney } from '../lib/format';
import { ResearchScreen } from './ResearchScreen';
import { WorldMapScreen } from './WorldMapScreen';

// Mobile-game-стиль: сцена занимает ВСЕ экран. UI поверх как floating overlay.
// Стандарт Last Day on Earth / Clash of Clans / Township:
//   - Сцена fullscreen.
//   - HUD-чипы в углах (~60px высота сверху, ~80px снизу — суммарно меньше 25% высоты).
//   - Меню = drawer по кнопке-гамбургеру.
//   - Подэкраны (Мир/Наука/Биржа) открываются как полноэкранные оверлеи поверх сцены.
//   - Никаких постоянных боковых панелей.
export function GameShell() {
  useGameTick();
  const player = useGameStore((s) => s.player);
  const plot = useGameStore(selectActivePlot);
  const oilPrice = useGameStore((s) => s.market.oilPrice);
  const sellOil = useGameStore((s) => s.sellOil);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const pendingLevelUp = useGameStore((s) => s.pendingLevelUp);
  const pendingResearchDone = useGameStore((s) => s.pendingResearchDone);

  const [activeTab, setActiveTab] = useState<NavTabId>('build');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [buildSheetOpen, setBuildSheetOpen] = useState(false);
  const [lastSale, setLastSale] = useState<number | null>(null);

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

  const handleSell = () => {
    const revenue = sellOil();
    if (revenue > 0) {
      setLastSale(revenue);
      haptic('success');
    }
  };

  const tankValue = Math.round(plot.tankFill * plotSellPrice(plot, oilPrice));
  const mainBtnText = plot.tankFill > 0 ? `Продать ${formatMoney(tankValue)}` : '';
  const mainBtnVisible = activeTab === 'build' && plot.tankFill > 0;
  const mainBtnOpts = useMemo(
    () => ({
      text: mainBtnText,
      visible: mainBtnVisible,
      onClick: handleSell,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mainBtnText, mainBtnVisible],
  );
  useTelegramMainButton(mainBtnOpts);

  // На вкладке Build — сцена видна полностью, HUD и BottomDock поверх.
  // На остальных табах (Мир/Наука/...) — экран занят содержимым таба, но
  // HUD всё равно показываем сверху (имя/деньги остаются на виду).
  const isBuild = activeTab === 'build';

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Сцена — на всю площадь, под всем UI */}
      {isBuild && (
        <div className="absolute inset-0">
          <CenterStage buildings={plot.buildings} onSelect={setSelectedBuildingId} />
        </div>
      )}

      {/* Полноэкранные экраны вкладок (поверх сцены) */}
      {activeTab === 'world' && (
        <div className="absolute inset-0 bg-slate-950">
          <WorldMapScreen />
        </div>
      )}
      {activeTab === 'research' && (
        <div className="absolute inset-0 bg-slate-950">
          <ResearchScreen />
        </div>
      )}
      {(activeTab === 'market' || activeTab === 'leaderboard') && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 px-8 text-center text-slate-500">
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-300">
              {activeTab === 'market' && 'Биржа'}
              {activeTab === 'leaderboard' && 'Рейтинг'}
            </p>
            <p className="text-xs">Скоро. Появятся на этапе G.4+.</p>
          </div>
        </div>
      )}

      {/* Floating HUD сверху — виден всегда */}
      <HudOverlay player={player} onOpenMenu={() => setMenuOpen(true)} />

      {/* BottomDock только на вкладке Build (на остальных табах своя навигация) */}
      {isBuild && (
        <BottomDock
          onSell={handleSell}
          onOpenBuild={() => setBuildSheetOpen(true)}
          onOpenWorld={() => setActiveTab('world')}
        />
      )}

      {/* Drawer-меню (закрыт по умолчанию, открывается по гамбургеру) */}
      <MenuDrawer
        open={menuOpen}
        active={activeTab}
        onChange={setActiveTab}
        onClose={() => setMenuOpen(false)}
      />

      {/* Глобальные оверлеи: модалки и тосты */}
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
