"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

interface Farm {
  id: string;
  name: string;
  address: string;
  province: string;
  totalAreaHa: number;
  createdAt: string;
}

export default function Home() {
  const { getToken } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFarms() {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:3001/farms", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Error fetching farms");
        const data = await res.json();
        setFarms(data);
      } catch (err) {
        console.error("Error loading farms:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFarms();
  }, []);

  // Compute total hectares
  const totalHectares = farms.reduce((acc, farm) => acc + (farm.totalAreaHa || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Bienvenido, Productor
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1.5">
            Resumen de actividad y estado de dispositivos IoT de tus establecimientos.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/farms/new"
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-semibold shadow-sm cursor-pointer"
          >
            + Registrar Campo
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Farms Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              <span>Campos Activos</span>
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2.5M15 21v-1.5a2.5 2.5 0 00-2.5-2.5h-.5A2 2 0 0110 15z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              {loading ? "..." : farms.length}
            </div>
          </div>
          <div className="mt-4 text-xs flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <span className="bg-green-100 dark:bg-green-950/50 px-2 py-0.5 rounded font-medium">
              {loading ? "..." : `${totalHectares} Ha`}
            </span>
            <span className="text-zinc-500">Superficie administrada</span>
          </div>
        </div>

        {/* Active Alerts Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              <span>Alertas Activas</span>
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              2
            </div>
          </div>
          <div className="mt-4 text-xs flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <span className="bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded font-medium">Urgente</span>
            <span className="text-zinc-500">Fuera de geocerca</span>
          </div>
        </div>

        {/* Offline Devices Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              <span>Collares Offline</span>
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              1
            </div>
          </div>
          <div className="mt-4 text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded font-medium">Revisar</span>
            <span className="text-zinc-500">Sin señal &gt; 24h</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tus Campos (Dynamic list) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
            Tus Campos Registrados
          </h3>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
            </div>
          ) : farms.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">No tienes campos registrados aún en tu cuenta.</p>
              <Link
                href="/farms/new"
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-sm transition-all"
              >
                Registrar Primer Campo
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {farms.map((farm) => (
                <div
                  key={farm.id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50/50 dark:bg-zinc-950/50 hover:shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white text-base">
                      {farm.name}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      {farm.address}, {farm.province}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-850 flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Superficie</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {farm.totalAreaHa} Ha
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4 lg:col-span-1">
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
            Acciones Rápidas
          </h3>
          <div className="flex flex-col gap-3">
            <Link
              href="/farms/new"
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-medium text-sm text-zinc-900 dark:text-zinc-100"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Registrar Campo</span>
              </div>
              <span className="text-xs text-zinc-400">&rarr;</span>
            </Link>

            <Link
              href="/animals/new"
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-medium text-sm text-zinc-900 dark:text-zinc-100"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Registrar Nuevo Animal</span>
              </div>
              <span className="text-xs text-zinc-400">&rarr;</span>
            </Link>

            <Link
              href="/animals"
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-medium text-sm text-zinc-900 dark:text-zinc-100"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Ver Panel de Monitoreo</span>
              </div>
              <span className="text-xs text-zinc-400">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
