import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './shared/components/Layout/MainLayout';
import { GameAnalysisPage } from './features/game-analysis';
import { RepertoireEdit } from './features/repertoire/RepertoireEdit';
import { ToastContainer } from './shared/components/UI';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<MainLayout />} />
        <Route path="/analyse/:id/game/:gameIndex" element={<GameAnalysisPage />} />
        <Route path="/repertoire/:id/edit" element={<RepertoireEdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
