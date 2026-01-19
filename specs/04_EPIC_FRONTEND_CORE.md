# Epic 4: Frontend Core

**Objective:** Build React application structure, routing, state management, and base UI components

**Status:** Not Started  
**Dependencies:** Epic 3 (Chess Logic) for validation utilities

---

## 1. Objective

Create the React frontend foundation:
- Project setup with Vite and TypeScript
- Routing with React Router
- State management with Zustand
- API client for backend communication
- Base UI components (Button, Modal, Toast)
- Theming and styling approach

---

## 2. Definition of Done

- [ ] React app runs at http://localhost:5173
- [ ] Routing works (Dashboard, Repertoires, Imports, Edit pages)
- [ ] Zustand store manages application state
- [ ] API client can fetch/save repertoires
- [ ] Base UI components are available
- [ ] Toast notifications work
- [ ] Loading states are handled
- [ ] Error handling displays appropriate messages
- [ ] TypeScript strict mode passes without errors

---

## 3. Tasks

### 3.1 Entry Points

**File: `src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

**File: `src/App.tsx`**

```typescript
import { Routes, Route } from 'react-router-dom'
import { ToastContainer } from './components/UI/Toast'
import { useToastStore } from './stores/toastStore'

function App() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/repertoires" element={<RepertoireList />} />
        <Route path="/repertoire/:color/edit" element={<RepertoireEdit />} />
        <Route path="/imports" element={<ImportList />} />
        <Route path="/import/:id" element={<ImportDetail />} />
      </Routes>
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

export default App
```

### 3.2 API Client

**File: `src/services/api.ts`**

```typescript
import axios, { AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[API Error]', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  // Repertoire endpoints
  async getRepertoire(color: 'white' | 'black'): Promise<Repertoire> {
    const response = await this.client.get(`/api/repertoire/${color}`);
    return response.data;
  }

  async addNode(
    color: 'white' | 'black',
    node: AddNodeRequest
  ): Promise<Repertoire> {
    const response = await this.client.post(
      `/api/repertoire/${color}/node`,
      node
    );
    return response.data;
  }

  async deleteNode(
    color: 'white' | 'black',
    nodeId: string
  ): Promise<Repertoire> {
    const response = await this.client.delete(
      `/api/repertoire/${color}/node/${nodeId}`
    );
    return response.data;
  }

  // PGN endpoints
  async uploadPGN(file: File): Promise<{ id: string; gameCount: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post('/api/pgn/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async analyzeGames(fileId: string): Promise<GameAnalysis[]> {
    const response = await this.client.post(`/api/pgn/${fileId}/analyze`);
    return response.data;
  }
}

export const api = new ApiClient();

// Types
export interface Repertoire {
  id: string;
  color: 'white' | 'black';
  treeData: RepertoireNode;
  metadata: RepertoireMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  moveNumber: number;
  colorToMove: 'w' | 'b';
  parentId: string | null;
  children: RepertoireNode[];
}

export interface RepertoireMetadata {
  totalNodes: number;
  totalMoves: number;
  deepestDepth: number;
}

export interface AddNodeRequest {
  parentId: string;
  move: string;
  fen: string;
  moveNumber: number;
  colorToMove: 'w' | 'b';
}

export interface GameAnalysis {
  gameIndex: number;
  headers: PGNHeaders;
  moves: MoveAnalysis[];
}

export interface PGNHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  White?: string;
  Black?: string;
  Result?: string;
}

export interface MoveAnalysis {
  plyNumber: number;
  san: string;
  fen: string;
  status: 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';
  expectedMove?: string;
  isUserMove: boolean;
}
```

### 3.3 Zustand Stores

**File: `src/stores/repertoireStore.ts`**

```typescript
import { create } from 'zustand';
import { api, Repertoire, RepertoireNode } from '../services/api';

interface RepertoireState {
  whiteRepertoire: Repertoire | null;
  blackRepertoire: Repertoire | null;
  selectedColor: 'white' | 'black';
  selectedNode: RepertoireNode | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadRepertoire: (color: 'white' | 'black') => Promise<void>;
  setSelectedColor: (color: 'white' | 'black') => void;
  setSelectedNode: (node: RepertoireNode | null) => void;
  addNode: (parentId: string, move: string, fen: string, moveNumber: number) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  clearError: () => void;
}

export const useRepertoireStore = create<RepertoireState>((set, get) => ({
  whiteRepertoire: null,
  blackRepertoire: null,
  selectedColor: 'white',
  selectedNode: null,
  isLoading: false,
  error: null,

  loadRepertoire: async (color) => {
    set({ isLoading: true, error: null });
    try {
      const repertoire = await api.getRepertoire(color);
      set({
        [color === 'white' ? 'whiteRepertoire' : 'blackRepertoire']: repertoire,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: `Failed to load ${color} repertoire`,
        isLoading: false,
      });
      throw err;
    }
  },

  setSelectedColor: (color) => {
    set({ selectedColor: color });
    // Load repertoire if not loaded
    const current = color === 'white' ? get().whiteRepertoire : get().blackRepertoire;
    if (!current) {
      get().loadRepertoire(color);
    }
  },

  setSelectedNode: (node) => {
    set({ selectedNode: node });
  },

  addNode: async (parentId, move, fen, moveNumber) => {
    const { selectedColor, selectedNode } = get();
    set({ isLoading: true, error: null });
    
    try {
      const colorToMove = selectedNode?.colorToMove === 'w' ? 'b' : 'w';
      const updated = await api.addNode(selectedColor, {
        parentId,
        move,
        fen,
        moveNumber,
        colorToMove,
      });

      if (selectedColor === 'white') {
        set({ whiteRepertoire: updated, isLoading: false });
      } else {
        set({ blackRepertoire: updated, isLoading: false });
      }
    } catch (err) {
      set({
        error: 'Failed to add move',
        isLoading: false,
      });
      throw err;
    }
  },

  deleteNode: async (nodeId) => {
    const { selectedColor } = get();
    set({ isLoading: true, error: null });
    
    try {
      const updated = await api.deleteNode(selectedColor, nodeId);
      
      if (selectedColor === 'white') {
        set({ whiteRepertoire: updated, isLoading: false, selectedNode: null });
      } else {
        set({ blackRepertoire: updated, isLoading: false, selectedNode: null });
      }
    } catch (err) {
      set({
        error: 'Failed to delete node',
        isLoading: false,
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
```

**File: `src/stores/toastStore.ts`**

```typescript
import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
```

### 3.4 Base UI Components

**File: `src/components/UI/Button.tsx`**

```typescript
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = `btn--${variant}`;
  const sizeClass = `btn--${size}`;
  const loadingClass = isLoading ? 'btn--loading' : '';
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="btn__spinner" />}
      {children}
    </button>
  );
}
```

**File: `src/components/UI/Modal.tsx`**

```typescript
import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <button className="modal__close" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <div className="modal__content">{children}</div>
      </div>
    </div>
  );
}
```

**File: `src/components/UI/Toast.tsx`**

```typescript
import React from 'react';

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span className="toast__message">{toast.message}</span>
          <button
            className="toast__close"
            onClick={() => onClose(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

**File: `src/components/UI/Loading.tsx`**

```typescript
import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function Loading({ size = 'md', text }: LoadingProps) {
  return (
    <div className={`loading loading--${size}`}>
      <div className="loading__spinner" />
      {text && <span className="loading__text">{text}</span>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="loading loading--lg" />
    </div>
  );
}
```

### 3.5 Page Components

**File: `src/components/Dashboard/Dashboard.tsx`**

```typescript
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useRepertoireStore } from '../../stores/repertoireStore';

export function Dashboard() {
  const { whiteRepertoire, blackRepertoire, setSelectedColor, loadRepertoire } = useRepertoireStore();

  const handleEdit = async (color: 'white' | 'black') => {
    setSelectedColor(color);
    await loadRepertoire(color);
  };

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">TreeChess</h1>
      
      <section className="dashboard__section">
        <h2>Your Repertoires</h2>
        <div className="repertoire-cards">
          <div className="repertoire-card">
            <div className="repertoire-card__icon">♔</div>
            <h3>White</h3>
            <Button onClick={() => handleEdit('white')}>Edit</Button>
          </div>
          <div className="repertoire-card">
            <div className="repertoire-card__icon">♚</div>
            <h3>Black</h3>
            <Button onClick={() => handleEdit('black')}>Edit</Button>
          </div>
        </div>
      </section>

      <section className="dashboard__section">
        <div className="dashboard__header">
          <h2>Recent Imports</h2>
          <Link to="/imports">View all</Link>
        </div>
        {/* Import list will be added in Epic 7 */}
        <p className="text-muted">No imports yet</p>
      </section>

      <section className="dashboard__section">
        <Link to="/imports">
          <Button variant="primary">📁 Import PGN</Button>
        </Link>
      </section>
    </div>
  );
}
```

**File: `src/components/Repertoire/RepertoireList.tsx`**

```typescript
import { Link } from 'react-router-dom';

export function RepertoireList() {
  return (
    <div className="repertoire-list">
      <h1>Repertoires</h1>
      
      <div className="repertoire-cards">
        <Link to="/repertoire/white/edit" className="repertoire-card">
          <div className="repertoire-card__icon">♔</div>
          <h3>White</h3>
          <p>Edit your White repertoire</p>
        </Link>
        
        <Link to="/repertoire/black/edit" className="repertoire-card">
          <div className="repertoire-card__icon">♚</div>
          <h3>Black</h3>
          <p>Edit your Black repertoire</p>
        </Link>
      </div>
    </div>
  );
}
```

**File: `src/components/Import/ImportList.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../UI/Button';
import { api } from '../../services/api';

export function ImportList() {
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await api.uploadPGN(file);
      navigate(`/import/${result.id}`);
    } catch (error) {
      console.error('Upload failed:', error);
      // TODO: Show error toast
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="import-list">
      <div className="import-list__header">
        <h1>Imports</h1>
        <label className="upload-btn">
          <input
            type="file"
            accept=".pgn"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          {isUploading ? 'Uploading...' : '📁 Import PGN'}
        </label>
      </div>

      <p className="text-muted">No imports yet. Upload a PGN file to get started.</p>
    </div>
  );
}
```

### 3.6 CSS Styling

**File: `src/index.css`**

```css
:root {
  --color-primary: #4a90d9;
  --color-primary-hover: #3a7bc8;
  --color-danger: #e74c3c;
  --color-success: #27ae60;
  --color-warning: #f39c12;
  --color-text: #333;
  --color-text-muted: #666;
  --color-bg: #f5f5f5;
  --color-bg-card: #fff;
  --color-border: #ddd;
  
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background-color: var(--color-bg);
  color: var(--color-text);
  line-height: 1.5;
}

a {
  color: var(--color-primary);
  text-decoration: none;
}

button {
  cursor: pointer;
  font-family: inherit;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background-color: var(--color-primary);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn--secondary {
  background-color: transparent;
  border: 1px solid var(--color-border);
}

.btn--danger {
  background-color: var(--color-danger);
  color: white;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  max-height: 90vh;
  overflow: auto;
}

.modal--sm { width: 400px; }
.modal--md { width: 600px; }
.modal--lg { width: 800px; }

.modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.modal__close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-text-muted);
}

.modal__content {
  padding: var(--spacing-md);
}

/* Toast */
.toast-container {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  z-index: 2000;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.toast--success { border-left: 4px solid var(--color-success); }
.toast--error { border-left: 4px solid var(--color-danger); }
.toast--warning { border-left: 4px solid var(--color-warning); }

/* Loading */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.loading__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.page-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

/* Dashboard */
.dashboard {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.dashboard__title {
  font-size: 32px;
  margin-bottom: var(--spacing-xl);
}

.dashboard__section {
  margin-bottom: var(--spacing-xl);
}

.dashboard__section h2 {
  font-size: 20px;
  margin-bottom: var(--spacing-md);
}

.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.repertoire-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.repertoire-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.repertoire-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.repertoire-card__icon {
  font-size: 48px;
}

.text-muted {
  color: var(--color-text-muted);
}
```

---

## 4. Routing Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Home page with repertoire summary |
| `/repertoires` | RepertoireList | List of all repertoires |
| `/repertoire/:color/edit` | RepertoireEdit | Edit a specific repertoire |
| `/imports` | ImportList | List of imported PGN files |
| `/import/:id` | ImportDetail | View analysis of imported file |

---

## 5. Dependencies to Other Epics

- Chess Logic (Epic 3) provides validation utilities
- Board Component (Epic 4b) will be integrated into RepertoireEdit
- Tree Visual (Epic 5) will be integrated into RepertoireEdit
- PGN Import (Epic 7) uses the API client from this epic

---

## 6. Notes

### 6.1 CSS Approach

For MVP, using plain CSS with CSS variables for theming. Future options:
- CSS Modules for component isolation
- Tailwind CSS for utility classes

### 6.2 Toast Notifications

Toasts auto-dismiss after 5 seconds. User can also dismiss manually.

### 6.3 Loading States

Each async action sets `isLoading` state, which can be used to show loading spinners or disable buttons.
