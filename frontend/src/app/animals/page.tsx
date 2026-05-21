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
    if (!latestEvent) return { label: "Saludable", class: "bg-green-500/10 text-green-400 border-green-500/30" };

    switch (latestEvent.type) {
      case "TREATMENT":
        // Si el evento médico indica que fue archivado
        if (latestEvent.description.includes("archivado") || latestEvent.description.includes("Baja")) {
          return { label: "Archivado", class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
        }
        return { label: "Bajo Tratamiento", class: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "SURGERY":
        return { label: "Post-Operación", class: "bg-red-500/10 text-red-400 border-red-500/30" };
      case "VACCINATION":
        return { label: "Vacunado reciente", class: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      default:
        return { label: "Saludable", class: "bg-green-500/10 text-green-400 border-green-500/30" };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoreo de Hacienda</h1>
            <p className="text-zinc-400 text-sm mt-1">Listado de animales activos y telemetría IoT.</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/farms/new"
              className="px-5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 transition-colors text-sm font-semibold"
            >
              + Registrar Campo
            </Link>
            <Link
              href="/animals/new"
              className="px-5 py-2.5 rounded-xl bg-green-500 text-black hover:bg-green-400 transition-colors text-sm font-semibold"
            >
              + Registrar Vaca
            </Link>
          </div>
        </div>

        {fetchingFarms ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : farms.length === 0 ? (
          <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-16 rounded-3xl text-center space-y-4">
            <p className="text-zinc-400">Aún no has configurado ningún establecimiento en DAMP.</p>
            <Link
              href="/farms/new"
              className="inline-block bg-green-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-green-400 transition-all"
            >
              Crear Mi Primer Campo
            </Link>
          </div>
        ) : (
          <>
            {/* Panel de Filtros */}
            <div className="bg-zinc-900/30 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row gap-4 items-end">
              
              {/* Seleccionar Campo */}
              <div className="flex-1 space-y-2 w-full">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Establecimiento</label>
                <select
                  value={selectedFarm}
                  onChange={(e) => setSelectedFarm(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id} className="bg-zinc-900">
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Estado del Animal */}
              <div className="space-y-2 w-full md:w-40">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Estado Hacienda</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                >
                  <option value="ACTIVE" className="bg-zinc-900">Activos</option>
                  <option value="SOLD" className="bg-zinc-900">Vendidos (Archivados)</option>
                  <option value="DEAD" className="bg-zinc-900">Fallecidos (Archivados)</option>
                </select>
              </div>

              {/* Tipo de Animal */}
              <div className="space-y-2 w-full md:w-40">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tipo</label>
                <select
                  name="animalType"
                  value={filters.animalType}
                  onChange={handleFilterChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                >
                  <option value="" className="bg-zinc-900">Todos</option>
                  <option value="COW" className="bg-zinc-900">Vacas</option>
                </select>
              </div>

              {/* Estado de Collar */}
              <div className="space-y-2 w-full md:w-40">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Estado Collar</label>
                <select
                  name="collarStatus"
                  value={filters.collarStatus}
                  onChange={handleFilterChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                >
                  <option value="" className="bg-zinc-900">Todos</option>
                  <option value="ACTIVE" className="bg-zinc-900">Activo (Online)</option>
                  <option value="INACTIVE" className="bg-zinc-900">Inactivo (Offline)</option>
                </select>
              </div>

              {/* Estado de Salud */}
              <div className="space-y-2 w-full md:w-40">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Estado de Salud</label>
                <select
                  name="healthStatus"
                  value={filters.healthStatus}
                  onChange={handleFilterChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                >
                  <option value="" className="bg-zinc-900">Todos</option>
                  <option value="HEALTHY" className="bg-zinc-900">Saludable</option>
                  <option value="TREATMENT" className="bg-zinc-900">Bajo Tratamiento</option>
                  <option value="SURGERY" className="bg-zinc-900">Post-Operación</option>
                  <option value="VACCINATION" className="bg-zinc-900">Vacunación Reciente</option>
                </select>
              </div>
            </div>

            {/* Listado de Animales */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
              </div>
            ) : animals.length === 0 ? (
              <div className="bg-zinc-900/10 border border-white/5 py-16 rounded-3xl text-center">
                <p className="text-zinc-500 text-sm">No se encontraron animales con los filtros seleccionados.</p>
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
                      className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-green-500/30 transition-all group hover:shadow-lg relative overflow-hidden flex flex-col justify-between"
                    >
                      {/* Ambient Glow on Card Hover */}
                      <div className="absolute -top-12 -right-12 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all pointer-events-none"></div>

                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                              {animal.animalType} - {animal.breed}
                            </span>
                            <h3 className="text-xl font-bold mt-1 text-white">
                              {animal.tag || `Caravana (${animal.id.slice(0, 5)})`}
                            </h3>
                          </div>
                          <span className={`px-3 py-1 text-xs font-semibold border rounded-full ${health.class}`}>
                            {animal.status !== "ACTIVE" ? (animal.status === "SOLD" ? "Vendido" : "Fallecido") : health.label}
                          </span>
                        </div>

                        <div className="space-y-3 border-t border-white/5 pt-4 text-sm text-zinc-400">
                          <div className="flex justify-between">
                            <span>Peso</span>
                            <span className="text-white font-medium">{animal.weightKg} Kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Collar Asignado</span>
                            <span className="text-white font-medium">
                              {collar ? (
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${collar.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                  {collar.serialNumber}
                                </span>
                              ) : (
                                "No vinculado"
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sector / Zona</span>
                            <span className="text-white font-medium">
                              {sector?.name || "Sin asignar"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-white/5 pt-4">
                        {animal.status === "ACTIVE" ? (
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs text-zinc-500">
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
                              className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="" disabled>Dar de Baja...</option>
                              <option value="SOLD">Vendido</option>
                              <option value="DEAD">Fallecido</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 text-xs text-zinc-500">
                            <span>Estado: {animal.status === "SOLD" ? "Vendido" : "Fallecido"}</span>
                            <span>Fecha de Baja: {new Date().toLocaleDateString()} (Historial conservado)</span>
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
    </div>
  );
}
