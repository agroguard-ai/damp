'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMutation } from '@/hooks/useMutation';
import { farmsApi } from '@/lib/api/farms';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { GoogleAddressSearch, type AddressSearchResult } from '@/components/farms/GoogleAddressSearch';
import { getProvinces, getDepartments, getProvinceCenter } from '@/data/argentinaLocations';
import { calculatePolygonAreaHa } from '@/lib/geo/area';
import { MapPin, Ruler, ChevronDown, ShieldCheck, Trash2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';

const PolygonDrawerMap = dynamic(() => import('@/components/maps/PolygonDrawerMap'), { ssr: false });

const RENSPA_FORMAT = /^\d{2}\.\d{3}\.\d\.\d{5}\/\d{2}$/;

/** Autoformatea a medida que se tipea: XX.XXX.X.XXXXX/XX (Registro Nacional Sanitario, SENASA). */
function formatRenspa(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 13);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 6), digits.slice(6, 11), digits.slice(11, 13)];
  let result = parts[0];
  if (parts[1]) result += `.${parts[1]}`;
  if (parts[2]) result += `.${parts[2]}`;
  if (parts[3]) result += `.${parts[3]}`;
  if (parts[4]) result += `/${parts[4]}`;
  return result;
}

export default function NewFarmPage() {
  const { user, emulatedUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { mutate: createFarm, loading, error } = useMutation(farmsApi.create);

  const [step, setStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    province: '',
    department: '',
    totalAreaHa: '',
    renspa: '',
  });

  const [mapCenter, setMapCenter] = useState<[number, number]>([-38.4161, -63.6167]); // Default Argentina center
  const [hasCustomCoords, setHasCustomCoords] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  const provincesList = getProvinces();
  const availableDepartments = getDepartments(formData.province);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'province') {
      const center = getProvinceCenter(value);
      if (center && !hasCustomCoords) {
        setMapCenter(center);
      }
      // Reset department when province changes manually
      setFormData((prev) => ({ ...prev, province: value, department: '' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectSearchResult = (result: AddressSearchResult) => {
    setMapCenter([result.lat, result.lng]);
    setHasCustomCoords(true);

    setFormData((prev) => {
      const nextProvince = result.province && provincesList.includes(result.province) ? result.province : prev.province;
      const deptList = getDepartments(nextProvince);
      const nextDepartment =
        result.department && deptList.includes(result.department) ? result.department : prev.department;

      return {
        ...prev,
        address: result.address,
        province: nextProvince,
        department: nextDepartment,
      };
    });
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning('Por favor ingresá el nombre del campo.');
      return;
    }
    if (!formData.province) {
      toast.warning('Por favor seleccioná una provincia.');
      return;
    }
    if (formData.renspa && !RENSPA_FORMAT.test(formData.renspa)) {
      toast.warning('El RENSPA está incompleto. Dejalo vacío o completalo entero (formato XX.XXX.X.XXXXX/XX).');
      return;
    }

    // If address wasn't picked via search, update center to chosen province
    if (!hasCustomCoords && formData.province) {
      const center = getProvinceCenter(formData.province);
      if (center) {
        setMapCenter(center);
      }
    }

    setStep(2);
  };

  const handlePolygonChange = (newPoints: [number, number][]) => {
    setPolygonPoints(newPoints);
    const calculatedHa = calculatePolygonAreaHa(newPoints);
    if (calculatedHa > 0) {
      setFormData((prev) => ({ ...prev, totalAreaHa: String(calculatedHa) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.totalAreaHa || Number(formData.totalAreaHa) <= 0) {
      toast.warning('Ingresá una superficie válida en hectáreas o delimitá el campo en el mapa.');
      return;
    }

    try {
      const rawAddress = formData.address.trim();
      let fullAddress = rawAddress;
      if (!fullAddress) {
        fullAddress = formData.department ? `Zona Rural, ${formData.department}` : `Zona Rural, ${formData.province}`;
      } else if (formData.department && !fullAddress.includes(formData.department)) {
        fullAddress = `${fullAddress} (${formData.department})`;
      }

      const farm = await createFarm({
        name: formData.name.trim(),
        address: fullAddress.trim(),
        province: formData.province,
        totalAreaHa: Number(formData.totalAreaHa),
        polygonCoordinates: polygonPoints.length > 0 ? polygonPoints : undefined,
        renspa: formData.renspa || undefined,
      });

      toast.success('Establecimiento registrado con éxito');
      // Item 3.1.4 del análisis UX/UI: redirigir directo a alta de animal era un salto abrupto
      // — sin zonas ni cercos todavía, no hay dónde asignar el animal. El paso lógico siguiente
      // es delimitar zonas/lotes.
      router.push(farm ? `/zonas?farmId=${farm.id}` : '/zonas');
    } catch {
      // Error handled by mutation state
    }
  };

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="el Alta y Gestión de Campos" />;
  }

  return (
    <div className={`py-10 px-4 md:px-8 mx-auto space-y-8 transition-all duration-200 ${step === 2 ? 'max-w-6xl' : 'max-w-3xl'}`}>
      {/* Navigation & Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Registrar Nuevo Campo</h1>
      </div>

      {/* Wizard Progress Indicator */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`border rounded-xl p-4 flex items-center gap-3 transition-all ${
            step === 1
              ? 'bg-green-50/50 dark:bg-green-950/20 border-green-500/40 text-green-700 dark:text-green-400'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 1 ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            1
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Paso 1</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Identificación</p>
          </div>
        </div>

        <div
          className={`border rounded-xl p-4 flex items-center gap-3 transition-all ${
            step === 2
              ? 'bg-green-50/50 dark:bg-green-950/20 border-green-500/40 text-green-700 dark:text-green-400'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 2 ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            2
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Paso 2</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Delimitación</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      {/* STEP 1 FORM */}
      {step === 1 && (
        <form
          onSubmit={handleNextStep}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 md:p-8 space-y-6"
        >
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" /> Identificación y Locación
          </h2>

          <div className="space-y-5">
            {/* Nombre del campo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                Nombre del Campo / Establecimiento *
              </label>
              <input
                required
                type="text"
                name="name"
                value={formData.name}
                onChange={handleTextChange}
                placeholder="Ej: Estancia Don Silvestre, Campo Norte"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
              />
            </div>

            {/* Buscador de Dirección (Google Maps Argentina) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                Buscador de Dirección / Ubicación (Opcional)
              </label>
              <GoogleAddressSearch
                value={formData.address}
                onChange={(val) => setFormData((prev) => ({ ...prev, address: val }))}
                onSelectResult={handleSelectSearchResult}
                placeholder="Ej: Ruta 205 Km 90, o buscar por localidad..."
              />
              <p className="text-[11px] text-zinc-400">
                Si tu campo no posee dirección formal de calle, podés dejarlo en blanco y seleccionarlo en el mapa en el
                paso 2.
              </p>
            </div>

            {/* Provincia y Departamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Selector de Provincia */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Provincia *
                </label>
                <div className="relative">
                  <select
                    required
                    name="province"
                    value={formData.province}
                    onChange={handleTextChange}
                    className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-4 pr-10 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer"
                  >
                    <option value="">Seleccioná una Provincia</option>
                    {provincesList.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Selector de Departamento / Partido */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                  Departamento / Partido
                </label>
                <div className="relative">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleTextChange}
                    disabled={!formData.province}
                    className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-4 pr-10 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 text-sm cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Seleccioná un Departamento</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* RENSPA (SENASA) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider">
                RENSPA (Opcional)
              </label>
              <input
                type="text"
                name="renspa"
                inputMode="numeric"
                value={formData.renspa}
                onChange={(e) => setFormData((prev) => ({ ...prev, renspa: formatRenspa(e.target.value) }))}
                placeholder="01.001.0.00001/00"
                maxLength={18}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 text-sm font-mono"
              />
              <p className="text-[11px] text-zinc-400">
                Registro Nacional Sanitario de Productores Agropecuarios — necesario para trazabilidad ganadera y
                Documentos de Tránsito Electrónico.
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" variant="success" size="md">
              Siguiente
            </Button>
          </div>
        </form>
      )}

      {/* STEP 2 FORM */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Ruler className="w-5 h-5 text-green-600" /> Paso 2: Delimitación del Campo
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Trazá el perímetro sobre el mapa satelital. Marcá los vértices de cada esquina de tu establecimiento.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {formData.name || 'Establecimiento'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Map canvas */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
                <PolygonDrawerMap
                  points={polygonPoints}
                  onChangePoints={handlePolygonChange}
                  center={mapCenter}
                  zoom={15}
                  selectedVertexIndex={selectedVertexIndex}
                  onSelectVertex={setSelectedVertexIndex}
                  strokeColor="#16a34a"
                  fillColor="#22c55e"
                />
              </div>

              {/* Navigation buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Volver a Identificación
                </Button>

                <Button type="submit" variant="success" size="md" disabled={loading}>
                  {loading ? 'Guardando...' : 'Registrar Campo'}
                </Button>
              </div>
            </div>

            {/* Right Column: Interactive Vertices and Exact Coordinates Panel */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-4 sticky top-6">
                {/* Header with Vertices Count & Quick Actions */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    Vértices Colocados ({polygonPoints.length})
                  </span>

                  {polygonPoints.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(
                              new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
                            );
                          }
                        }}
                        className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold cursor-pointer text-xs flex items-center gap-1"
                        title="Deshacer última acción (Ctrl + Z)"
                      >
                        <span>Deshacer</span>
                        <kbd className="px-1 py-0.2 bg-zinc-200 dark:bg-zinc-800 text-[10px] rounded text-zinc-500">
                          Ctrl+Z
                        </kbd>
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          handlePolygonChange([]);
                          setSelectedVertexIndex(null);
                        }}
                        className="text-red-500 hover:text-red-600 font-semibold cursor-pointer text-xs"
                      >
                        Reiniciar
                      </button>
                    </div>
                  )}
                </div>

                {/* Real-time Calculated Surface Area */}
                <div className="p-3.5 rounded-xl bg-green-50/60 dark:bg-green-950/20 border border-green-200/80 dark:border-green-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-green-800 dark:text-green-400">
                      Superficie Calculada
                    </div>
                    <div className="text-[11px] text-green-700/70 dark:text-green-500">
                      Proyección cartográfica equivalente
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-green-700 dark:text-green-300">
                    {formData.totalAreaHa && Number(formData.totalAreaHa) > 0 ? `${formData.totalAreaHa} Ha` : '0.00 Ha'}
                  </span>
                </div>

                {/* Vertices List or Empty State */}
                {polygonPoints.length === 0 ? (
                  <div className="text-xs text-zinc-400 italic bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-1">
                    <p className="font-medium text-zinc-600 dark:text-zinc-300">
                      Ningún vértice marcado todavía
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Hacé clics sobre el mapa para marcar las esquinas del campo. Podés arrastrar cualquier punto para corregirlo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs px-1 text-zinc-500">
                      <span>Coordenadas exactas (Lat, Lng):</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {polygonPoints.length} esquinas
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {polygonPoints.map((pt, idx) => {
                        const isSelected = selectedVertexIndex === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedVertexIndex(isSelected ? null : idx)}
                            className={`flex justify-between items-center border rounded-xl px-2.5 py-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 shadow-xs'
                                : 'border-zinc-200/70 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850/60 bg-white dark:bg-zinc-900'
                            }`}
                          >
                            <span className="font-sans flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full text-[10px] font-extrabold inline-flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className={isSelected ? 'font-bold text-amber-950 dark:text-amber-200' : 'font-medium text-zinc-800 dark:text-zinc-200'}>
                                Vértice #{idx + 1}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                  Activo
                                </span>
                              )}
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[11px]">
                                {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                              </span>
                              <button
                                type="button"
                                title="Eliminar este vértice"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = polygonPoints.filter((_, i) => i !== idx);
                                  handlePolygonChange(updated);
                                  if (selectedVertexIndex === idx) setSelectedVertexIndex(null);
                                  else if (selectedVertexIndex !== null && selectedVertexIndex > idx)
                                    setSelectedVertexIndex(selectedVertexIndex - 1);
                                }}
                                className="text-zinc-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedVertexIndex !== null && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                        <span>
                          📍 Vértice #{selectedVertexIndex + 1} activo para inserción contigua.
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedVertexIndex(null)}
                          className="underline hover:no-underline font-semibold cursor-pointer ml-1"
                        >
                          Deseleccionar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Field Details summary */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                  <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {formData.name || 'Campo nuevo'}
                  </div>
                  <div>
                    {formData.department ? `${formData.department}, ` : ''}
                    {formData.province || 'Argentina'}
                  </div>
                  {formData.renspa && (
                    <div className="font-mono text-[11px] text-zinc-400">
                      RENSPA: {formData.renspa}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
