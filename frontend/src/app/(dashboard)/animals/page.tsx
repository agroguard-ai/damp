'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyFarmState } from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { animalTypesApi } from '@/lib/api/animal-types';
import { zonesApi } from '@/lib/api/zones';
import { collarsApi } from '@/lib/api/collars';
import { medicalEventsApi } from '@/lib/api/medical-events';
import { animalsApi, type Animal } from '@/lib/api/animals';
import type { MedicalEventType } from '@/types';
import { CirclePlus } from 'lucide-react';

export default function AnimalsListPage() {
  const { toast } = useToast();
  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);
  const { data: animalTypes = [] } = useApi(animalTypesApi.getAll);
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const activeFarmId = selectedFarm || farms[0]?.id || '';

  const fetchZones = useCallback(
    () => (activeFarmId ? zonesApi.getByFarm(activeFarmId) : Promise.resolve([])),
    [activeFarmId]
  );
  const { data: farmZones = [] } = useApi(fetchZones, [activeFarmId]);
  const { data: collars = [] } = useApi(collarsApi.getAll);
  const availableCollars = collars.filter((c) => c.status === 'AVAILABLE' && !c.assignedAnimal);

  const [filters, setFilters] = useState({
    animalType: '',
    healthStatus: '',
    status: 'ACTIVE',
  });

  const fetchAnimals = useCallback(
    () =>
      activeFarmId
        ? animalsApi.getAll({
            farmId: activeFarmId,
            ...(filters.animalType && { animalType: filters.animalType }),
            ...(filters.healthStatus && { healthStatus: filters.healthStatus }),
            status: filters.status,
          })
        : Promise.resolve([]),
    [activeFarmId, filters]
  );
  const { data: animals = [], loading, refetch: refetchAnimals } = useApi(fetchAnimals, [activeFarmId, filters]);

  // Mutations
  const { mutate: archiveAnimal } = useMutation(animalsApi.archive);
  const {
    mutate: createAnimal,
    loading: modalLoading,
    error: modalError,
    reset: resetModal,
  } = useMutation(animalsApi.create);

  const [medicalHistoryAnimalId, setMedicalHistoryAnimalId] = useState<string | null>(null);
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
      toast.success('Registro médico agregado');
      refetchMedicalEvents();
      refetchAnimals();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tag: '',
    breed: '',
    weightKg: '',
    ageMonths: '12',
    collarId: '',
    animalTypeId: '',
    zoneId: '',
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleArchive = async (animalId: string, reason: string) => {
    if (!reason) return;
    if (
      !confirm(
        `¿Estás seguro de archivar este animal como ${reason === 'SOLD' ? 'Vendido' : 'Muerto'}? Se desvincularán sus collares y zonas activas.`
      )
    )
      return;
    try {
      await archiveAnimal(animalId, { status: reason as 'SOLD' | 'DEAD' });
      toast.success('Animal archivado con éxito');
      refetchAnimals();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) return;
    try {
      await createAnimal({
        farmId: activeFarmId,
        tag: formData.tag,
        breed: formData.breed,
        weightKg: Number(formData.weightKg),
        ageMonths: Number(formData.ageMonths),
        collarId: formData.collarId ? Number(formData.collarId) : undefined,
        animalTypeId: formData.animalTypeId || undefined,
        zoneId: formData.zoneId || undefined,
      });
      toast.success('Animal registrado con éxito');
      setIsModalOpen(false);
      setFormData({
        tag: '',
        breed: '',
        weightKg: '',
        ageMonths: '12',
        collarId: '',
        animalTypeId: '',
        zoneId: '',
      });
      refetchAnimals();
    } catch {}
  };

  const getHealthBadge = (animal: Animal) => {
    if (animal.isArchived)
      return {
        label: 'Archivado',
        class: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/30',
      };
    const latestEvent = animal.medicalEvents[0];
    if (!latestEvent)
      return {
        label: 'Saludable',
        class:
          'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
      };
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
          label: 'Vacunado reciente',
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

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Monitoreo de Hacienda</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Visualización y administración de los animales activos y sus collares vinculados.
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
                if (animalTypes.length > 0 && !formData.animalTypeId) {
                  setFormData((prev) => ({ ...prev, animalTypeId: animalTypes[0].id }));
                }
                setIsModalOpen(true);
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
          {/* Filters Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5 lg:col-span-1">
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
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Estado Hacienda</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
              >
                <option value="ACTIVE">Activos</option>
                <option value="SOLD">Vendidos</option>
                <option value="DEAD">Fallecidos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Tipo de Animal</label>
              <select
                name="animalType"
                value={filters.animalType}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
              >
                <option value="">Todos</option>
                {animalTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.species})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">Estado Salud</label>
              <select
                name="healthStatus"
                value={filters.healthStatus}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
              >
                <option value="">Todos</option>
                <option value="HEALTHY">Saludable</option>
                <option value="TREATMENT">Tratamiento</option>
                <option value="SURGERY">Post-Op</option>
                <option value="VACCINATION">Vacunado</option>
              </select>
            </div>
          </div>

          {/* Animals Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
            </div>
          ) : animals.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-16 rounded-xl text-center shadow-sm">
              <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                No se encontraron animales con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {animals.map((animal) => {
                const health = getHealthBadge(animal);
                const collar = animal.animalCollars[0]?.collar;
                const activeGeofence = animal.animalGeofences[0]?.geofence;
                return (
                  <div
                    key={animal.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                            {animal.animalType?.name || 'Sin Clasificar'} &bull; {animal.breed}
                          </span>
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                            {animal.tag || `Animal (${animal.id.slice(0, 5)})`}
                          </h3>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold border rounded-full ${health.class}`}>
                          {animal.status !== 'ACTIVE'
                            ? animal.status === 'SOLD'
                              ? 'Vendido'
                              : 'Fallecido'
                            : health.label}
                        </span>
                      </div>
                      <div className="space-y-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="flex justify-between">
                          <span>Peso</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{animal.weightKg} Kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Collar Asignado</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                            {collar ? (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${collar.telemetryReadings?.[0] ? 'bg-green-500' : 'bg-red-500'}`}
                                ></span>
                                Collar #{collar.id}
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-650">No vinculado</span>
                            )}
                          </span>
                        </div>
                        {collar && (
                          <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-850 mt-1">
                            <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-medium">
                              Lectura IoT
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-750 dark:text-zinc-350">
                              {collar.telemetryReadings?.[0] ? (
                                <span>🌡️ {collar.telemetryReadings[0].temperature.toFixed(1)}°C</span>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-650 italic">Esperando señal...</span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Zona / Potrero</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                            {animal.zone?.name || <span className="text-zinc-400 dark:text-zinc-650">Sin asignar</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cerco Virtual</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                            {activeGeofence?.name || (
                              <span className="text-zinc-400 dark:text-zinc-650">Sin cerco activo</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        onClick={() => setMedicalHistoryAnimalId(animal.id)}
                        className="text-xs font-semibold text-green-600 hover:text-green-700 cursor-pointer"
                      >
                        Historial médico
                      </button>
                    </div>
                    <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      {animal.status === 'ACTIVE' ? (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-zinc-400">
                            Reg: {new Date(animal.createdAt).toLocaleDateString()}
                          </span>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleArchive(animal.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer font-medium"
                          >
                            <option value="" disabled>
                              Dar de Baja...
                            </option>
                            <option value="SOLD">Vendido</option>
                            <option value="DEAD">Fallecido</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 text-[10px] text-zinc-450 dark:text-zinc-500">
                          <span>Estado: {animal.status === 'SOLD' ? 'Vendido' : 'Fallecido'}</span>
                          <span>Baja registrada (Historial conservado)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {/* Modal: Add Animal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Añadir Nuevo Animal</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetModal();
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-250 cursor-pointer"
              >
                &times;
              </button>
            </div>
            {modalError && (
              <div className="mx-6 mt-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 p-3 rounded-lg text-xs text-center">
                {modalError}
              </div>
            )}
            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">
                    Identificador (Tag)
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="Ej: Caravana #12"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Raza</label>
                  <input
                    required
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="Ej: Aberdeen Angus"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Peso (Kg)</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={formData.weightKg}
                    onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                    placeholder="Ej: 420"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Edad (Meses)</label>
                  <input
                    required
                    type="number"
                    value={formData.ageMonths}
                    onChange={(e) => setFormData({ ...formData, ageMonths: e.target.value })}
                    placeholder="Ej: 24"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Tipo de Animal</label>
                <select
                  value={formData.animalTypeId}
                  onChange={(e) => setFormData({ ...formData, animalTypeId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
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
                <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Zona (Opcional)</label>
                <select
                  value={formData.zoneId}
                  onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="">Sin asignar / Campo abierto</option>
                  {farmZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">
                  Collar IoT (Opcional)
                </label>
                <select
                  value={formData.collarId}
                  onChange={(e) => setFormData({ ...formData, collarId: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="">Sin collar</option>
                  {availableCollars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.identifier}
                    </option>
                  ))}
                </select>
                {availableCollars.length === 0 && (
                  <span className="text-[10px] text-zinc-400 italic mt-0.5">
                    No hay collares disponibles. Registrá uno en la sección Collares.
                  </span>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetModal();
                  }}
                  variant="outline"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={modalLoading} variant="success" size="md">
                  {modalLoading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Guardar Animal'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Historial Médico */}
      {medicalHistoryAnimalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Historial Médico</h3>
              <button
                onClick={() => setMedicalHistoryAnimalId(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-250 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {fetchingMedicalEvents ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
                </div>
              ) : medicalEvents.length === 0 ? (
                <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-4">
                  Este animal todavía no tiene registros médicos. Cargá el primero abajo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {medicalEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 text-xs flex justify-between items-start"
                    >
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {ev.type ?? 'Otro'}
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
              className="p-6 pt-0 space-y-3 border-t border-zinc-100 dark:border-zinc-850"
            >
              <div className="grid grid-cols-2 gap-3 pt-4">
                <select
                  value={medicalForm.type}
                  onChange={(e) => setMedicalForm({ ...medicalForm, type: e.target.value as MedicalEventType })}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
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
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Descripción (opcional)"
                value={medicalForm.description}
                onChange={(e) => setMedicalForm({ ...medicalForm, description: e.target.value })}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
              />
              <Button type="submit" disabled={creatingMedicalEvent} variant="success" size="md">
                {creatingMedicalEvent ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Agregar Registro'
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
