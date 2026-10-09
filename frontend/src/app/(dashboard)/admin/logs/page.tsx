'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { IotRequestLog, IotLogsSummary } from '@/types/iot-log';
import {
  Activity,
  Radio,
  Router,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  X,
  Copy,
  Check,
  Clock,
  MapPin,
  Thermometer,
  Wifi,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function AdminIotLogsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';

  const [logs, setLogs] = useState<IotRequestLog[]>([]);
  const [summary, setSummary] = useState<IotLogsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<IotRequestLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filtros
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [collarFilter, setCollarFilter] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('');
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (collarFilter.trim()) params.set('collarId', collarFilter.trim());
      if (gatewayFilter.trim()) params.set('gatewayId', gatewayFilter.trim());
      if (search.trim()) params.set('search', search.trim());

      const [logsRes, summaryRes] = await Promise.all([
        fetch(`/api/admin/iot-logs?${params.toString()}`),
        fetch('/api/admin/iot-logs/summary'),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotalLogs(data.meta?.total || 0);
      }

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
    } catch (err) {
      console.error('Error al cargar logs de tráfico IoT:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, collarFilter, gatewayFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs();
  }, [fetchLogs]);

  // Polling automático cada 5 segundos si autoRefresh está activo
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleClearLogs = async () => {
    try {
      setClearing(true);
      const res = await fetch('/api/admin/iot-logs', { method: 'DELETE' });
      if (res.ok) {
        setConfirmClearOpen(false);
        void fetchLogs();
      }
    } catch (err) {
      console.error('Error al limpiar logs:', err);
    } finally {
      setClearing(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Acceso Restringido</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Esta sección de auditoría técnica está reservada exclusivamente para el Administrador Global.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Monitor de Tráfico IoT & Logs de Dispositivos
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Registro en vivo de peticiones HTTP, gateways LoRa, collares, códigos de respuesta y telemetría
                entrante.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
            title={autoRefresh ? 'Pausar auto-actualización' : 'Activar auto-actualización cada 5s'}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            {autoRefresh ? 'En vivo (5s)' : 'Pausado'}
          </button>

          <button
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-200 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar Logs
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Peticiones</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-zinc-900 dark:text-white">
            {summary?.totalRequests.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Historial acumulado</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Exitosas (2xx)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
            {summary?.successRequests.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">200 OK / 204 Guardadas</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Rechazos Auth (401)</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-red-600 dark:text-red-400">
            {summary?.rejectedRequests.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">API Key inválida o ausente</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Otros Errores</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">
            {summary?.errorRequests.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">403, 404, 500</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Collares (24h)</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">
            {summary?.activeCollars24h.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">IDs únicos reportando</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Gateways (24h)</span>
            <Router className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-indigo-600 dark:text-indigo-400">
            {summary?.activeGateways24h.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Gateways con tráfico</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-44 flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar IP, error, granja..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium">Collar ID:</span>
            <input
              type="number"
              placeholder="Ej: 3"
              value={collarFilter}
              onChange={(e) => {
                setCollarFilter(e.target.value);
                setPage(1);
              }}
              className="w-20 px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium">Gateway:</span>
            <input
              type="text"
              placeholder="Ej: GW-01"
              value={gatewayFilter}
              onChange={(e) => {
                setGatewayFilter(e.target.value);
                setPage(1);
              }}
              className="w-24 px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="SUCCESS">Éxito (200 / 204)</option>
              <option value="REJECTED_AUTH">Rechazo Auth (401)</option>
              <option value="NOT_FOUND">No Encontrado (404)</option>
              <option value="FORBIDDEN">Granja Inválida (403)</option>
              <option value="ERROR">Todos los Errores (4xx / 5xx)</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-zinc-400 shrink-0 self-center">
          Mostrando {logs.length} de {totalLogs} registros
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
              <tr>
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Dispositivo (Collar)</th>
                <th className="py-3 px-4">Gateway & Granja</th>
                <th className="py-3 px-4">Telemetría Recibida</th>
                <th className="py-3 px-4">Resultado HTTP</th>
                <th className="py-3 px-4 text-center">Latencia</th>
                <th className="py-3 px-4 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No hay registros de tráfico IoT que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateObj = new Date(log.createdAt);
                  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                  const isAuthError = log.statusCode === 401;
                  const isNotFound = log.statusCode === 404;
                  const isForbidden = log.statusCode === 403;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Fecha / Hora */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-zinc-900 dark:text-white">
                          {dateObj.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {dateObj.toLocaleDateString('es-AR')}
                        </div>
                      </td>

                      {/* Collar */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.collarId !== null ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold font-mono text-[11px]">
                            <Radio className="w-3 h-3 text-blue-500" />
                            Collar #{log.collarId}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Sin ID de collar</span>
                        )}
                      </td>

                      {/* Gateway & Granja */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
                          <Router className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="truncate max-w-40">{log.gatewayName || log.gatewayId || 'Desconocido'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate max-w-44 mt-0.5">
                          {log.farmName ? `Granja: ${log.farmName}` : log.ipAddress ? `IP: ${log.ipAddress}` : '—'}
                        </div>
                      </td>

                      {/* Telemetría Recibida */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.lat !== null && log.lng !== null ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                              {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                              {log.temp !== null && (
                                <span className="flex items-center gap-0.5">
                                  <Thermometer className="w-2.5 h-2.5 text-amber-500" />
                                  {log.temp.toFixed(1)}°C
                                </span>
                              )}
                              {log.rssi !== null && (
                                <span className="flex items-center gap-0.5">
                                  <Wifi className="w-2.5 h-2.5 text-blue-400" />
                                  {log.rssi} dBm
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">
                            {log.errorMessage ? 'Petición rechazada' : 'Sin coordenadas'}
                          </span>
                        )}
                      </td>

                      {/* Resultado HTTP */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                            isSuccess
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : isAuthError
                                ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                                : isNotFound
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : isForbidden
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                                    : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <span className="font-mono">{log.statusCode}</span>
                          <span>
                            {log.statusCode === 204
                              ? 'OK (Guardado)'
                              : log.statusCode === 200
                                ? log.downlinkSent && log.downlinkSent !== 'NONE'
                                  ? 'OK (Cerco transmitido)'
                                  : 'OK (Cerco sincronizado)'
                                : isAuthError
                                  ? 'API Key Inválida'
                                  : isNotFound
                                    ? 'Collar No Existe'
                                    : isForbidden
                                      ? 'Granja Incorrecta'
                                      : 'Error'}
                          </span>
                        </span>
                      </td>

                      {/* Latencia */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {log.durationMs !== null ? `${log.durationMs} ms` : '—'}
                      </td>

                      {/* Botón Detalle */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          title="Ver detalle completo de la petición"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              Página {page} de {totalPages}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Inspector de Petición IoT */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-6">
            {/* Header del modal */}
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    selectedLog.statusCode >= 200 && selectedLog.statusCode < 300
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    Detalle de Petición IoT
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md font-mono ${
                        selectedLog.statusCode >= 200 && selectedLog.statusCode < 300
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/20 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {selectedLog.statusCode} {selectedLog.status}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {selectedLog.method} {selectedLog.endpoint} • ID: {selectedLog.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metadatos en Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Collar</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-1 block">
                  {selectedLog.collarId !== null ? `ID #${selectedLog.collarId}` : 'No especificado'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Gateway</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-1 block truncate">
                  {selectedLog.gatewayName || selectedLog.gatewayId || 'No autenticado'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Granja</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-1 block truncate">
                  {selectedLog.farmName || selectedLog.farmId || '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">IP & Latencia</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-1 block truncate font-mono">
                  {selectedLog.ipAddress || '—'} ({selectedLog.durationMs ?? 0} ms)
                </span>
              </div>
            </div>

            {/* API Key Utilizada */}
            {selectedLog.apiKeyUsed && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">
                    X-API-Key Usada en Header (Enmascarada)
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold mt-0.5 block">
                    {selectedLog.apiKeyUsed}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(selectedLog.apiKeyUsed!, 'apikey')}
                  className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Copiar clave"
                >
                  {copiedKey === 'apikey' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {/* Error si existió */}
            {selectedLog.errorMessage && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Causa del Rechazo / Error:
                </div>
                <div className="font-mono">{selectedLog.errorMessage}</div>
              </div>
            )}

            {/* Downlink transmitido si existió */}
            {selectedLog.downlinkSent && selectedLog.downlinkSent !== 'NONE' && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Downlink transmitido al collar (Actualización de Cerco Virtual):
                </div>
                <div className="font-mono break-all bg-emerald-950/20 p-2 rounded-lg">{selectedLog.downlinkSent}</div>
              </div>
            )}

            {selectedLog.downlinkSent === 'NONE' && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                <span>Sin cambios de cerco pendientes (Downlink NONE: optimización LoRa y batería).</span>
                <span className="font-mono text-[11px] bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-semibold">
                  NONE
                </span>
              </div>
            )}

            {/* Payload JSON recibido */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Payload Recibido (Cuerpo del Request)
                </span>
                <button
                  onClick={() => handleCopy(JSON.stringify(selectedLog.payload, null, 2), 'payload')}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  {copiedKey === 'payload' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copiedKey === 'payload' ? 'Copiado' : 'Copiar JSON'}
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto max-h-48 border border-zinc-800">
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {/* Respuesta HTTP enviada */}
            {selectedLog.responseBody && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Respuesta Devuelta al Dispositivo
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedLog.responseBody, null, 2), 'response')}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'response' ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedKey === 'response' ? 'Copiado' : 'Copiar JSON'}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto max-h-40 border border-zinc-800">
                  {JSON.stringify(selectedLog.responseBody, null, 2)}
                </pre>
              </div>
            )}

            {/* Headers HTTP recibidos */}
            {selectedLog.headers && Object.keys(selectedLog.headers).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Headers HTTP Relevantes
                </span>
                <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-400 font-mono text-xs overflow-x-auto max-h-32 border border-zinc-800">
                  {JSON.stringify(selectedLog.headers, null, 2)}
                </pre>
              </div>
            )}

            {/* Botón Cerrar */}
            <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Cerrar Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para limpiar logs */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">¿Limpiar historial de logs?</h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Esta acción eliminará todas las peticiones registradas de collares y gateways de la base de datos. Es una
              acción irreversible ideal para limpiar pruebas.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleClearLogs()}
                disabled={clearing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {clearing ? 'Limpiando...' : 'Sí, vaciar tabla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
