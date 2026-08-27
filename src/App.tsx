import { useState, useEffect } from 'react';
import { useAppStore } from './state/appStore';
import { Dashboard } from './components/Dashboard';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { Inspector } from './components/Inspector';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { CommandPalette } from './components/CommandPalette';
import { SchematicCanvas } from './editor/SchematicCanvas';

export default function App() {
  const { screen } = useAppStore();
  const { leftSidebarOpen } = useAppStore();
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Global command palette shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') setShowCommandPalette(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (screen === 'dashboard') {
    return (
      <>
        <Dashboard />
        {showCommandPalette && <CommandPalette onClose={() => setShowCommandPalette(false)} />}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {leftSidebarOpen && <LeftSidebar />}
        <Toolbar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SchematicCanvas />
          <BottomPanel />
        </div>
        <Inspector />
      </div>
      <StatusBar />
      {showCommandPalette && <CommandPalette onClose={() => setShowCommandPalette(false)} />}
    </div>
  );
}
