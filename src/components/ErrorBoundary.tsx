import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  detail: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
    detail: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let message = 'Ocurrió un error inesperado al procesar los datos.';
    let detail = error.message;

    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        if (parsed.error.includes('Quota exceeded')) {
          message =
            'Se alcanzó el límite diario gratuito de consultas en la base de datos. Se restablecerá mañana.';
        } else if (parsed.error.includes('permission') || parsed.error.includes('PERMISSION_DENIED')) {
          message = 'No tienes permisos suficientes para realizar esta operación.';
        } else {
          message = 'Error de sincronización con la base de datos.';
        }
        detail = `${parsed.operationType ?? 'op'} · ${parsed.path ?? ''}`;
      }
    } catch {
      // Non-JSON error message
    }

    return { hasError: true, message, detail };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '', detail: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0D11] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#141821] border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-semibold text-zinc-100">Algo salió mal</h2>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed mb-2">{this.state.message}</p>
            {this.state.detail && (
              <p className="text-xs font-mono text-zinc-400 bg-[#0B0D11] border border-zinc-800 rounded-lg px-3 py-2 mb-5 break-all">
                {this.state.detail}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
