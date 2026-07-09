"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Farm {
  id: string;
  name: string;
}

interface Animal {
  id: string;
  tag: string | null;
  breed: string;
  weightKg: number;
  animalType: string;
  birthDate: string;
  status: string;
  createdAt: string;
  animalCollars: Array<{
    collar: {
      serialNumber: string;
      status: string;
    };
  }>;
  animalGeofences: Array<{
    geofence: {
      name: string;
      sector: {
        name: string;
      };
    };
  }>;
  medicalEvents: Array<{
    type: string;
    description: string;
  }>;
}

export default function AnimalsListPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<string>("");
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingFarms, setFetchingFarms] = useState(true);

  // Filtros
  const [filters, setFilters] = useState({
    animalType: "",
    collarStatus: "",
    healthStatus: "",
    status: "ACTIVE", // Default to only showing active ones
  });

  // Cargar granjas al inicio
  useEffect(() => {
    async function loadFarms() {
      try {
        const res = await fetch("http://localhost:3001/farms");
        if (!res.ok) throw new Error("Error al obtener campos");
        const data = await res.json();
        setFarms(data);
        if (data.length > 0) {
          setSelectedFarm(data[0].id);
        }
      } catch (error) {
        console.error("Error cargando granjas:", error);
      } finally {
        setFetchingFarms(false);
      }
    }
    loadFarms();
  }, []);

  // Cargar animales cuando cambia la granja o los filtros
  const loadAnimals = async () => {
    if (!selectedFarm) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        farmId: selectedFarm,
        ...(filters.animalType && { animalType: filters.animalType }),
        ...(filters.collarStatus && { collarStatus: filters.collarStatus }),
        ...(filters.healthStatus && { healthStatus: filters.healthStatus }),
        status: filters.status,
      });

      const res = await fetch(`http://localhost:3001/animals?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Error al obtener listado de animales");
      const data = await res.json();
      setAnimals(data);
    } catch (error) {
      console.error("Error cargando animales:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnimals();
  }, [selectedFarm, filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleArchive = async (animalId: string, reason: string) => {
    if (!reason) return;
    if (!confirm(`¿Estás seguro de archivar este animal como ${reason === "SOLD" ? "Vendido" : "Muerto"}? Se desvincularán sus collares y zonas activas.`)) return;

    try {
      const res = await fetch(`http://localhost:3001/animals/${animalId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reason }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al archivar el animal");
      }

      alert("Animal archivado con éxito");
      loadAnimals(); // Recargar listado
    } catch (error: any) {
      alert(error.message);
    }
  };

  const getHealthBadge = (animal: Animal) => {
    const latestEvent = animal.medicalEvents[0];
    if (!latestEvent) return { label: "Saludable", class: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30" };

    switch (latestEvent.type) {
      case "TREATMENT":
        // Si el evento médico indica que fue archivado
        if (latestEvent.description.includes("archivado") || latestEvent.description.includes("Baja")) {
          return { label: "Archivado", class: "bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/30" };
        }
        return { label: "Bajo Tratamiento", class: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30" };
      case "SURGERY":
        return { label: "Post-Operación", class: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30" };
      case "VACCINATION":
        return { label: "Vacunado reciente", class: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30" };
      default:
        return { label: "Saludable", class: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30" };
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Monitoreo de Hacienda
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Visualización y administración de los animales activos y sus collares vinculados.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/farms/new"
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors text-sm font-semibold text-zinc-850 dark:text-zinc-200 cursor-pointer"
          >
            + Registrar Campo
          </Link>
          <Link
            href="/animals/new"
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-semibold cursor-pointer shadow-sm"
          >
            + Registrar Vaca
          </Link>
        </div>
      </div>

      {fetchingFarms ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : farms.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-16 rounded-xl text-center space-y-4 shadow-sm">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Aún no has configurado ningún establecimiento en DAMP.</p>
          <Link
            href="/farms/new"
            className="inline-block bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-all shadow-sm cursor-pointer"
          >
            Crear Mi Primer Campo
          </Link>
        </div>
      ) : (
        <>
          {/* Panel de Filtros */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Seleccionar Campo */}
            <div className="flex flex-col gap-1.5 lg:col-span-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Establecimiento</label>
              <select
                value={selectedFarm}
                onChange={(e) => setSelectedFarm(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Estado Hacienda */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Estado Hacienda</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
              >
                <option value="ACTIVE">Activos</option>
                <option value="SOLD">Vendidos</option>
                <option value="DEAD">Fallecidos</option>
              </select>
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo</label>
              <select
                name="animalType"
                value={filters.animalType}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="COW">Vacas</option>
              </select>
            </div>

            {/* Estado Collar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Estado Collar</label>
              <select
                name="collarStatus"
                value={filters.collarStatus}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Online</option>
                <option value="INACTIVE">Offline</option>
              </select>
            </div>

            {/* Estado Salud */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Estado Salud</label>
              <select
                name="healthStatus"
                value={filters.healthStatus}
                onChange={handleFilterChange}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="HEALTHY">Saludable</option>
                <option value="TREATMENT">Tratamiento</option>
                <option value="SURGERY">Post-Op</option>
                <option value="VACCINATION">Vacunado</option>
              </select>
            </div>
          </div>

          {/* Listado de Animales */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
            </div>
          ) : animals.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-16 rounded-xl text-center shadow-sm">
              <p className="text-zinc-400 dark:text-zinc-500 text-sm">No se encontraron animales con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {animals.map((animal) => {
                const health = getHealthBadge(animal);
                const collar = animal.animalCollars[0]?.collar;
                const sector = animal.animalGeofences[0]?.geofence.sector;

                return (
                  <div
                    key={animal.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                            {animal.animalType === "COW" ? "Vaca" : animal.animalType} &bull; {animal.breed}
                          </span>
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                            {animal.tag || `Vaca (${animal.id.slice(0, 5)})`}
                          </h3>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold border rounded-full ${health.class}`}>
                          {animal.status !== "ACTIVE" ? (animal.status === "SOLD" ? "Vendido" : "Fallecido") : health.label}
                        </span>
                      </div>

                      {/* Content details */}
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
                                <span className={`w-1.5 h-1.5 rounded-full ${collar.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {collar.serialNumber}
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-650">No vinculado</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sector / Potrero</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                            {sector?.name || <span className="text-zinc-400 dark:text-zinc-650">Sin asignar</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom actions */}
                    <div className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      {animal.status === "ACTIVE" ? (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-zinc-400">
                            Reg: {new Date(animal.createdAt).toLocaleDateString()}
                          </span>
                          
                          {/* Selector de Baja */}
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleArchive(animal.id, e.target.value);
                                e.target.value = ""; // Reset select
                              }
                            }}
                            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                          >
                            <option value="" disabled>Dar de Baja...</option>
                            <option value="SOLD">Vendido</option>
                            <option value="DEAD">Fallecido</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 text-[10px] text-zinc-450 dark:text-zinc-500">
                          <span>Estado: {animal.status === "SOLD" ? "Vendido" : "Fallecido"}</span>
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
    </div>
  );
}
