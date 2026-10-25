'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/context/ConfirmDialogContext';
import { useToast } from '@/context/ToastContext';
import { useFarmPermissions, FARM_ROLE_LABELS } from '@/hooks/useFarmPermissions';
import { AccessDeniedState } from '@/components/roles/AccessDeniedState';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { UserPlus, Key, Copy, Check, X, Pencil, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';

// El administrador de campos crea su personal solo como operador o lector, con el mismo rol en
// todos los campos que le asigne (el backend valida que esos campos sean suyos).
const STAFF_ROLES = ['OPERATOR', 'VIEWER'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];
const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({ value: r, label: FARM_ROLE_LABELS[r] }));

interface FarmOption {
  id: string;
  name: string | null;
}

interface StaffRecord {
  id: string;
  name: string | null;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
  roleName: StaffRole;
  farms: FarmOption[];
}

/** null: modal cerrado; { id: null }: alta; { id }: edición. */
type FormTarget = { id: string | null } | null;

const inputClass =
  'w-full px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500';

async function errorMessage(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  return Array.isArray(data.message) ? data.message.join('. ') : data.message || fallback;
}

export function StaffList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const { isFarmAdmin, isPlatformAdmin, loading: authLoading } = useFarmPermissions();
  const [farms, setFarms] = useState<FarmOption[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>('OPERATOR');
  const [formFarmIds, setFormFarmIds] = useState<string[]>([]);
  const [formPassword, setFormPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [credentials, setCredentials] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Mismo patrón fetch-on-mount que el resto de las listas de roles (ver AdminUserList):
  // dispara react-hooks/set-state-in-effect y no hay una reestructuración razonable sin useApi.
  /* eslint-disable */
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff');
      if (!res.ok) {
        throw new Error(await errorMessage(res, 'No se pudo cargar tu personal.'));
      }
      const data = (await res.json()) as { farms: FarmOption[]; staff: StaffRecord[] };
      setFarms(data.farms);
      setStaff(data.staff);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFarmAdmin) void fetchStaff();
  }, [fetchStaff, isFarmAdmin]);
  /* eslint-enable */

  const openCreate = () => {
    setFormTarget({ id: null });
    setFormName('');
    setFormEmail('');
    setFormRole('OPERATOR');
    // Con un solo campo no hay nada que elegir: queda marcado.
    setFormFarmIds(farms.length === 1 ? [farms[0].id] : []);
    setFormPassword('');
  };

  const openEdit = (s: StaffRecord) => {
    setFormTarget({ id: s.id });
    setFormName(s.name ?? '');
    setFormEmail(s.email);
    setFormRole(s.roleName);
    setFormFarmIds(s.farms.map((f) => f.id));
    setFormPassword('');
  };

  const toggleFarm = (farmId: string) => {
    setFormFarmIds((prev) => (prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTarget) return;
    if (formFarmIds.length === 0) {
      toast.warning('Asigná al menos un campo.');
      return;
    }

    const isCreate = formTarget.id === null;
    try {
      setSaving(true);
      const res = await fetch(isCreate ? '/api/staff' : `/api/staff/${formTarget.id}`, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isCreate
            ? {
                name: formName,
                email: formEmail,
                roleName: formRole,
                farmIds: formFarmIds,
                initialPassword: formPassword || undefined,
              }
            : { name: formName, roleName: formRole, farmIds: formFarmIds }
        ),
      });
      if (!res.ok) {
        throw new Error(
          await errorMessage(res, isCreate ? 'Error al crear la persona' : 'Error al guardar los cambios')
        );
      }

      if (isCreate) {
        const data = (await res.json()) as { user: StaffRecord; temporaryPassword: string };
        setCredentials({ email: data.user.email, pass: data.temporaryPassword });
        toast.success('Persona agregada a tu personal');
      } else {
        toast.success('Cambios guardados');
      }
      setFormTarget(null);
      void fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (s: StaffRecord) => {
    const ok = await confirm({
      title: 'Generar nueva contraseña',
      description: `Se le asignará a "${s.name || s.email}" una contraseña temporal nueva y la actual dejará de funcionar. Deberá cambiarla al ingresar.`,
      confirmLabel: 'Generar contraseña',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/staff/${s.id}/reset-password`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(await errorMessage(res, 'Error al generar la contraseña'));
      }
      const data = (await res.json()) as { temporaryPassword: string };
      setCredentials({ email: s.email, pass: data.temporaryPassword });
      void fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al generar la contraseña');
    }
  };

  const handleRemove = async (s: StaffRecord) => {
    const ok = await confirm({
      title: 'Dar de baja del personal',
      description: `"${s.name || s.email}" pierde el acceso a todos tus campos y su cuenta queda desactivada. Podés volver a darlo de alta más adelante con el mismo email.`,
      confirmLabel: 'Dar de baja',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/staff/${s.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(await errorMessage(res, 'Error al dar de baja'));
      }
      toast.success('Persona dada de baja');
      void fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al dar de baja');
    }
  };

  const handleCopyCredentials = () => {
    if (!credentials) return;
    const text = `Acceso a DAMP Agro:\nUsuario: ${credentials.email}\nContraseña Temporal: ${credentials.pass}\n(Deberás cambiar la contraseña en tu primer ingreso)`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!authLoading && isPlatformAdmin) {
    return <EmulationRequiredState title="la Gestión de Personal" />;
  }

  if (!authLoading && !isFarmAdmin) {
    return (
      <AccessDeniedState
        description="Solo el administrador de campos puede gestionar el personal y sus accesos."
        backHref="/dashboard"
      />
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-zinc-500 dark:text-zinc-400 font-medium">Cargando tu personal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {credentials && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
              <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              Compartí estas credenciales provisionales con la persona:
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300 break-all">
              <span className="font-semibold">Email:</span> {credentials.email} |{' '}
              <span className="font-semibold">Clave temporal:</span>{' '}
              <code className="bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono font-bold text-amber-950 dark:text-amber-100 border border-amber-300/50 dark:border-amber-700/50">
                {credentials.pass}
              </code>
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400">
              * No se vuelve a mostrar. Deberá cambiarla obligatoriamente en su primer inicio de sesión.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar Credenciales'}
            </button>
            <button
              onClick={() => setCredentials(null)}
              className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Tu personal</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Operadores y lectores de tus campos. Cada persona tiene el mismo rol en todos sus campos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 text-xs font-semibold px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
              Integrantes: {staff.length}
            </span>
            <button
              onClick={openCreate}
              disabled={farms.length === 0}
              title={farms.length === 0 ? 'Registrá un campo antes de crear personal' : undefined}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              Nueva persona
            </button>
          </div>
        </div>

        {farms.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-3">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Todavía no tenés campos registrados. Registrá tu primer campo para poder asignarle personal.
            </p>
            <Button href="/farms/new" variant="success" size="md" label="Registrar campo" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-400 uppercase font-semibold text-xs border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5">Nombre / Email</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5">Campos</th>
                  <th className="px-6 py-3.5">Estado Clave</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-white">{s.name || 'Sin nombre'}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                        {FARM_ROLE_LABELS[s.roleName]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {s.farms.map((f) => (
                          <span
                            key={f.id}
                            className="rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300"
                          >
                            {f.name || 'Campo sin nombre'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {s.mustChangePassword ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          Provisional
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          Clave definitiva
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Editar rol y campos"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void handleResetPassword(s)}
                          className="p-1.5 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Generar nueva contraseña temporal"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void handleRemove(s)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-semibold hover:underline cursor-pointer"
                        >
                          Dar de baja
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500">
                      Todavía no agregaste personal a tus campos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {formTarget.id === null ? 'Nueva persona' : 'Editar persona'}
              </h3>
              <button
                onClick={() => setFormTarget(null)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Pedro Gómez"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={formTarget.id !== null}
                  placeholder="pedro@ejemplo.com"
                  className={`${inputClass} disabled:opacity-60`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Rol</label>
                <Select value={formRole} onChange={(v) => setFormRole(v as StaffRole)} options={ROLE_OPTIONS} />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {formRole === 'OPERATOR'
                    ? 'Carga y edita datos (animales, collares, cercos). No gestiona personal ni alertas.'
                    : 'Solo puede consultar la información de sus campos.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Campos asignados</label>
                <div className="space-y-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
                  {farms.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2.5 text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formFarmIds.includes(f.id)}
                        onChange={() => toggleFarm(f.id)}
                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                      />
                      {f.name || 'Campo sin nombre'}
                    </label>
                  ))}
                </div>
              </div>

              {formTarget.id === null && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Contraseña temporal <span className="font-normal text-zinc-400">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Dejar vacío para generar automáticamente"
                    minLength={8}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setFormTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : formTarget.id === null ? 'Crear persona' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
