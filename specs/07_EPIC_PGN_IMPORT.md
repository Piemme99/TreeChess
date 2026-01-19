# Epic 7: PGN Import Workflow

**Objective:** Implement PGN file import, game analysis, and repertoire enrichment workflow

**Status:** Not Started  
**Dependencies:** Epic 6 (Repertoire CRUD), Epic 3 (Chess Logic)

---

## 1. Objective

Implement the complete PGN import workflow:
- Upload PGN files
- Parse games from PGN
- Analyze each game against the repertoire
- Display analysis results
- Allow adding missing moves to repertoire
- Allow ignoring lines
- Track import history

---

## 2. Definition of Done

- [ ] File upload works (drag & drop + file picker)
- [ ] PGN parsing extracts games correctly
- [ ] Each game is analyzed against repertoire
- [ ] Results show: in-repertoire, out-of-repertoire, new lines
- [ ] Clicking "Add" navigates to correct repertoire position
- [ ] Clicking "Ignore" marks the line as ignored
- [ ] Import history is saved
- [ ] Same file can be re-analyzed

---

## 3. Tasks

### 3.1 Import Page

**File: `src/components/Import/ImportList.tsx`**

```typescript
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../UI/Button';
import { api } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import './ImportList.css';

interface ImportFile {
  id: string;
  filename: string;
  uploadedAt: string;
  gameCount: number;
  analyzed: boolean;
}

export function ImportList() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load import history from localStorage (for MVP)
  const loadHistory = useCallback(() => {
    const saved = localStorage.getItem('importHistory');
    if (saved) {
      try {
        setFiles(JSON.parse(saved));
      } catch {
        // Ignore invalid data
      }
    }
  }, []);

  useState(() => {
    loadHistory();
  }, [loadHistory]);

  const saveHistory = (newFiles: ImportFile[]) => {
    localStorage.setItem('importHistory', JSON.stringify(newFiles));
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.pgn')) {
      addToast('Please upload a .pgn file', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const result = await api.uploadPGN(file);
      
      const newFile: ImportFile = {
        id: result.id,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        gameCount: result.gameCount,
        analyzed: false,
      };

      const updatedFiles = [newFile, ...files];
      setFiles(updatedFiles);
      saveHistory(updatedFiles);

      addToast(`Imported ${result.gameCount} games`, 'success');
      navigate(`/import/${result.id}`);
    } catch (err) {
      addToast('Failed to import file', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDelete = (fileId: string) => {
    const updated = files.filter((f) => f.id !== fileId);
    setFiles(updated);
    saveHistory(updated);
    addToast('Import deleted', 'success');
  };

  const handleAnalyze = (fileId: string) => {
    navigate(`/import/${fileId}`);
  };

  return (
    <div className="import-list">
      <div className="import-list__header">
        <h1>Imports</h1>
        <label className="upload-btn" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pgn"
            onChange={handleInputChange}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
          {isUploading ? 'Uploading...' : '📁 Import PGN'}
        </label>
      </div>

      {isDragOver && (
        <div className="import-list__drop-zone">
          Drop your .pgn file here
        </div>
      )}

      {files.length === 0 ? (
        <div className="import-list__empty">
          <p>No imports yet</p>
          <p className="text-muted">Upload a PGN file to analyze your games</p>
        </div>
      ) : (
        <div className="import-list__items">
          {files.map((file) => (
            <div key={file.id} className="import-item">
              <div className="import-item__info">
                <span className="import-item__icon">📄</span>
                <div>
                  <h3>{file.filename}</h3>
                  <p className="text-muted">
                    {new Date(file.uploadedAt).toLocaleDateString()} • {file.gameCount} games
                  </p>
                </div>
              </div>
              <div className="import-item__actions">
                <Button variant="secondary" size="sm" onClick={() => handleAnalyze(file.id)}>
                  {file.analyzed ? 'View' : 'Analyze'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(file.id)}>
                  🗑
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.2 Import Detail/Analysis Page

**File: `src/components/Import/ImportDetail.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../UI/Button';
import { Loading } from '../UI/Loading';
import { api, GameAnalysis, MoveAnalysis } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import './ImportDetail.css';

interface ImportDetail {
  id: string;
  filename: string;
  uploadedAt: string;
  gameCount: number;
}

export function ImportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [analysis, setAnalysis] = useState<GameAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load import detail
  useEffect(() => {
    // For MVP, get from localStorage
    const saved = localStorage.getItem('importHistory');
    if (saved && id) {
      try {
        const files = JSON.parse(saved);
        const file = files.find((f: ImportFile) => f.id === id);
        if (file) {
          setDetail({
            id: file.id,
            filename: file.filename,
            uploadedAt: file.uploadedAt,
            gameCount: file.gameCount,
          });
        }
      } catch {
        // Ignore
      }
    }
  }, [id]);

  // Analyze games when component mounts
  const analyzeGames = useCallback(async () => {
    if (!id) return;

    setIsAnalyzing(true);
    try {
      const results = await api.analyzeGames(id);
      setAnalysis(results);

      // Update localStorage
      const saved = localStorage.getItem('importHistory');
      if (saved) {
        const files = JSON.parse(saved);
        const updated = files.map((f: ImportFile) =>
          f.id === id ? { ...f, analyzed: true } : f
        );
        localStorage.setItem('importHistory', JSON.stringify(updated));
      }

      addToast(`Analyzed ${results.length} games`, 'success');
    } catch (err) {
      addToast('Failed to analyze games', 'error');
    } finally {
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    if (detail && analysis.length === 0) {
      analyzeGames();
    }
  }, [detail, analysis.length, analyzeGames]);

  // Navigate to add node in repertoire
  const handleAddNode = (move: MoveAnalysis, color: 'white' | 'black') => {
    // Store navigation context
    sessionStorage.setItem('analysisNavigate', JSON.stringify({
      color,
      parentFEN: move.fen,
      moveSAN: move.san,
    }));
    
    navigate(`/repertoire/${color}/edit`);
  };

  // Mark as ignored
  const handleIgnore = (moveId: string) => {
    // For MVP, just show toast
    addToast('Line marked as ignored', 'success');
  };

  // Group moves by status for display
  const inRepertoire = analysis.flatMap((g) =>
    g.moves.filter((m) => m.status === 'in-repertoire')
  );
  const errors = analysis.flatMap((g) =>
    g.moves.filter((m) => m.status === 'out-of-repertoire')
  );
  const newLines = analysis.flatMap((g) =>
    g.moves.filter((m) => m.status === 'opponent-new')
  );

  if (isLoading || !detail) {
    return <Loading text="Loading analysis..." />;
  }

  return (
    <div className="import-detail">
      <div className="import-detail__header">
        <Button variant="ghost" onClick={() => navigate('/imports')}>
          ← Back to Imports
        </Button>
        <div className="import-detail__title">
          <h1>{detail.filename}</h1>
          <p className="text-muted">{detail.gameCount} games</p>
        </div>
        {isAnalyzing && <Loading size="sm" text="Analyzing..." />}
      </div>

      {isAnalyzing ? (
        <div className="import-detail__analyzing">
          <p>Analyzing your games against your repertoire...</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="import-detail__summary">
            <div className="summary-card summary-card--success">
              <span className="summary-card__count">{inRepertoire.length}</span>
              <span className="summary-card__label">In Repertoire</span>
            </div>
            <div className="summary-card summary-card--error">
              <span className="summary-card__count">{errors.length}</span>
              <span className="summary-card__label">Errors</span>
            </div>
            <div className="summary-card summary-card--info">
              <span className="summary-card__count">{newLines.length}</span>
              <span className="summary-card__label">New Lines</span>
            </div>
          </div>

          {/* Errors Section */}
          {errors.length > 0 && (
            <section className="import-detail__section">
              <h2>✗ Moves Out of Repertoire</h2>
              {errors.map((move, idx) => (
                <div key={`${move.fen}-${idx}`} className="analysis-card analysis-card--error">
                  <div className="analysis-card__header">
                    <span className="analysis-card__status">Error</span>
                  </div>
                  <div className="analysis-card__content">
                    <p className="analysis-card__moves">
                      {getMoveContext(move, 3)}
                    </p>
                    <div className="analysis-card__actions">
                      <Button
                        size="sm"
                        onClick={() => handleAddNode(move, 'white')}
                      >
                        Add White Move
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleIgnore(`${move.fen}-${idx}`)}
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* New Lines Section */}
          {newLines.length > 0 && (
            <section className="import-detail__section">
              <h2>◇ New Lines Detected</h2>
              {newLines.map((move, idx) => (
                <div key={`${move.fen}-${idx}`} className="analysis-card analysis-card--info">
                  <div className="analysis-card__header">
                    <span className="analysis-card__status">New Line</span>
                  </div>
                  <div className="analysis-card__content">
                    <p className="analysis-card__moves">
                      {getMoveContext(move, 3)}
                    </p>
                    <div className="analysis-card__actions">
                      <Button
                        size="sm"
                        onClick={() => handleAddNode(move, move.isUserMove ? 'white' : 'black')}
                      >
                        Add Response
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleIgnore(`${move.fen}-${idx}`)}
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* In Repertoire Section (collapsed by default) */}
          {inRepertoire.length > 0 && (
            <section className="import-detail__section">
              <h2>✓ Moves in Repertoire ({inRepertoire.length} total)</h2>
              <details>
                <summary>Show all moves</summary>
                <div className="analysis-list">
                  {inRepertoire.slice(0, 10).map((move, idx) => (
                    <div key={`${move.fen}-${idx}`} className="analysis-item analysis-item--success">
                      {getMoveContext(move, 2)}
                    </div>
                  ))}
                  {inRepertoire.length > 10 && (
                    <p className="text-muted">
                      ...and {inRepertoire.length - 10} more moves
                    </p>
                  )}
                </div>
              </details>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// Helper to get move context (previous moves + current move)
function getMoveContext(move: MoveAnalysis, contextMoves: number = 3): string {
  // For MVP, just show the SAN move
  // In a full implementation, would show the full move sequence
  return move.san;
}

interface ImportFile {
  id: string;
  filename: string;
  uploadedAt: string;
  gameCount: number;
  analyzed: boolean;
}
```

### 3.3 CSS for Import Pages

**File: `src/components/Import/ImportList.css`**

```css
.import-list {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.import-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
}

.import-list__header h1 {
  margin: 0;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s;
}

.upload-btn:hover {
  background: var(--color-primary-hover);
}

.upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-list__drop-zone {
  position: fixed;
  inset: 0;
  background: rgba(74, 144, 217, 0.1);
  border: 3px dashed var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--color-primary);
  z-index: 100;
}

.import-list__empty {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}

.import-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.import-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.import-item__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.import-item__icon {
  font-size: 24px;
}

.import-item__info h3 {
  margin: 0;
  font-size: 16px;
}

.import-item__actions {
  display: flex;
  gap: var(--spacing-sm);
}
```

**File: `src/components/Import/ImportDetail.css`**

```css
.import-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.import-detail__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.import-detail__title {
  flex: 1;
}

.import-detail__title h1 {
  margin: 0;
}

.import-detail__analyzing {
  text-align: center;
  padding: var(--spacing-xl);
}

.import-detail__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.summary-card {
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.summary-card--success {
  border-left: 4px solid var(--color-success);
}

.summary-card--error {
  border-left: 4px solid var(--color-danger);
}

.summary-card--info {
  border-left: 4px solid var(--color-primary);
}

.summary-card__count {
  display: block;
  font-size: 32px;
  font-weight: bold;
}

.summary-card__label {
  color: var(--color-text-muted);
  font-size: 14px;
}

.import-detail__section {
  margin-bottom: var(--spacing-xl);
}

.import-detail__section h2 {
  font-size: 18px;
  margin-bottom: var(--spacing-md);
}

.analysis-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
}

.analysis-card--error {
  border-left: 4px solid var(--color-danger);
}

.analysis-card--info {
  border-left: 4px solid var(--color-primary);
}

.analysis-card__header {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.analysis-card__status {
  font-weight: 500;
  font-size: 14px;
}

.analysis-card--error .analysis-card__status {
  color: var(--color-danger);
}

.analysis-card--info .analysis-card__status {
  color: var(--color-primary);
}

.analysis-card__content {
  padding: var(--spacing-md);
}

.analysis-card__moves {
  font-family: monospace;
  margin-bottom: var(--spacing-md);
}

.analysis-card__actions {
  display: flex;
  gap: var(--spacing-sm);
}

.analysis-item {
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: monospace;
  font-size: 14px;
}

.analysis-item--success {
  color: var(--color-success);
}
```

---

## 4. Analysis Logic

### 4.1 Move Classification

For each move in a game:

1. **In Repertoire**: Move exists as a child of the current node
2. **Out of Repertoire**: Move doesn't exist and it's the user's move
3. **New Line**: Move doesn't exist and it's the opponent's move

### 4.2 Color Handling

- User's moves (White when analyzing White repertoire) → classification A or B
- Opponent's moves → classification C (new line) or existing branch

### 4.3 Context Display

For each classified move, display:
- Previous moves in the sequence (context)
- The move itself
- Classification status
- Action buttons (Add / Ignore)

---

## 5. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/pgn/import | Upload PGN file |
| POST | /api/pgn/:id/analyze | Analyze games |
| GET | /api/pgn/:id | Get import details |
| DELETE | /api/pgn/:id | Delete import |

---

## 6. Dependencies to Other Epics

- Repertoire CRUD (Epic 6) for navigation to edit page
- Chess Logic (Epic 3) for move validation
- Backend API (Epic 2) for import endpoints

---

## 7. Notes

### 7.1 Import History

For MVP, import history is stored in localStorage. In V2, this would be in the database.

### 7.2 Re-analysis

Users can re-analyze the same file to refresh results after making changes to their repertoire.

### 7.3 Batch Actions

For MVP, no batch actions. Each line must be added or ignored individually.
