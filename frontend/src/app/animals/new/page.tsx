"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Farm {
  id: string;
  name: string;
}

export default function NewAnimalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fetchingFarms, setFetchingFarms] = useState(true);

  const [formData, setFormData] = useState({
    farmId: "",
    tag: "",
    breed: "",
    weightKg: "",
    ageMonths: "",
    collarMacAddress: "",
  });

  // Cargar las granjas disponibles al montar la página
  useEffect(() => {
    async function fetchFarms() {
      try {
        const res = await fetch("http://localhost:3001/farms");
        if (!res.ok) throw new Error("No se pudieron cargar los campos");
        const data = await res.json();
        setFarms(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, farmId: data[0].id }));
        }
      } catch (err: any) {
        console.error(err);
        setError("Error al cargar los campos registrados. Por favor crea uno primero.");
      } finally {
        setFetchingFarms(false);
      }
    }
    fetchFarms();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.farmId) {
      setError("Debes seleccionar o registrar un campo primero");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        farmId: formData.farmId,
        tag: formData.tag,
        breed: formData.breed,
        weightKg: Number(formData.weightKg),
        ageMonths: Number(formData.ageMonths),
        collarMacAddress: formData.collarMacAddress || undefined,
      };

      const res = await fetch("http://localhost:3001/animals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al registrar el animal");
      }

      alert("Animal registrado con éxito");
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      <div className="w-full max-w-2xl bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-green-500/20 rounded-full blur-[80px] -z-10 pointer-events-none"></div>

        <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">
          Registrar Nuevo Animal
        </h1>
        <p className="text-zinc-400 text-center mb-8 text-sm">
          Añade una nueva vaca al rebaño y vincula su collar IoT.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {fetchingFarms ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
            <p className="text-zinc-400 text-sm mt-4">Cargando campos...</p>
          </div>
        ) : farms.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-zinc-400 text-sm">No tienes campos registrados aún en DAMP.</p>
            <Link
              href="/farms/new"
              className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl transition-all"
            >
              Registrar Primer Campo
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 col-span-1 md:col-span-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Seleccionar Campo / Granja
                  </label>
                  <Link
                    href="/farms/new"
                    className="text-xs text-green-400 hover:text-green-300 transition-colors underline"
                  >
                    + Registrar Nuevo Campo
                  </Link>
                </div>
                <select
                  name="farmId"
                  value={formData.farmId}
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all appearance-none"
                >
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id} className="bg-zinc-900 text-white">
                      {farm.name || `Campo (${farm.id.slice(0, 8)})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Identificador / Tag
                </label>
                <input
                  type="text"
                  name="tag"
                  value={formData.tag}
                  onChange={handleChange}
                  placeholder="Ej: Vaca Lola"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Raza
                </label>
                <input
                  required
                  type="text"
                  name="breed"
                  value={formData.breed}
                  onChange={handleChange}
                  placeholder="Ej: Aberdeen Angus"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
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
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Edad (Meses)
                </label>
                <input
                  required
                  type="number"
                  name="ageMonths"
                  value={formData.ageMonths}
                  onChange={handleChange}
                  placeholder="Ej: 24"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  ID/MAC del Collar IoT
                </label>
                <input
                  type="text"
                  name="collarMacAddress"
                  value={formData.collarMacAddress}
                  onChange={handleChange}
                  placeholder="Ej: 00:1B:44:11:3A:B7"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-8 bg-green-500 hover:bg-green-400 text-black font-bold py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : (
                "Registrar Animal"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
