import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';

export function CtaBanner() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-primary-950 px-8 py-16 sm:px-16 text-center">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_50%,black,transparent)]"
        />
        <div className="relative">
          <Lock className="w-8 h-8 text-secondary-300 mx-auto" />
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Empezá a monitorear tu campo hoy
          </h2>
          <p className="mt-3 text-primary-100 max-w-xl mx-auto">
            Sumate a DAMP Agro y llevá tu operación ganadera a un estándar de precisión y seguridad multi-tenant.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="mailto:ventas@damp.com"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white text-primary-900 hover:bg-primary-50 transition-colors shadow-md"
            >
              Contactar a Ventas
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
