import { create } from 'zustand';

interface AppState {
  screen: 'dashboard' | 'editor';
  setScreen: (screen: 'dashboard' | 'editor') => void;
  
  // Bottom panel state
  bottomPanelOpen: boolean;
  activeBottomTab: 'problems' | 'power' | 'mass' | 'bom' | 'netlist';
  setBottomPanelOpen: (open: boolean) => void;
  setActiveBottomTab: (tab: 'problems' | 'power' | 'mass' | 'bom' | 'netlist') => void;
  
  // Left Sidebar state
  leftSidebarOpen: boolean;
  activeLeftTab: 'project' | 'components' | 'templates';
  setLeftSidebarOpen: (open: boolean) => void;
  setActiveLeftTab: (tab: 'project' | 'components' | 'templates') => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'dashboard',
  setScreen: (screen) => set({ screen }),
  
  bottomPanelOpen: true,
  activeBottomTab: 'problems',
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab, bottomPanelOpen: true }),
  
  leftSidebarOpen: true,
  activeLeftTab: 'components',
  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
  setActiveLeftTab: (tab) => set({ activeLeftTab: tab, leftSidebarOpen: true }),
}));
