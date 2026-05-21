"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewFarmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    province: "",
    totalAreaHa: "",
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
        name: formData.name,
        address: formData.address,
        province: formData.province,
        totalAreaHa: Number(formData.totalAreaHa),
      };

      const res = await fetch("http://localhost:3001/farms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al registrar el campo");
      }

      alert("Campo/Granja registrado con éxito");
      router.push("/animals/new"); // Ir directo a registrar un animal ya con la granja creada
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
          Registrar Nuevo Campo
        </h1>
        <p className="text-zinc-400 text-center mb-8 text-sm">
          Añade un nuevo establecimiento agropecuario al sistema.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Nombre del Campo
              </label>
              <input
                required
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej: La Estancia, Campo Norte"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Dirección / Ubicación
              </label>
              <input
                required
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ej: Ruta 3 Km 120"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Provincia
              </label>
              <input
                required
                type="text"
                name="province"
                value={formData.province}
                onChange={handleChange}
                placeholder="Ej: Buenos Aires"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
              />
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Superficie Total (Hectáreas)
              </label>
              <input
                required
                type="number"
                step="0.1"
                name="totalAreaHa"
                value={formData.totalAreaHa}
                onChange={handleChange}
                placeholder="Ej: 250.5"
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
              "Registrar Campo"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
