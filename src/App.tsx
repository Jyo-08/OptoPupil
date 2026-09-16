import { useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { VisionPage } from './pages/VisionPage';

export function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'vision'>('landing');

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-900 selection:bg-sky-500/20 selection:text-sky-900">
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
