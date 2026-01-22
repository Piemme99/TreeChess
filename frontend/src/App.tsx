import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard/Dashboard';
import { RepertoireEdit } from './components/Repertoire/RepertoireEdit';
import { ImportList } from './components/PGN/ImportList';
import { ImportDetail } from './components/PGN/ImportDetail';
import { GameAnalysisPage } from './components/PGN/GameAnalysisPage';
import { ToastContainer } from './components/UI';

function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>Page not found</p>
      <a href="/">Go to Dashboard</a>
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/repertoire/:color/edit" element={<RepertoireEdit />} />
        <Route path="/imports" element={<ImportList />} />
        <Route path="/import/:id" element={<ImportDetail />} />
        <Route path="/import/:id/game/:gameIndex" element={<GameAnalysisPage />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
