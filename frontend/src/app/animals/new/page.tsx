"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAnimalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    farmId: "",
    tag: "",
    breed: "",
    weightKg: "",
    ageMonths: "",
    collarMacAddress: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      router.push("/"); // Volver al inicio
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                ID de la Granja (Farm UUID)
              </label>
              <input
                required
                type="text"
                name="farmId"
                value={formData.farmId}
                onChange={handleChange}
                placeholder="Ej: 123e4567-e89b-..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
              />
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

            <div className="space-y-2">
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
      </div>
    </div>
  );
}
