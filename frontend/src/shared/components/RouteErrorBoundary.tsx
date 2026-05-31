import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './UI/Button';
import {
  generateErrorReference,
  isChunkLoadError,
  reportBoundaryError,
} from '../utils/errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  reference: string | null;
}

const initialState: State = { hasError: false, isChunkError: false, reference: null };

/**
 * Route-level error boundary. Sits inside `MainLayout` around the routed
 * `<Outlet/>` so a render error in one page degrades to a single broken pane
 * while the sidebar/navigation stay usable.
 *
 * It also detects failures to load a code-split chunk (common after a redeploy
 * invalidates the hashed chunk a stale page is still pointing at) and offers a
 * hard reload to recover.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = initialState;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
      reference: generateErrorReference(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportBoundaryError(error, errorInfo, this.state.reference ?? generateErrorReference());
  }

  private handleReset = () => {
    this.setState(initialState);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.isChunkError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="bg-bg-card rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 p-8 w-full max-w-[400px] text-center">
            <h2 className="text-xl font-bold font-display mb-2">A new version is available</h2>
            <p className="text-text-muted mb-6">
              This page couldn&apos;t finish loading, likely because the app was updated. Reload to
              get the latest version.
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="bg-bg-card rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 p-8 w-full max-w-[400px] text-center">
          <h2 className="text-xl font-bold font-display mb-2">This page ran into a problem</h2>
          <p className="text-text-muted mb-6">
            Something went wrong while loading this page. You can try again or navigate elsewhere
            using the menu.
          </p>
          <Button variant="primary" onClick={this.handleReset}>
            Try again
          </Button>
          {this.state.reference && (
            <p className="text-xs text-text-muted mt-4">Error reference: {this.state.reference}</p>
          )}
        </div>
      </div>
    );
  }
}
