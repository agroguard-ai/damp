import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/proxy';
import { NavThemeProvider } from '@/context/NavThemeContext';
import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { Problem } from '@/components/landing/Problem';
import { Features } from '@/components/landing/Features';
import { CollarExplode } from '@/components/landing/CollarExplode';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ArchitectureSection } from '@/components/landing/ArchitectureSection';
import { Plans } from '@/components/landing/Plans';
import { Founders } from '@/components/landing/Founders';
import { Faq } from '@/components/landing/Faq';
import { CtaBanner } from '@/components/landing/CtaBanner';
import { Footer } from '@/components/landing/Footer';
import { SmoothScroll } from '@/components/landing/SmoothScroll';

export default async function LandingPage() {
  const cookieStore = await cookies();
  const isSignedIn = Boolean(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  return (
    <NavThemeProvider>
      <SmoothScroll />
      <div className="min-h-screen bg-background text-foreground overflow-x-clip">
        <div className="bg-primary-950 px-4 sm:px-6 py-2 text-center text-xs sm:text-sm font-medium text-white">
          Prototipo en desarrollo · Buscamos campos para prueba piloto
        </div>
        <Nav isSignedIn={isSignedIn} />
        <Hero />
        <StatsStrip />
        <Problem />
        <Features />
        <CollarExplode />
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
