import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { ImportDetail } from './features/analyse-import';
import { GameAnalysisPage } from './features/game-analysis';
import { RepertoireEdit } from './components/Repertoire/RepertoireEdit';
import { ToastContainer } from './components/UI';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<MainLayout />} />
        <Route path="/analyse/:id" element={<ImportDetail />} />
        <Route path="/analyse/:id/game/:gameIndex" element={<GameAnalysisPage />} />
        <Route path="/repertoire/:color/edit" element={<RepertoireEdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
