'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { animalsApi } from '@/lib/api/animals';
import { collarsApi } from '@/lib/api/collars';
import { useToast } from '@/context/ToastContext';

export default function NewAnimalPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: farms = [], loading: fetchingFarms } = useApi(farmsApi.getAll);
  const { data: collars = [] } = useApi(collarsApi.getAll);
  const availableCollars = collars.filter((c) => c.status === 'AVAILABLE' && !c.assignedAnimal);
  const { mutate: createAnimal, loading, error, reset } = useMutation(animalsApi.create);

  const [formData, setFormData] = useState({
    farmId: '',
    tag: '',
    breed: '',
    weightKg: '',
    ageMonths: '',
    collarId: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalFarmId = formData.farmId || farms[0]?.id;
    if (!finalFarmId) return;

    try {
      await createAnimal({
        farmId: finalFarmId,
        tag: formData.tag,
        breed: formData.breed,
        weightKg: Number(formData.weightKg),
        ageMonths: Number(formData.ageMonths),
        collarId: formData.collarId ? Number(formData.collarId) : undefined,
      });
      toast.success('Animal registrado con éxito');
      router.push('/animals');
    } catch {}
  };

  return (
    <div className="py-10 px-4 md:px-8 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 mb-4"
          >
            &larr; Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Registrar Nuevo Animal</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Añade una nueva vaca al rebaño y vincula su dispositivo collar IoT para iniciar el rastreo.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {fetchingFarms ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-sm mt-4">Cargando campos...</p>
          </div>
        ) : farms.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-zinc-500 text-sm">No tienes campos registrados aún en DAMP.</p>
            <Link
              href="/farms/new"
              className="inline-block bg-green-600 hover:bg-green-750 text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-sm"
            >
              Registrar Primer Campo
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Seleccionar Campo */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Seleccionar Campo / Establecimiento
                  </label>
                  <Link href="/farms/new" className="text-xs text-green-600 dark:text-green-400 hover:underline">
                    Registrar Nuevo Campo
                  </Link>
                </div>
                <select
                  name="farmId"
                  value={formData.farmId || farms[0]?.id || ''}
                  onChange={handleChange}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm cursor-pointer"
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name || `Campo (${farm.id.slice(0, 8)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag / Caravana */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Identificador / Caravana (Tag)
                </label>
                <input
                  type="text"
                  name="tag"
                  value={formData.tag}
                  onChange={handleChange}
                  placeholder="Ej: Caravana #2203"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
                />
              </div>

              {/* Grid 2x2 for breed details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Raza */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Raza
                  </label>
                  <input
                    required
                    type="text"
                    name="breed"
                    value={formData.breed}
                    onChange={handleChange}
                    placeholder="Ej: Aberdeen Angus"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
                  />
                </div>

                {/* Peso */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Peso (Kg)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    name="weightKg"
                    value={formData.weightKg}
                    onChange={handleChange}
                    placeholder="Ej: 450.5"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Grid 2x2 for age and collar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Edad */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Edad (Meses)
                  </label>
                  <input
                    required
                    type="number"
                    name="ageMonths"
                    value={formData.ageMonths}
                    onChange={handleChange}
                    placeholder="Ej: 24"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
                  />
                </div>

                {/* Collar */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                    Collar IoT (Opcional)
                  </label>
                  <select
                    name="collarId"
                    value={formData.collarId}
                    onChange={handleChange}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm cursor-pointer"
                  >
                    <option value="">Sin collar</option>
                    {availableCollars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.identifier}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Registrar Animal'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
