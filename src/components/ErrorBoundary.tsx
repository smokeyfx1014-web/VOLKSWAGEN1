import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/shadcn';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dealership Application Boundary Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          displayMessage = `Database request failed (${parsed.operationType} on ${parsed.path}): ${parsed.error}`;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
          <div className="max-w-lg w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-xl font-semibold text-[#091224]">
                Something went wrong
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-[#475569]">{displayMessage}</p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload Application</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
