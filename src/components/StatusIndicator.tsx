import {
  AlertCircle,
  CheckCircle2,
  Clock,
  PackageCheck,
  PauseCircle,
  Search,
  Wrench,
  XCircle,
} from 'lucide-react';
import type {
  AppointmentStatus,
  MechanicStatus,
  PaymentStatus,
  QuoteStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../types/workshop';

export function PaymentStatusText({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'Pagado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Pagado
        </span>
      );
    case 'Abonado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Abonado
        </span>
      );
    case 'Pendiente':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          Pendiente
        </span>
      );
  }
}

export function WorkOrderStatusText({ status }: { status: WorkOrderStatus }) {
  switch (status) {
    case 'Recibido':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          Recibido
        </span>
      );
    case 'Diagnóstico':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
          <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Diagnóstico
        </span>
      );
    case 'En Reparación':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 whitespace-nowrap">
          <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          En Reparación
        </span>
      );
    case 'Esperando Repuesto':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 whitespace-nowrap">
          <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Esperando Repuesto
        </span>
      );
    case 'Listo':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Listo
        </span>
      );
    case 'Entregado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 whitespace-nowrap">
          <PackageCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          Entregado
        </span>
      );
    case 'Cancelado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          Cancelado
        </span>
      );
  }
}

export function PriorityText({ priority }: { priority: WorkOrderPriority }) {
  if (priority === 'Urgente') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        Urgente
      </span>
    );
  }
  return <span className="text-xs text-zinc-400 whitespace-nowrap">Normal</span>;
}

export function AppointmentStatusText({ status }: { status: AppointmentStatus }) {
  switch (status) {
    case 'Programada':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          Programada
        </span>
      );
    case 'Confirmada':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          Confirmada
        </span>
      );
    case 'En Taller':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
          <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          En Taller
        </span>
      );
    case 'Completada':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Completada
        </span>
      );
    case 'Cancelada':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          Cancelada
        </span>
      );
  }
}

export function MechanicStatusText({ status }: { status: MechanicStatus }) {
  switch (status) {
    case 'Disponible':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Disponible
        </span>
      );
    case 'En Servicio':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
          <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          En Servicio
        </span>
      );
    case 'Descanso':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 whitespace-nowrap">
          <PauseCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          Descanso
        </span>
      );
  }
}

export function QuoteStatusText({ status }: { status: QuoteStatus }) {
  switch (status) {
    case 'Borrador':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          Borrador
        </span>
      );
    case 'Enviado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          Enviado
        </span>
      );
    case 'Aprobado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Aprobado
        </span>
      );
    case 'Rechazado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          Rechazado
        </span>
      );
    case 'Convertido':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
          <PackageCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          Convertido a OT
        </span>
      );
  }
}
