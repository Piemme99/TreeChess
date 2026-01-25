import { useState } from 'react';
import { AnalyseTab } from '../../../features/analyse-tab';
import { RepertoireTab } from '../../../features/repertoire/RepertoireTab';

type TabId = 'analyse' | 'repertoire';

export function MainLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('analyse');

  return (
    <div className="main-layout">
      <header className="main-header">
        <h1 className="main-logo">♔ TreeChess</h1>
        <nav className="main-tabs">
          <button
            className={`main-tab ${activeTab === 'analyse' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyse')}
          >
            Analyse
          </button>
          <button
            className={`main-tab ${activeTab === 'repertoire' ? 'active' : ''}`}
            onClick={() => setActiveTab('repertoire')}
          >
            Repertoire
          </button>
        </nav>
        <div className="header-spacer" />
      </header>

      <main className="main-content">
        {activeTab === 'analyse' ? <AnalyseTab /> : <RepertoireTab />}
      </main>
    </div>
  );
}
