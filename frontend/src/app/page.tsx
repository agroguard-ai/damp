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

        <Link
          href="/animals/new"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-black bg-white hover:bg-zinc-200 transition-colors"
        >
          Registrar Nuevo Animal
        </Link>
      </main>
    </div>
  );
}
