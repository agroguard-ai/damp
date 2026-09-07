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
import { MapPin, Ruler, ChevronDown } from 'lucide-react';

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

  return (
    <div className="py-10 px-4 md:px-8 max-w-3xl mx-auto space-y-8">
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
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 md:p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Ruler className="w-5 h-5 text-green-600" /> Delimitación
            </h2>
          </div>

          {/* Interactive Satellite Polygon Drawer */}
          <PolygonDrawerMap points={polygonPoints} onChangePoints={handlePolygonChange} center={mapCenter} zoom={15} />

          {/* Superficie Total Calculation & Override */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider block">
                  Superficie Total (Hectáreas)
                </label>
              </div>
              <div className="flex items-center gap-2 sm:w-48 shrink-0">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="totalAreaHa"
                  value={formData.totalAreaHa}
                  onChange={(e) => setFormData((prev) => ({ ...prev, totalAreaHa: e.target.value }))}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white font-bold text-base focus:outline-none focus:ring-1 focus:ring-green-500 text-right"
                />
                <span className="text-xs font-bold text-zinc-500">Ha</span>
              </div>
            </div>
          </div>

          {/* Step 2 Actions */}
          <div className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setStep(1)}>
              Anterior
            </Button>

            <Button type="submit" variant="success" size="md" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar Campo'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
