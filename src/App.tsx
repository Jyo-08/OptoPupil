import { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { VisionPage } from './pages/VisionPage';

export function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'vision'>('landing');

  return (
    <div className="flex min-h-screen flex-col bg-[#070a11] text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-300">
      <Header
        currentView={currentView}
        onNavigateLanding={() => setCurrentView('landing')}
        onNavigateVision={() => setCurrentView('vision')}
      />

      <main className="flex-1">
        {currentView === 'landing' ? (
          <LandingPage onStart={() => setCurrentView('vision')} />
        ) : (
          <VisionPage onBack={() => setCurrentView('landing')} />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
