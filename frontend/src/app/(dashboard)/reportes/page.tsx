'use client';

import { useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { farmsApi } from '@/lib/api/farms';
import { animalsApi } from '@/lib/api/animals';
import { reportsApi } from '@/lib/api/reports';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import DashboardCharts from '@/components/reports/DashboardCharts';

export default function ReportesPage() {
  const { user, emulatedUser } = useAuth();
  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);
  const [selectedFarm, setSelectedFarm] = useState('');
  const activeFarmId = selectedFarm || farms[0]?.id || '';

  const fetchAnimals = useCallback(
    () => (activeFarmId ? animalsApi.getAll({ farmId: activeFarmId, status: 'ACTIVE' }) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: farmAnimals = [] } = useApi(fetchAnimals, [activeFarmId]);
  const [selectedAnimal, setSelectedAnimal] = useState('');

  const fetchDashboard = useCallback(
    () => (activeFarmId ? reportsApi.getDashboard(activeFarmId) : Promise.resolve(undefined)),
    [activeFarmId]
  );
  const { data: dashboard } = useApi(fetchDashboard, [activeFarmId]);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [alertsFormat, setAlertsFormat] = useState<'pdf' | 'xlsx'>('pdf');

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="los Reportes y Exportaciones de Campo" />;
  }

  const rangeQuery = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Reportes y Exportaciones</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Generá documentos listos para compartir a partir de la información cargada en el sistema.
        </p>
      </div>

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <div className="space-y-6">
          {dashboard && <DashboardCharts data={dashboard} />}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Establecimiento</label>
              <select
                value={activeFarmId}
                onChange={(e) => setSelectedFarm(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Desde (opcional)</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Hasta (opcional)</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReportCard
              title="Listado de Animales"
              description="Excel con el estado actual de todos los animales del establecimiento."
            >
              <a
                href={`/api/reports/farms/${activeFarmId}/animals`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Descargar Excel
              </a>
            </ReportCard>

            <ReportCard
              title="Lecturas Biométricas"
              description="Excel de las lecturas de collar (temperatura, ubicación) en el rango de fechas elegido."
            >
              <a
                href={`/api/reports/farms/${activeFarmId}/telemetry${rangeQuery()}`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Descargar Excel
              </a>
            </ReportCard>

            <ReportCard
              title="Escapes de Cerco Virtual"
              description="PDF con los eventos de escape registrados en el rango de fechas elegido."
            >
              <a
                href={`/api/reports/farms/${activeFarmId}/escapes${rangeQuery()}`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Descargar PDF
              </a>
            </ReportCard>

            <ReportCard
              title="Historial de Alertas"
              description="Historial completo con origen (Modelo IA, Umbral o Escape), nivel de certeza %, estado de falsos positivos y observaciones del operario en PDF o Excel."
            >
              <div className="flex items-center gap-3">
                <select
                  value={alertsFormat}
                  onChange={(e) => setAlertsFormat(e.target.value as 'pdf' | 'xlsx')}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel</option>
                </select>
                <a
                  href={`/api/reports/farms/${activeFarmId}/alerts${rangeQuery() ? `${rangeQuery()}&format=${alertsFormat}` : `?format=${alertsFormat}`}`}
                  className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
                >
                  Descargar
                </a>
              </div>
            </ReportCard>

            <ReportCard
              title="Resumen del Rodeo"
              description="PDF con totales: animales, collares asignados, zonas y cercos activos, alertas sin resolver."
            >
              <a
                href={`/api/reports/farms/${activeFarmId}/summary`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Descargar PDF
              </a>
            </ReportCard>

            <ReportCard
              title="Historial Médico de un Animal"
              description="PDF con vacunaciones, pesajes, partos y tratamientos."
            >
              <div className="flex items-center gap-3">
                <select
                  value={selectedAnimal}
                  onChange={(e) => setSelectedAnimal(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer flex-1"
                >
                  <option value="" disabled>
                    Elegir animal...
                  </option>
                  {farmAnimals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tag || `Animal (${a.id.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
                {selectedAnimal ? (
                  <a
                    href={`/api/reports/animals/${selectedAnimal}/medical-history`}
                    className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                  >
                    Descargar PDF
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400 italic whitespace-nowrap">Elegí un animal</span>
                )}
              </div>
            </ReportCard>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h3 className="font-bold text-base text-zinc-900 dark:text-white">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}
