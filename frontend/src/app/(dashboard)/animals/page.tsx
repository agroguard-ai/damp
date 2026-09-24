'use client';

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { SkeletonRowList } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { animalTypesApi } from '@/lib/api/animal-types';
import { zonesApi } from '@/lib/api/zones';
import { collarsApi } from '@/lib/api/collars';
import { geofencesApi } from '@/lib/api/geofences';
import { medicalEventsApi } from '@/lib/api/medical-events';
import { animalsApi, type Animal } from '@/lib/api/animals';
import type { MedicalEventType } from '@/types';
import {
  CirclePlus,
  Search,
  Filter,
  Layers,
  Radio,
  Zap,
  Lock,
  HeartPulse,
  ArrowRightLeft,
  X,
  AlertTriangle,
  Tag,
  CheckCircle2,
} from 'lucide-react';

function AnimalsContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const urlZoneId = searchParams.get('zoneId') || '';
  const urlFarmId = searchParams.get('farmId') || '';

  const { user, emulatedUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);
  const { data: animalTypes = [] } = useApi(animalTypesApi.getAll);

  const [selectedFarm, setSelectedFarm] = useState<string>(urlFarmId || '');

  // Keep selectedFarm aligned if urlFarmId changes or default to first farm
  useEffect(() => {
    if (urlFarmId) {
      setSelectedFarm(urlFarmId);
    } else if (!selectedFarm && farms.length > 0) {
      setSelectedFarm(farms[0].id);
    }
  }, [farms, urlFarmId, selectedFarm]);

  const activeFarmId = selectedFarm || farms[0]?.id || '';
  const activeFarm = farms.find((f) => f.id === activeFarmId);

  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: farmZones = [] } = useApi(fetchZones, [activeFarmId]);

  const fetchGeofences = useCallback(async () => {
    if (farmZones.length === 0) return [];
    const results = await Promise.all(farmZones.map((z) => geofencesApi.getByZone(z.id)));
    return results.flat();
  }, [farmZones]);
  const { data: farmGeofences = [], refetch: refetchGeofences } = useApi(fetchGeofences, [farmZones]);

  const { data: collars = [], refetch: refetchCollars } = useApi(collarsApi.getAll);
  const availableCollars = collars.filter((c) => c.status === 'AVAILABLE' && !c.assignedAnimal);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [filters, setFilters] = useState({
    animalType: '',
    healthStatus: '',
    zoneId: urlZoneId || '',
    status: 'ACTIVE',
    hasActiveAlert: false,
  });

  // Align filters if url params arrive
  useEffect(() => {
    if (urlSearch) setSearchTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (urlZoneId) setFilters((prev) => ({ ...prev, zoneId: urlZoneId }));
  }, [urlZoneId]);

  const fetchAnimals = useCallback(
    () =>
      activeFarmId
        ? animalsApi.getAll({
            farmId: activeFarmId,
            ...(filters.animalType && { animalType: filters.animalType }),
            ...(filters.healthStatus && { healthStatus: filters.healthStatus }),
            ...(filters.zoneId && { zoneId: filters.zoneId }),
            ...(filters.hasActiveAlert && { hasActiveAlert: 'true' }),
            status: filters.status,
          })
        : Promise.resolve([]),
    [activeFarmId, filters]
  );
  const { data: animals = [], loading, refetch: refetchAnimals } = useApi(fetchAnimals, [activeFarmId, filters]);

  // Client-side dual search (caravana / tag OR collar identifier / ID)
  const filteredAnimals = useMemo(() => {
    if (!searchTerm.trim()) return animals;
    const term = searchTerm.trim().toLowerCase();
    return animals.filter((animal) => {
      const tagMatch = animal.tag?.toLowerCase().includes(term);
      const collar = animal.animalCollars[0]?.collar;
      const collarIdMatch = collar?.id.toString().includes(term);
      const collarIdentMatch = collar?.identifier?.toLowerCase().includes(term);
      const breedMatch = animal.breed?.toLowerCase().includes(term);
      return tagMatch || collarIdMatch || collarIdentMatch || breedMatch;
    });
  }, [animals, searchTerm]);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Clear selections when farm changes
  useEffect(() => {
    setSelectedIds([]);
  }, [activeFarmId]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAnimals.length && filteredAnimals.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAnimals.map((a) => a.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkZoneModalOpen, setIsBulkZoneModalOpen] = useState(false);
  const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
  const [singleZoneAnimal, setSingleZoneAnimal] = useState<Animal | null>(null);
  const [singleCollarAnimal, setSingleCollarAnimal] = useState<Animal | null>(null);
  const [singleGeofenceAnimal, setSingleGeofenceAnimal] = useState<Animal | null>(null);
  const [medicalHistoryAnimalId, setMedicalHistoryAnimalId] = useState<string | null>(null);

  // Form states for modals
  const [targetZoneId, setTargetZoneId] = useState<string>('');
  const [targetFarmId, setTargetFarmId] = useState<string>('');
  const [targetCollarId, setTargetCollarId] = useState<string>('');
  const [targetGeofenceId, setTargetGeofenceId] = useState<string>('');

  const [addAnimalForm, setAddAnimalForm] = useState({
    tag: '',
    breed: '',
    weightKg: '',
    ageMonths: '12',
    collarId: '',
    animalTypeId: '',
    zoneId: '',
  });

  // Mutations
  const { mutate: archiveAnimal } = useMutation(animalsApi.archive);
  const {
    mutate: createAnimal,
    loading: modalLoading,
    error: modalError,
    reset: resetModal,
  } = useMutation(animalsApi.create);
  const { mutate: bulkAssignZone, loading: bulkAssigning } = useMutation(animalsApi.bulkAssignZone);
  const { mutate: bulkTransferFarm, loading: bulkTransferring } = useMutation(animalsApi.bulkTransferFarm);
  const { mutate: updateAnimalZone, loading: updatingZone } = useMutation(animalsApi.updateZone);
  const { mutate: updateAnimalCollar, loading: updatingCollar } = useMutation(animalsApi.updateCollar);
  const { mutate: updateAnimalGeofence, loading: updatingGeofence } = useMutation(animalsApi.updateGeofence);

  // Medical events
  const {
    data: medicalEvents = [],
    loading: fetchingMedicalEvents,
    refetch: refetchMedicalEvents,
  } = useApi(
    () => (medicalHistoryAnimalId ? medicalEventsApi.getByAnimal(medicalHistoryAnimalId) : Promise.resolve([])),
    [medicalHistoryAnimalId]
  );
  const { mutate: createMedicalEvent, loading: creatingMedicalEvent } = useMutation(medicalEventsApi.create);
  const [medicalForm, setMedicalForm] = useState({
    type: 'VACCINATION' as MedicalEventType,
    description: '',
    value: '',
  });

  const handleAddMedicalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicalHistoryAnimalId) return;
    try {
      await createMedicalEvent({
        animalId: medicalHistoryAnimalId,
        type: medicalForm.type,
        description: medicalForm.description || undefined,
        value: medicalForm.value ? Number(medicalForm.value) : undefined,
      });
      setMedicalForm({ type: 'VACCINATION', description: '', value: '' });
      toast.success('Registro médico agregado con éxito');
      refetchMedicalEvents();
      refetchAnimals();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar evento médico');
    }
  };

  const handleArchive = async (animalId: string, reason: string) => {
    if (!reason) return;
    const ok = await confirm({
      title: `Archivar animal como ${reason === 'SOLD' ? 'Vendido' : 'Muerto'}`,
      description:
        'Se desvinculará de inmediato su collar activo (quedando disponible para otra cabeza) y saldrá de cualquier cerco o potrero. El historial médico se conservará.',
      confirmLabel: 'Archivar y Liberar Recursos',
      danger: true,
    });
    if (!ok) return;
    try {
      await archiveAnimal(animalId, { status: reason as 'SOLD' | 'DEAD' });
      toast.success('Animal archivado y recursos liberados');
      refetchAnimals();
      refetchCollars();
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al archivar animal');
    }
  };

  const handleAddAnimalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) return;
    try {
      await createAnimal({
        farmId: activeFarmId,
        tag: addAnimalForm.tag,
        breed: addAnimalForm.breed,
        weightKg: Number(addAnimalForm.weightKg),
        ageMonths: Number(addAnimalForm.ageMonths),
        collarId: addAnimalForm.collarId ? Number(addAnimalForm.collarId) : undefined,
        animalTypeId: addAnimalForm.animalTypeId || undefined,
        zoneId: addAnimalForm.zoneId || undefined,
      });
      toast.success('Animal registrado exitosamente');
      setIsAddModalOpen(false);
      setAddAnimalForm({
        tag: '',
        breed: '',
        weightKg: '',
        ageMonths: '12',
        collarId: '',
        animalTypeId: '',
        zoneId: '',
      });
      refetchAnimals();
      refetchCollars();
    } catch {}
  };

  const handleBulkAssignZone = async () => {
    if (selectedIds.length === 0 || !activeFarmId) return;
    try {
      const res = await bulkAssignZone({
        farmId: activeFarmId,
        animalIds: selectedIds,
        zoneId: targetZoneId || null,
      });
      toast.success(res?.message || 'Potrero actualizado correctamente');
      setIsBulkZoneModalOpen(false);
      setSelectedIds([]);
      refetchAnimals();
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al reasignar potrero');
    }
  };

  const handleBulkTransferFarm = async () => {
    if (selectedIds.length === 0 || !activeFarmId || !targetFarmId) return;
    const targetFarm = farms.find((f) => f.id === targetFarmId);
    const ok = await confirm({
      title: `Transferir ${selectedIds.length} animales a "${targetFarm?.name || 'otro campo'}"`,
      description:
        'Los animales pasarán al nuevo establecimiento a campo abierto (sin potrero asignado) y se cerrarán sus cercos virtuales actuales. Los collares asignados continuarán con ellos.',
      confirmLabel: 'Confirmar Traslado',
      danger: false,
    });
    if (!ok) return;

    try {
      const res = await bulkTransferFarm({
        sourceFarmId: activeFarmId,
        targetFarmId,
        animalIds: selectedIds,
      });
      toast.success(res?.message || 'Animales trasladados correctamente');
      setIsBulkTransferModalOpen(false);
      setSelectedIds([]);
      refetchAnimals();
      refetchCollars();
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al transferir animales');
    }
  };

  const handleSingleUpdateZone = async () => {
    if (!singleZoneAnimal) return;
    try {
      await updateAnimalZone(singleZoneAnimal.id, {
        zoneId: targetZoneId || null,
      });
      toast.success('Potrero asignado correctamente');
      setSingleZoneAnimal(null);
      refetchAnimals();
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar zona');
    }
  };

  const handleSingleUpdateCollar = async () => {
    if (!singleCollarAnimal) return;
    try {
      const collarIdVal = targetCollarId ? Number(targetCollarId) : null;
      const res = await updateAnimalCollar(singleCollarAnimal.id, {
        collarId: collarIdVal,
      });
      toast.success(res?.message || 'Collar actualizado');
      setSingleCollarAnimal(null);
      refetchAnimals();
      refetchCollars();
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar collar');
    }
  };

  const handleSingleUpdateGeofence = async () => {
    if (!singleGeofenceAnimal) return;
    try {
      const fenceIdVal = targetGeofenceId || null;
      const res = await updateAnimalGeofence(singleGeofenceAnimal.id, {
        geofenceId: fenceIdVal,
      });
      toast.success(res?.message || 'Cerco asignado exitosamente');
      setSingleGeofenceAnimal(null);
      refetchAnimals();
      refetchGeofences();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar cerco');
    }
  };

  const getHealthBadge = (animal: Animal) => {
    if (animal.isArchived) {
      return {
        label: animal.status === 'SOLD' ? 'Vendido' : 'Fallecido',
        class: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/30',
      };
    }
    const latestEvent = animal.medicalEvents[0];
    if (!latestEvent) {
      return {
        label: 'Saludable',
        class:
          'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
      };
    }
    switch (latestEvent.type) {
      case 'TREATMENT':
        return {
          label: 'Bajo Tratamiento',
          class:
            'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
        };
      case 'SURGERY':
        return {
          label: 'Post-Operación',
          class: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
        };
      case 'VACCINATION':
        return {
          label: 'Vacunado',
          class:
            'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
        };
      default:
        return {
          label: 'Saludable',
          class:
            'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
        };
    }
  };

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="la Hacienda y Animales" />;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Gestión y Asignación de Hacienda
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Control de inventario ganadero, asignación masiva de potreros y vinculación de collares y cercos virtuales.
          </p>
        </div>
        {farms.length > 0 && (
          <div className="flex gap-3">
            <Button href="/farms/new" variant="outline" size="md" icon={CirclePlus}>
              Registrar Campo
            </Button>
            <Button
              variant="success"
              size="md"
              icon={CirclePlus}
              onClick={() => {
                if (animalTypes.length > 0 && !addAnimalForm.animalTypeId) {
                  setAddAnimalForm((prev) => ({ ...prev, animalTypeId: animalTypes[0].id }));
                }
                setIsAddModalOpen(true);
              }}
            >
              Añadir Animal
            </Button>
          </div>
        )}
      </div>

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <EmptyFarmState />
      ) : (
        <>
          {/* Controls Bar: Search & Filters */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
              {/* Universal Dual Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por Caravana (Tag), Raza o Identificador de Collar..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Establecimiento Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider shrink-0">Campo:</span>
                <select
                  value={activeFarmId}
                  onChange={(e) => setSelectedFarm(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm font-semibold cursor-pointer min-w-44"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Granular Filters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-850">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Potrero / Zona</label>
                <select
                  value={filters.zoneId}
                  onChange={(e) => setFilters({ ...filters, zoneId: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                >
                  <option value="">Todas las zonas</option>
                  {farmZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Estado Hacienda</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                >
                  <option value="ACTIVE">Activos</option>
                  <option value="SOLD">Vendidos</option>
                  <option value="DEAD">Fallecidos</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Tipo Animal</label>
                <select
                  value={filters.animalType}
                  onChange={(e) => setFilters({ ...filters, animalType: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                >
                  <option value="">Todos los tipos</option>
                  {animalTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.species})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Salud</label>
                <select
                  value={filters.healthStatus}
                  onChange={(e) => setFilters({ ...filters, healthStatus: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                >
                  <option value="">Cualquier estado</option>
                  <option value="HEALTHY">Saludable</option>
                  <option value="TREATMENT">Tratamiento</option>
                  <option value="SURGERY">Post-Op</option>
                  <option value="VACCINATION">Vacunado</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer select-none h-[34px] px-3 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <input
                    type="checkbox"
                    checked={filters.hasActiveAlert}
                    onChange={(e) => setFilters((prev) => ({ ...prev, hasActiveAlert: e.target.checked }))}
                    className="rounded border-zinc-300 text-green-600 focus:ring-green-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Alertas activas</span>
                </label>
              </div>
            </div>
          </div>

          {/* Bulk Action Sticky Bar */}
          {selectedIds.length > 0 && (
            <div className="sticky top-4 z-40 bg-zinc-900/95 dark:bg-zinc-800/95 text-white p-3.5 rounded-2xl shadow-xl border border-zinc-700/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm font-bold">
                  {selectedIds.length} {selectedIds.length === 1 ? 'animal seleccionado' : 'animales seleccionados'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-zinc-400 hover:text-white underline cursor-pointer ml-2"
                >
                  Deseleccionar
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTargetZoneId('');
                    setIsBulkZoneModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Mover a Potrero / Zona...</span>
                </button>

                {farms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const otherFarms = farms.filter((f) => f.id !== activeFarmId);
                      setTargetFarmId(otherFarms[0]?.id || '');
                      setIsBulkTransferModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transferir a otro Campo...</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* High-Density Data Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-6">
                <SkeletonRowList count={6} />
              </div>
            ) : filteredAnimals.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
                  <Tag className="w-6 h-6" />
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 font-semibold text-sm">
                  No se encontraron animales registrados.
                </p>
                <p className="text-zinc-400 text-xs">
                  Modificá el término de búsqueda o filtros, o añadí una nueva cabeza a este campo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                      <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredAnimals.length && filteredAnimals.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-zinc-300 text-green-600 focus:ring-green-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-3">Caravana (Tag) / Especie</th>
                      <th className="py-3.5 px-3">Estado / Salud</th>
                      <th className="py-3.5 px-3">Peso & Edad</th>
                      <th className="py-3.5 px-3">Potrero (Zona)</th>
                      <th className="py-3.5 px-3">Collar IoT</th>
                      <th className="py-3.5 px-3">Cerco Virtual Eléctrico</th>
                      <th className="py-3.5 pr-4 pl-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredAnimals.map((animal) => {
                      const isSelected = selectedIds.includes(animal.id);
                      const health = getHealthBadge(animal);
                      const collar = animal.animalCollars[0]?.collar;
                      const activeGeofence = animal.animalGeofences[0]?.geofence;
                      const hasCollar = !!collar;

                      return (
                        <tr
                          key={animal.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-green-50/60 dark:bg-green-950/20'
                              : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 pl-4 pr-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(animal.id)}
                              className="rounded border-zinc-300 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                          </td>

                          {/* Caravana / Breed */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-zinc-900 dark:text-white">
                                {animal.tag || `ID: ${animal.id.slice(0, 6)}`}
                              </span>
                              {animal.status !== 'ACTIVE' && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                  {animal.status === 'SOLD' ? 'Vendido' : 'Baja'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                              {animal.animalType?.name || 'Bovino'} &bull; {animal.breed}
                            </div>
                          </td>

                          {/* Health Badge */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-[11px] font-semibold border rounded-full ${health.class}`}>
                              {health.label}
                            </span>
                          </td>

                          {/* Weight & Age */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">{animal.weightKg} kg</span>
                            <span className="text-zinc-400 dark:text-zinc-500 text-[11px] ml-1.5">
                              {animal.birthDate ? `• ${animal.birthDate.slice(0, 10)}` : ''}
                            </span>
                          </td>

                          {/* Zone */}
                          <td className="py-3 px-3">
                            {animal.zone ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleZoneAnimal(animal);
                                  setTargetZoneId(animal.zoneId || '');
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
                                title="Clic para cambiar de potrero"
                              >
                                <Layers className="w-3 h-3" />
                                <span>{animal.zone.name}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleZoneAnimal(animal);
                                  setTargetZoneId('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                                title="Clic para asignar potrero"
                              >
                                <span>Campo abierto</span>
                              </button>
                            )}
                          </td>

                          {/* Collar IoT */}
                          <td className="py-3 px-3">
                            {collar ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleCollarAnimal(animal);
                                  setTargetCollarId(String(collar.id));
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                                title="Clic para gestionar collar"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    collar.telemetryReadings?.[0] ? 'bg-green-500' : 'bg-amber-500'
                                  }`}
                                ></span>
                                <span>{collar.identifier}</span>
                                {collar.telemetryReadings?.[0] && (
                                  <span className="text-[10px] opacity-75">
                                    ({collar.telemetryReadings[0].temperature.toFixed(0)}°C)
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleCollarAnimal(animal);
                                  setTargetCollarId('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                                title="Clic para vincular collar"
                              >
                                <Radio className="w-3 h-3 text-zinc-300" />
                                <span>Sin vincular</span>
                              </button>
                            )}
                          </td>

                          {/* Virtual Electric Fence */}
                          <td className="py-3 px-3">
                            {activeGeofence ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleGeofenceAnimal(animal);
                                  setTargetGeofenceId(activeGeofence.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors cursor-pointer"
                                title="Clic para gestionar cerco"
                              >
                                <Zap className="w-3 h-3" />
                                <span>{activeGeofence.name}</span>
                              </button>
                            ) : hasCollar ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSingleGeofenceAnimal(animal);
                                  setTargetGeofenceId('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                                title="Asignar cerco virtual disponible"
                              >
                                <Zap className="w-3 h-3 text-zinc-300" />
                                <span>Sin cerco</span>
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-zinc-400 bg-zinc-100/60 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-800 select-none cursor-not-allowed"
                                title="Regla de negocio: Requiere collar activo para poder ser contenido en un cerco virtual"
                              >
                                <Lock className="w-2.5 h-2.5 text-zinc-400" />
                                <span>Requiere collar</span>
                              </span>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setMedicalHistoryAnimalId(animal.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors cursor-pointer inline-flex items-center"
                              title="Historial médico y pesajes"
                            >
                              <HeartPulse className="w-4 h-4" />
                            </button>

                            {animal.status === 'ACTIVE' && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleArchive(animal.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                              >
                                <option value="" disabled>
                                  Baja...
                                </option>
                                <option value="SOLD">Vendido</option>
                                <option value="DEAD">Fallecido</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Bulk Assign Zone */}
      {isBulkZoneModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  Mover Hacienda a Potrero / Zona
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Reasignar {selectedIds.length} cabezas seleccionadas
                </p>
              </div>
              <button
                onClick={() => setIsBulkZoneModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Potrero de Destino
                </label>
                <select
                  value={targetZoneId}
                  onChange={(e) => setTargetZoneId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="">Campo abierto / Sin potrero específico</option>
                  {farmZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} {z.pastureType ? `(${z.pastureType})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Nota: Si un animal estaba asignado a un cerco virtual que no corresponde a este potrero, el cerco se cerrará automáticamente.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setIsBulkZoneModalOpen(false)}
                  variant="outline"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkAssignZone}
                  disabled={bulkAssigning}
                  variant="success"
                  size="md"
                >
                  {bulkAssigning ? 'Reasignando...' : 'Aplicar a Selección'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Transfer Farm */}
      {isBulkTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  Transferir Hacienda a otro Campo
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Mover {selectedIds.length} animales a otro establecimiento
                </p>
              </div>
              <button
                onClick={() => setIsBulkTransferModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Establecimiento Destino
                </label>
                <select
                  value={targetFarmId}
                  onChange={(e) => setTargetFarmId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  {farms
                    .filter((f) => f.id !== activeFarmId)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Al transferir al nuevo campo, los animales quedarán en <strong>campo abierto</strong> (sin potrero asignado) y se cerrarán sus cercos virtuales anteriores. Los collares asignados continuarán con cada cabeza.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setIsBulkTransferModalOpen(false)}
                  variant="outline"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkTransferFarm}
                  disabled={bulkTransferring}
                  variant="primary"
                  size="md"
                >
                  {bulkTransferring ? 'Transfiriendo...' : 'Confirmar Traslado'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Single Animal Zone Update */}
      {singleZoneAnimal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Asignar Potrero / Zona</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Animal: {singleZoneAnimal.tag || singleZoneAnimal.id}</p>
              </div>
              <button
                onClick={() => setSingleZoneAnimal(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Potrero</label>
                <select
                  value={targetZoneId}
                  onChange={(e) => setTargetZoneId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="">Campo abierto / Sin potrero</option>
                  {farmZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} {z.pastureType ? `(${z.pastureType})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setSingleZoneAnimal(null)}
                  variant="outline"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSingleUpdateZone}
                  disabled={updatingZone}
                  variant="success"
                  size="md"
                >
                  {updatingZone ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Single Animal Collar Link/Unlink */}
      {singleCollarAnimal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Vincular Collar IoT</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Animal: {singleCollarAnimal.tag || singleCollarAnimal.id}</p>
              </div>
              <button
                onClick={() => setSingleCollarAnimal(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Collar Disponible
                </label>
                <select
                  value={targetCollarId}
                  onChange={(e) => setTargetCollarId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="">Sin collar (desvincular)</option>
                  {singleCollarAnimal.animalCollars[0]?.collar && (
                    <option value={singleCollarAnimal.animalCollars[0].collar.id}>
                      Collar actual: {singleCollarAnimal.animalCollars[0].collar.identifier}
                    </option>
                  )}
                  {availableCollars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.identifier} (Disponible)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Nota: Desvincular el collar removerá automáticamente al animal de cualquier cerco eléctrico virtual activo.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setSingleCollarAnimal(null)}
                  variant="outline"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSingleUpdateCollar}
                  disabled={updatingCollar}
                  variant="success"
                  size="md"
                >
                  {updatingCollar ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Single Animal Geofence Assign */}
      {singleGeofenceAnimal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  Cerco Eléctrico Virtual
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Animal: {singleGeofenceAnimal.tag || singleGeofenceAnimal.id}</p>
              </div>
              <button
                onClick={() => setSingleGeofenceAnimal(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!singleGeofenceAnimal.animalCollars[0]?.collar ? (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 p-4 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Lock className="w-4 h-4" />
                    <span>Requiere Collar Activo</span>
                  </div>
                  <p>
                    Un animal no puede ser asignado a un cerco virtual si no posee un collar IoT vinculado para monitorear el perímetro y emitir las correcciones.
                  </p>
                  <p className="font-semibold">
                    Primero vinculá un collar al animal desde la columna &ldquo;Collar IoT&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Cerco Virtual Activo
                  </label>
                  <select
                    value={targetGeofenceId}
                    onChange={(e) => setTargetGeofenceId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                  >
                    <option value="">Sin cerco virtual (liberar)</option>
                    {farmGeofences
                      .filter((g) => g.active && (!singleGeofenceAnimal.zoneId || g.zoneId === singleGeofenceAnimal.zoneId))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          ⚡ {g.name} ({farmZones.find((z) => z.id === g.zoneId)?.name || g.zone?.name || 'Zona'})
                        </option>
                      ))}
                  </select>
                  {farmGeofences.length === 0 && (
                    <span className="text-[11px] text-zinc-400 mt-1">
                      No hay cercos virtuales activos en este establecimiento. Podés crearlos desde el menú Cercos Eléctricos.
                    </span>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setSingleGeofenceAnimal(null)}
                  variant="outline"
                  size="md"
                >
                  Cerrar
                </Button>
                {singleGeofenceAnimal.animalCollars[0]?.collar && (
                  <Button
                    type="button"
                    onClick={handleSingleUpdateGeofence}
                    disabled={updatingGeofence}
                    variant="success"
                    size="md"
                  >
                    {updatingGeofence ? 'Guardando...' : 'Aplicar'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Animal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Añadir Nuevo Animal</h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetModal();
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {modalError && (
              <div className="mx-6 mt-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 p-3 rounded-xl text-xs text-center">
                {modalError}
              </div>
            )}
            <form onSubmit={handleAddAnimalSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    Caravana / Identificador (Tag)
                  </label>
                  <input
                    required
                    type="text"
                    value={addAnimalForm.tag}
                    onChange={(e) => setAddAnimalForm({ ...addAnimalForm, tag: e.target.value })}
                    placeholder="Ej: Caravana #12"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Raza</label>
                  <input
                    required
                    type="text"
                    value={addAnimalForm.breed}
                    onChange={(e) => setAddAnimalForm({ ...addAnimalForm, breed: e.target.value })}
                    placeholder="Ej: Aberdeen Angus"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Peso (Kg)</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={addAnimalForm.weightKg}
                    onChange={(e) => setAddAnimalForm({ ...addAnimalForm, weightKg: e.target.value })}
                    placeholder="Ej: 420"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Edad (Meses)</label>
                  <input
                    required
                    type="number"
                    value={addAnimalForm.ageMonths}
                    onChange={(e) => setAddAnimalForm({ ...addAnimalForm, ageMonths: e.target.value })}
                    placeholder="Ej: 24"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tipo de Animal</label>
                <select
                  value={addAnimalForm.animalTypeId}
                  onChange={(e) => setAddAnimalForm({ ...addAnimalForm, animalTypeId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="" disabled>
                    Seleccionar tipo...
                  </option>
                  {animalTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.species})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Potrero / Zona (Opcional)</label>
                <select
                  value={addAnimalForm.zoneId}
                  onChange={(e) => setAddAnimalForm({ ...addAnimalForm, zoneId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="">Sin asignar / Campo abierto</option>
                  {farmZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} {z.pastureType ? `(${z.pastureType})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Collar IoT (Opcional)
                </label>
                <select
                  value={addAnimalForm.collarId}
                  onChange={(e) => setAddAnimalForm({ ...addAnimalForm, collarId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="">Sin collar</option>
                  {availableCollars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.identifier} (Disponible)
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetModal();
                  }}
                  variant="outline"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={modalLoading} variant="success" size="md">
                  {modalLoading ? 'Guardando...' : 'Guardar Animal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Historial Médico */}
      {medicalHistoryAnimalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Historial Médico y Pesajes</h3>
              <button
                onClick={() => setMedicalHistoryAnimalId(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {fetchingMedicalEvents ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                </div>
              ) : medicalEvents.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-4">
                  Este animal todavía no tiene registros médicos ni pesajes.
                </p>
              ) : (
                <ul className="space-y-2">
                  {medicalEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-3 text-xs flex justify-between items-start"
                    >
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {ev.type ?? 'Evento General'}
                          {ev.value !== null ? ` — ${ev.value}` : ''}
                        </span>
                        {ev.description && <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">{ev.description}</p>}
                      </div>
                      <span className="text-zinc-400 whitespace-nowrap ml-3">
                        {new Date(ev.occurredAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              onSubmit={handleAddMedicalEvent}
              className="p-6 pt-0 space-y-3 border-t border-zinc-100 dark:border-zinc-800"
            >
              <div className="grid grid-cols-2 gap-3 pt-4">
                <select
                  value={medicalForm.type}
                  onChange={(e) => setMedicalForm({ ...medicalForm, type: e.target.value as MedicalEventType })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="VACCINATION">Vacunación</option>
                  <option value="WEIGHING">Pesaje</option>
                  <option value="BIRTH">Parto</option>
                  <option value="TREATMENT">Tratamiento</option>
                  <option value="SURGERY">Cirugía</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  placeholder={medicalForm.type === 'WEIGHING' ? 'Peso (Kg)' : 'Valor (opcional)'}
                  value={medicalForm.value}
                  onChange={(e) => setMedicalForm({ ...medicalForm, value: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Descripción o anotación clínica..."
                value={medicalForm.description}
                onChange={(e) => setMedicalForm({ ...medicalForm, description: e.target.value })}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
              />
              <Button type="submit" disabled={creatingMedicalEvent} variant="success" size="md">
                {creatingMedicalEvent ? 'Agregando...' : 'Agregar Registro'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnimalsListPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <SkeletonRowList count={8} />
        </div>
      }
    >
      <AnimalsContent />
    </Suspense>
  );
}
