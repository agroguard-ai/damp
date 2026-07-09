import Link from "next/link";

export default function Home() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Bienvenido, Productor
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1.5">
          Resumen de actividad y estado de dispositivos IoT de tus establecimientos.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Animals Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              <span>Total de Hacienda</span>
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              48
            </div>
          </div>
          <div className="mt-4 text-xs flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <span className="bg-green-100 dark:bg-green-950/50 px-2 py-0.5 rounded font-medium">+3 este mes</span>
            <span className="text-zinc-500">Animales activos</span>
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

      {/* Main Grid: Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        {/* Recent Events Log */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
            Actividad Reciente
          </h3>
          <div className="space-y-4">
            {/* Event 1 */}
            <div className="flex gap-4 items-start text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></span>
              <div className="flex-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Vaca Lola (Caravana #2402) cruzó límite geocerca
                </p>
                <p className="text-zinc-500 text-xs">Sector Norte &bull; Hace 10 min</p>
              </div>
            </div>

            {/* Event 2 */}
            <div className="flex gap-4 items-start text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
              <div className="flex-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Aberdeen Angus (Caravana #1105) temperatura baja
                </p>
                <p className="text-zinc-500 text-xs">Monitoreo Salud &bull; Hace 2h</p>
              </div>
            </div>

            {/* Event 3 */}
            <div className="flex gap-4 items-start text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></span>
              <div className="flex-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Collar IoT MAC 00:1B:44... vinculado con éxito
                </p>
                <p className="text-zinc-500 text-xs">Hacienda &bull; Hace 1 día</p>
              </div>
            </div>

            {/* Event 4 */}
            <div className="flex gap-4 items-start text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
              <div className="flex-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Establecimiento "Estancia Don Silvestre" registrado
                </p>
                <p className="text-zinc-500 text-xs">Campos &bull; Hace 2 días</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
