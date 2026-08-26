'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useMutation } from '@/hooks/useMutation';
import { animalTypesApi } from '@/lib/api/animal-types';

import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmDialogContext';

export default function AnimalTypesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: types = [], loading, error: loadError, refetch } = useApi(animalTypesApi.getAll);
  const {
    mutate: createType,
    loading: submitting,
    error: createError,
    reset: resetCreate,
  } = useMutation(animalTypesApi.create);
  const { mutate: deleteType } = useMutation(animalTypesApi.delete);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Bovino');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createType({
        name,
        species,
        description: description || undefined,
      });
      setName('');
      setDescription('');
      toast.success('Tipo de animal registrado con éxito');
      refetch();
    } catch {
      // Error captured in mutation state
    }
  };

  const handleDelete = async (typeId: string) => {
    const ok = await confirm({
      title: 'Eliminar tipo de animal',
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteType(typeId);
      toast.success('Tipo de animal eliminado con éxito');
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const formError = createError;

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Tipos de Animal y Especies
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Configura las razas y especies ganaderas disponibles para catalogar tu hacienda.
          </p>
        </div>
      </div>

      {(loadError || formError) && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-650 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center">
          {loadError ?? formError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Types list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800">
              Razas y Tipos Registrados
            </h3>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-6 h-6 border-2 border-green-500/20 border-t-green-600 rounded-full animate-spin"></div>
              </div>
            ) : types.length === 0 ? (
              <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-8">
                No hay tipos de animales configurados aún. Utiliza el panel lateral para registrar el primero.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-450 dark:text-zinc-500 text-xs font-semibold uppercase">
                      <th className="pb-3">Nombre / Raza</th>
                      <th className="pb-3">Especie</th>
                      <th className="pb-3">Descripción</th>
                      <th className="pb-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {types.map((type) => (
                      <tr key={type.id} className="text-zinc-800 dark:text-zinc-200">
                        <td className="py-3.5 font-semibold">{type.name}</td>
                        <td className="py-3.5">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded text-xs text-zinc-650 dark:text-zinc-450 font-medium">
                            {type.species}
                          </span>
                        </td>
                        <td className="py-3.5 text-zinc-500 dark:text-zinc-400 max-w-[200px] truncate">
                          {type.description || '-'}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDelete(type.id)}
                            className="text-red-500 hover:text-red-750 text-xs font-semibold cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Create Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm space-y-6 sticky top-6">
            <div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Agregar Tipo de Animal</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                Registra una nueva categoría de ganado para tu hacienda.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Nombre / Raza
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    resetCreate();
                  }}
                  placeholder="Ej: Aberdeen Angus, Holando"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Especie
                </label>
                <select
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer font-medium"
                >
                  <option value="Bovino">Bovino (Vacas, Toros)</option>
                  <option value="Ovino">Ovino (Ovejas, Corderos)</option>
                  <option value="Porcino">Porcino (Cerdos)</option>
                  <option value="Caprino">Caprino (Cabras)</option>
                  <option value="Equino">Equino (Caballos)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas sobre esta raza o clasificación..."
                  rows={3}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Guardar Tipo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
