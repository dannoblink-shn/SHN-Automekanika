/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  Calendar,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { AppointmentsView } from './components/AppointmentsView';
import { AuthScreen } from './components/AuthScreen';
import { BrandLogo } from './components/BrandLogo';
import { CustomersVehiclesView } from './components/CustomersVehiclesView';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { MechanicPayoutsView } from './components/MechanicPayoutsView';
import { MechanicsView } from './components/MechanicsView';
import { NewWorkOrderModal } from './components/NewWorkOrderModal';
import { QuotesView } from './components/QuotesView';
import { SettingsView } from './components/SettingsView';
import { WorkOrdersView } from './components/WorkOrdersView';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { fetchLiveBcvRate, formatBcvDate, isBcvRateFromToday } from './services/bcvService';
import {
  ensureShopExists,
  seedDemoWorkshopData,
  updateShopBcvRate,
} from './services/workshopService';
import {
  formatVES,
  type Appointment,
  type Customer,
  type Mechanic,
  type NavSection,
  type Part,
  type Quote,
  type Shop,
  type Vehicle,
  type WorkOrder,
  type WorkOrderStatus,
} from './types/workshop';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'orders', label: 'Órdenes de trabajo', icon: ClipboardList },
  { id: 'quotes', label: 'Presupuestos', icon: FileText },
  { id: 'appointments', label: 'Agenda y citas', icon: Calendar },
  { id: 'customers', label: 'Clientes y vehículos', icon: Users },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'mechanics', label: 'Mecánicos y bahías', icon: Wrench },
  { id: 'payouts', label: 'Pagos a mecánicos', icon: Wallet },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [ordersFilter, setOrdersFilter] = useState<WorkOrderStatus | 'Todas'>('Todas');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [syncingBcv, setSyncingBcv] = useState(false);
  const [bcvError, setBcvError] = useState<string | null>(null);
  const bcvAutoSyncedForUidRef = useRef<string | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setShop(null);
        setCustomers([]);
        setVehicles([]);
        setMechanics([]);
        setParts([]);
        setWorkOrders([]);
        setQuotes([]);
        setAppointments([]);
        setDataLoading(false);
        bcvAutoSyncedForUidRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  const syncBcvForUid = useCallback(async (uid: string) => {
    setSyncingBcv(true);
    setBcvError(null);
    try {
      const result = await fetchLiveBcvRate();
      await updateShopBcvRate(uid, result.rate, result.updatedAt, result.source);
    } catch (err) {
      setBcvError(
        err instanceof Error ? err.message : 'No se pudo consultar la tasa del BCV.'
      );
    } finally {
      setSyncingBcv(false);
    }
  }, []);

  const handleSyncBcv = useCallback(async () => {
    if (!user) return;
    await syncBcvForUid(user.uid);
  }, [user, syncBcvForUid]);

  // Bootstrap shop and attach Firestore real-time listeners
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];
    setDataLoading(true);

    void ensureShopExists(user.uid).then((ensuredShop) => {
      if (cancelled) return;
      setShop(ensuredShop);

      const uid = user.uid;

      // Auto-sync live BCV rate once per session if missing or stale
      if (
        bcvAutoSyncedForUidRef.current !== uid &&
        (!ensuredShop.bcvRate || !isBcvRateFromToday(ensuredShop.bcvUpdatedAt))
      ) {
        bcvAutoSyncedForUidRef.current = uid;
        void syncBcvForUid(uid);
      }

      // Shop doc listener
      unsubs.push(
        onSnapshot(
          doc(db, 'shops', uid),
          (snap) => {
            if (snap.exists()) {
              setShop({ id: snap.id, ...(snap.data() as Omit<Shop, 'id'>) });
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `shops/${uid}`)
        )
      );

      // Customers
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'customers'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setCustomers(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/customers`)
        )
      );

      // Vehicles
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'vehicles'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, 'id'>) }))
              .sort((a, b) => a.plate.localeCompare(b.plate));
            setVehicles(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/vehicles`)
        )
      );

      // Mechanics
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'mechanics'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Mechanic, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setMechanics(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/mechanics`)
        )
      );

      // Parts
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'parts'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Part, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setParts(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/parts`)
        )
      );

      // Work Orders
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'workOrders'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<WorkOrder, 'id'>) }))
              .sort((a, b) => b.orderNumber.localeCompare(a.orderNumber));
            setWorkOrders(list);
            setDataLoading(false);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/workOrders`)
        )
      );

      // Quotes
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'quotes'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Quote, 'id'>) }))
              .sort((a, b) => b.quoteNumber.localeCompare(a.quoteNumber));
            setQuotes(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/quotes`)
        )
      );

      // Appointments
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops', uid, 'appointments'), where('ownerId', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Appointment, 'id'>),
            }));
            setAppointments(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `shops/${uid}/appointments`)
        )
      );
    });

    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [authReady, user, syncBcvForUid]);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleNavigate = (section: NavSection, filterStatus?: WorkOrderStatus) => {
    setActiveNav(section);
    if (section === 'orders') {
      setOrdersFilter(filterStatus ?? 'Todas');
    }
    setMobileMenuOpen(false);
  };

  const handleSelectOrderFromElsewhere = (order: WorkOrder) => {
    setSelectedOrder(order);
    setOrdersFilter('Todas');
    setActiveNav('orders');
  };

  const handleSeedDemo = async () => {
    if (!user || !shop) return;
    setSeeding(true);
    try {
      await seedDemoWorkshopData(user.uid, shop.taxRate);
    } finally {
      setSeeding(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B0D11] flex items-center justify-center">
        <div className="text-sm text-zinc-400">Cargando espacio de trabajo...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignIn={handleSignIn} loading={authLoading} error={authError} />;
  }

  const shopName = shop?.name || 'AutoMekanika SHN';
  const currentSectionLabel = NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Resumen';

  return (
    <div className="min-h-screen bg-[#0B0D11] text-zinc-100 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (252px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[252px] bg-[#12151C] border-r border-zinc-800 flex flex-col transition-transform duration-150 lg:static lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* German Flag Precision Top Strip */}
        <div className="h-[3px] flex w-full shrink-0" aria-hidden="true">
          <div className="flex-1 bg-zinc-950" />
          <div className="flex-1 bg-red-600" />
          <div className="flex-1 bg-amber-400" />
        </div>

        <div className="h-16 px-4 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
          <BrandLogo name={shopName} compact showSubtext />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 lg:hidden shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/70'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-zinc-500'}`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-zinc-800 space-y-3 shrink-0">
          {/* Live Venezuela BCV Rate Widget */}
          <div className="p-3 rounded-lg bg-[#0B0D11] border border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-zinc-400">Tasa BCV Oficial</span>
              <button
                type="button"
                onClick={() => void handleSyncBcv()}
                disabled={syncingBcv}
                title="Actualizar tasa BCV al día"
                aria-label="Actualizar tasa BCV al día"
                className="p-1 text-zinc-400 hover:text-amber-400 rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingBcv ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
            <p className="mt-1 font-mono text-sm font-semibold text-amber-400 tabular-nums">
              {shop?.bcvRate ? `1 USD = ${formatVES(shop.bcvRate)}` : 'Sin sincronizar'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {shop?.bcvUpdatedAt
                ? `Act.: ${formatBcvDate(shop.bcvUpdatedAt)}`
                : 'Venezuela · BCV'}
            </p>
          </div>

          <div className="min-w-0 px-0.5">
            <p className="text-xs font-semibold text-zinc-200 truncate">
              {user.displayName || 'Administrador'}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-zinc-100 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-16 bg-[#12151C] border-b border-zinc-800 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegación"
              className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-zinc-400 hidden sm:inline whitespace-nowrap">
                {shopName}
              </span>
              <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-zinc-100 truncate">
                {currentSectionLabel}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewOrderModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva orden
          </button>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {dataLoading || !shop ? (
            <div className="space-y-4">
              <div className="h-24 bg-[#141821] border border-zinc-800 rounded-xl animate-pulse" />
              <div className="h-64 bg-[#141821] border border-zinc-800 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeNav === 'dashboard' && (
                <DashboardView
                  shop={shop}
                  workOrders={workOrders}
                  appointments={appointments}
                  parts={parts}
                  customersCount={customers.length}
                  onNavigate={handleNavigate}
                  onSelectOrder={handleSelectOrderFromElsewhere}
                  onSeedDemo={handleSeedDemo}
                  seeding={seeding}
                  onSyncBcv={handleSyncBcv}
                  syncingBcv={syncingBcv}
                />
              )}

              {activeNav === 'orders' && (
                <WorkOrdersView
                  uid={user.uid}
                  shop={shop}
                  orders={workOrders}
                  customers={customers}
                  vehicles={vehicles}
                  mechanics={mechanics}
                  parts={parts}
                  initialFilter={ordersFilter}
                  selectedOrder={selectedOrder}
                  onSelectOrder={setSelectedOrder}
                  onOpenNewOrder={() => setShowNewOrderModal(true)}
                />
              )}

              {activeNav === 'quotes' && (
                <QuotesView
                  uid={user.uid}
                  shop={shop}
                  quotes={quotes}
                  customers={customers}
                  vehicles={vehicles}
                  parts={parts}
                  existingOrders={workOrders}
                  onOrderConverted={() => {
                    setOrdersFilter('Todas');
                    setActiveNav('orders');
                  }}
                />
              )}

              {activeNav === 'appointments' && (
                <AppointmentsView
                  uid={user.uid}
                  appointments={appointments}
                  customers={customers}
                  vehicles={vehicles}
                  existingOrders={workOrders}
                  onOrderCreatedFromAppointment={(orderId) => {
                    setActiveNav('orders');
                    const found = workOrders.find((o) => o.id === orderId);
                    if (found) setSelectedOrder(found);
                  }}
                />
              )}

              {activeNav === 'customers' && (
                <CustomersVehiclesView
                  uid={user.uid}
                  shop={shop}
                  customers={customers}
                  vehicles={vehicles}
                  workOrders={workOrders}
                  quotes={quotes}
                  onSelectOrder={handleSelectOrderFromElsewhere}
                />
              )}

              {activeNav === 'inventory' && (
                <InventoryView uid={user.uid} shop={shop} parts={parts} />
              )}

              {activeNav === 'mechanics' && (
                <MechanicsView
                  uid={user.uid}
                  mechanics={mechanics}
                  workOrders={workOrders}
                  defaultCommissionRate={shop.mechanicCommissionRate ?? 35}
                />
              )}

              {activeNav === 'payouts' && (
                <MechanicPayoutsView
                  uid={user.uid}
                  shop={shop}
                  mechanics={mechanics}
                  workOrders={workOrders}
                  onSelectOrder={handleSelectOrderFromElsewhere}
                />
              )}

              {activeNav === 'settings' && (
                <SettingsView
                  uid={user.uid}
                  shop={shop}
                  onSyncBcv={handleSyncBcv}
                  syncingBcv={syncingBcv}
                  bcvError={bcvError}
                />
              )}
            </>
          )}
        </main>
      </div>

      {showNewOrderModal && user && (
        <NewWorkOrderModal
          uid={user.uid}
          customers={customers}
          vehicles={vehicles}
          mechanics={mechanics}
          existingOrders={workOrders}
          onClose={() => setShowNewOrderModal(false)}
          onCreated={() => {
            setActiveNav('orders');
            setOrdersFilter('Todas');
          }}
        />
      )}
    </div>
  );
}
