import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans">
      <Sidebar />

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">{children}</main>
      </div>
    </div>
  );
}
