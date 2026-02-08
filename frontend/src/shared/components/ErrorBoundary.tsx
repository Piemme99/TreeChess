import { Component, type ReactNode } from 'react';
import { Button } from './UI/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-bg p-4">
          <div className="bg-bg-card rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 p-8 w-full max-w-[400px] text-center">
            <h1 className="text-2xl font-bold font-display mb-2">Something went wrong</h1>
            <p className="text-text-muted mb-6">An unexpected error occurred. Please reload the page.</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
