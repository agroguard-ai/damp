import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          DAMP Project
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 mb-8">
          Plataforma integral de monitoreo biométrico
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/farms/new"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-zinc-800 text-base font-medium rounded-xl text-white bg-zinc-900 hover:bg-zinc-850 transition-colors"
          >
            Registrar Nuevo Campo
          </Link>
          <Link
            href="/animals/new"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-black bg-white hover:bg-zinc-200 transition-colors"
          >
            Registrar Nuevo Animal
          </Link>
          <Link
            href="/animals"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-green-500/20 text-base font-medium rounded-xl text-green-400 bg-green-500/5 hover:bg-green-500/10 transition-colors"
          >
            Ver Panel de Monitoreo
          </Link>
        </div>
      </main>
    </div>
  );
}
