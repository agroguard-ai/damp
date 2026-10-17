'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AnimalType } from '@/types';
import { Select } from '@/components/ui/Select';

interface BreedSelectProps {
  animalTypes: AnimalType[];
  /** id del AnimalType elegido (cada tipo del catálogo es una raza de una especie). */
  value: string;
  onChange: (animalTypeId: string) => void;
  /** Al editar, mantiene visible la raza actual aunque esté desactivada en el catálogo. */
  keepTypeId?: string | null;
  required?: boolean;
  labelClassName: string;
}

/**
 * Especie → Raza en dos selects encadenados, a partir del catálogo de Tipos de animal.
 * Reemplaza al campo de texto libre "Raza" para que no haya razas mal escritas.
 */
export default function BreedSelect({
  animalTypes,
  value,
  onChange,
  keepTypeId,
  required = false,
  labelClassName,
}: BreedSelectProps) {
  const available = useMemo(
    () => animalTypes.filter((t) => t.isActive !== false || t.id === keepTypeId),
    [animalTypes, keepTypeId]
  );
  const speciesList = useMemo(
    () => Array.from(new Set(available.map((t) => t.species))).sort((a, b) => a.localeCompare(b)),
    [available]
  );

  const selectedType = available.find((t) => t.id === value);
  // La especie sale de la raza elegida; si todavía no hay raza, de lo que eligió el usuario
  const [pickedSpecies, setPickedSpecies] = useState('');
  const species = selectedType?.species ?? pickedSpecies;

  const breeds = useMemo(
    () => available.filter((t) => t.species === species).sort((a, b) => a.name.localeCompare(b.name)),
    [available, species]
  );

  const handleSpeciesChange = (newSpecies: string) => {
    setPickedSpecies(newSpecies);
    const options = available.filter((t) => t.species === newSpecies);
    // Si la especie tiene una sola raza, se elige sola
    onChange(options.length === 1 ? options[0].id : '');
  };

  if (available.length === 0) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
        No hay razas cargadas en el catálogo.{' '}
        <Link href="/animal-types" className="font-semibold underline">
          Cargalas en Tipos de animal
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <label className={labelClassName}>Especie</label>
        <Select
          value={String(species)}
          onChange={(v) => handleSpeciesChange(v)}
          options={[...speciesList.map((s) => ({ value: String(s), label: String(s) }))]}
          required={required}
          placeholder={'Elegí la especie...'}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClassName}>Raza</label>
        <Select
          value={String(selectedType ? value : '')}
          onChange={(v) => onChange(v)}
          options={[...breeds.map((t) => ({ value: String(t.id), label: String(t.name) }))]}
          disabled={!species}
          required={required}
          placeholder={String(species ? 'Elegí la raza...' : 'Primero la especie')}
        />
      </div>
    </div>
  );
}
