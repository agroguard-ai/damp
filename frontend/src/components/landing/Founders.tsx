'use client';

import Image from 'next/image';
import { Link, Mail } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const founders = [
  {
    name: 'Matias Luhmann',
    image: '/pictures/matias_profile_picture.png',
    linkedin: 'https://www.linkedin.com/in/matiasluhmann/',
    email: 'mailto:luhmannm0@gmail.com',
  },
  {
    name: 'Santino Cataldi',
    image: '/pictures/santino_profile_picture.png',
    linkedin: 'https://www.linkedin.com/in/santino-cataldi/',
    email: 'mailto:cataldisantinonanu@gmail.com',
  },
  {
    name: 'Tomas Wardoloff',
    image: '/pictures/tomas_profile_picture.png',
    linkedin: 'https://www.linkedin.com/in/tomaswardoloff/',
    email: 'mailto:tomaswardoloff@gmail.com',
  },
];

export function Founders() {
  const gridRef = useScrollReveal<HTMLDivElement>({ stagger: 0.1 });

  return (
    <section id="equipo" className="mx-auto max-w-7xl px-page-sm sm:px-page py-section-sm sm:py-section scroll-mt-20">
      <div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Quiénes somos?</h2>

        <div className="mt-stack space-y-stack text-muted text-lg leading-relaxed">
          <p>Somos Matías Luhmann, Santino Cataldi y Tomás Wardoloff. Tres estudiantes de Ingeniería en Sistemas</p>
          <p>
            Entendemos que para un productor o administrador, nada importa más que la tranquilidad de saber que su
            ganado está seguro y saludable. Sin embargo, las grandes distancias, la falta de señal en el potrero y los
            métodos tradicionales hacen que gestionar un campo sea más difícil de lo necesario.
          </p>
          <p>
            Por eso creamos DAMP Agro como nuestro Trabajo Final de Carrera. Un sistema integral que une collares IoT,
            cercos virtuales e inteligencia artificial.
          </p>
        </div>
      </div>

      <div className="mt-group relative w-full h-64 sm:h-96 lg:h-120 rounded-2xl overflow-hidden border border-border shadow-lg bg-surface-raised">
        <Image
          src="/pictures/grupo.jpeg"
          alt="Fotografía del equipo fundador de DAMP Agro: Matías, Santino y Tomás"
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          style={{ objectPosition: 'center 26%' }}
          className="object-cover -scale-x-100"
        />
      </div>

      <div
        ref={gridRef}
        className="mt-group grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border rounded-2xl border border-border overflow-hidden shadow-xs bg-surface"
      >
        {founders.map((founder, index) => (
          <div
            key={founder.name}
            className={`p-6 text-center flex flex-col items-center ${
              index === 0
                ? 'rounded-t-2xl sm:rounded-tr-none sm:rounded-l-2xl'
                : index === founders.length - 1
                  ? 'rounded-b-2xl sm:rounded-bl-none sm:rounded-r-2xl'
                  : 'rounded-none'
            }`}
          >
            <div className="relative w-18 h-18 rounded-full overflow-hidden shadow-md">
              <Image
                src={founder.image}
                alt={`Fotografía de ${founder.name}`}
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>
            <h3 className="mt-stack-tight font-semibold text-lg text-foreground">{founder.name}</h3>
            <div className="mt-stack flex items-center justify-center gap-4">
              <a
                href={founder.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Perfil de LinkedIn de ${founder.name}`}
                className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary-700 hover:border-primary-600 transition-colors"
              >
                <Link className="w-4 h-4" />
              </a>
              <a
                href={founder.email}
                aria-label={`Enviar correo a ${founder.name}`}
                className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted hover:text-primary-700 hover:border-primary-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
