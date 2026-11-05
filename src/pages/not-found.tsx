import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="nf-title">
      <p className="text-6xl font-bold text-brand" aria-hidden>
        404
      </p>
      <h1 id="nf-title" className="text-2xl font-bold text-cream">
        Página não encontrada
      </h1>
      <p className="max-w-md text-sand">O endereço acessado não existe ou foi movido. Que tal voltar ao mercado?</p>
      <Link to="/" className="rounded-sm bg-brand px-6 py-3 font-bold text-ink hover:bg-brand-accent">
        Voltar ao início
      </Link>
    </section>
  )
}
