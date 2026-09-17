import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/proxy';
import { NavThemeProvider } from '@/context/NavThemeContext';
import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { Problem } from '@/components/landing/Problem';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ArchitectureSection } from '@/components/landing/ArchitectureSection';
import { Plans } from '@/components/landing/Plans';
import { Founders } from '@/components/landing/Founders';
import { Faq } from '@/components/landing/Faq';
import { CtaBanner } from '@/components/landing/CtaBanner';
import { Footer } from '@/components/landing/Footer';

export default async function LandingPage() {
  const cookieStore = await cookies();
  const isSignedIn = Boolean(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  return (
    <NavThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="bg-primary-950 px-6 py-2 text-center text-sm font-medium text-white">
          Prototipo en desarrollo · Buscamos campos para prueba piloto
        </div>
        <Nav isSignedIn={isSignedIn} />
        <Hero />
        <StatsStrip />
        <Problem />
        <Features />
        <HowItWorks />
        <ArchitectureSection />
        <Plans />
        <Founders />
        <Faq />
        <CtaBanner />
        <Footer />
      </div>
    </NavThemeProvider>
  );
}
