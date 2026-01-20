import Link from "next/link";
import { getDictionary } from "../lib/dictionaries";
import { use } from "react"; // Next.js 15+ params handling

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const dict = getDictionary(lang);

  // You can extend your dictionary or just use these static strings for the landing page
  const content = {
    heroTitle: lang === 'pt-BR' ? "Organize sua vida com IA" : "Organize your life with AI",
    heroSubtitle: lang === 'pt-BR' 
      ? "Gerencie tarefas com comandos de voz, categorização inteligente e sincronização em tempo real."
      : "Manage tasks with voice commands, intelligent categorization, and real-time synchronization.",
    cta: lang === 'pt-BR' ? "Começar Agora" : "Get Started",
    features: [
      {
        title: lang === 'pt-BR' ? "Comandos de Voz" : "Voice Commands",
        desc: lang === 'pt-BR' ? "Adicione tarefas apenas falando. Diga a palavra mágica e comece." : "Add tasks just by speaking. Say the wake word and go.",
        icon: (
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )
      },
      {
        title: lang === 'pt-BR' ? "Categorização IA" : "AI Categorization",
        desc: lang === 'pt-BR' ? "Suas tarefas são organizadas automaticamente por contexto e data." : "Your tasks are automatically organized by context and date.",
        icon: (
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
      },
      {
        title: lang === 'pt-BR' ? "Sincronização Cloud" : "Cloud Sync",
        desc: lang === 'pt-BR' ? "Acesse suas tarefas em qualquer dispositivo com login Google." : "Access your tasks on any device with Google login.",
        icon: (
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        )
      }
    ]
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-white flex flex-col font-sans">
      {/* HEADER */}
      <header className="px-6 py-6 flex items-center max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">{dict.title}</span>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12 sm:py-20 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-block mb-4 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold tracking-wide uppercase">
          v1.0 Beta
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          {content.heroTitle}
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mb-10 leading-relaxed">
          {content.heroSubtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link 
            href={`/app`}
            className="px-8 py-4 bg-blue-600 text-white rounded-full font-bold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
          >
            {content.cta}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </main>

      {/* FEATURES GRID */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {content.features.map((feature, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-8 text-center text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} Task Organizer AI. By <a className="hover:text-blue-500 transition-colors cursor-pointer" href="https://www.linkedin.com/in/gabriel-chv" target="_blank" rel="noreferrer">Gabriel Chaves</a>.</p>
      </footer>
    </div>
  );
}