'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const faqs = [
  {
    question: '¿DAMP Agro es un producto comercial disponible hoy?',
    answer: 'Hoy en día DAMP Agro se encuentra en fase de desarrollo y todavía no está disponible para la venta.',
  },
  {
    question: '¿Qué hardware requiere la plataforma para funcionar?',
    answer: 'Un collar LoRa con microcontrolador ESP32-S3 por animal y un gateway Heltec V3 por establecimiento.',
  },
  {
    question: '¿Cómo detecta la IA los problemas de salud?',
    answer:
      'Utiliza un modelo BiLSTM que analiza secuencias de 24hs de telemetría (temperatura corporal, movimiento y patrón horario) para anticipar cuadros de fiebre o inactividad hasta 6 horas antes.',
  },
  {
    question: '¿Mis datos están aislados de los de otros campos?',
    answer:
      'Sí. Vada establecimiento accede de forma aislada a sus propios animales, collares y alertas, con control de acceso por roles.',
  },
  {
    question: '¿Necesito internet en todo el potrero para que funcione?',
    answer:
      'No. Los collares transmiten por radiofrecuencia LoRa, un protocolo de ultra bajo consumo y largo alcance. Únicamente el gateway central instalado en el casco requiere conexión a internet.',
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const listRef = useScrollReveal<HTMLDivElement>({ stagger: 0.05 });

  return (
    <section id="preguntas-frecuentes" className="mx-auto max-w-3xl px-6 py-24 scroll-mt-20">
      <div className="text-center">
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">Preguntas frecuentes</h2>
      </div>

      <div ref={listRef} className="mt-12 divide-y divide-border border-y border-border">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
                className="w-full flex items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-semibold">{faq.question}</span>
                <ChevronDown
                  className={`w-4.5 h-4.5 shrink-0 text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                id={`faq-answer-${index}`}
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <p className="pb-5 text-muted leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
