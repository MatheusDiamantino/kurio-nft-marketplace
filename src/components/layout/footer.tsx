import { useId, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { CollectionSlug } from '@/api/contracts'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/brand-icons'
import { SoonLink, notifySoon } from '@/components/soon'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_COLLECTIONS: { slug: CollectionSlug; label: string }[] = [
  { slug: 'arte-digital', label: 'Arte digital' },
  { slug: 'fotografia', label: 'Fotografia' },
  { slug: 'musica', label: 'Música' },
  { slug: 'arte-3d', label: 'Arte 3D' },
  { slug: 'utilidade', label: 'Utilidade' },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://instagram.com', Icon: InstagramIcon },
  { label: 'Twitter', href: 'https://twitter.com', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://youtube.com', Icon: YoutubeIcon },
]

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError('Informe um e-mail válido.')
      return
    }
    setError(null)
    // Newsletter is out of scope: say so instead of faking a subscription.
    notifySoon('A inscrição na newsletter')
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-base leading-4 font-bold text-cream">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex">
        <label htmlFor={`${id}-email`} className="sr-only">
          Seu e-mail
        </label>
        <input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : `${id}-help`}
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-line bg-surface-dark/40 px-3 text-sm text-cream placeholder:text-tan"
        />
        <button type="submit" className="h-10 rounded-r-sm bg-brand px-4 text-base font-bold text-ink hover:bg-brand-accent">
          Enviar
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-help`} className="text-[13px] leading-[22px] text-sand">
          Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
        </p>
      )}
    </form>
  )
}

export function Footer() {
  return (
    <footer className="container-page mt-16 pb-24 md:mt-24 md:pb-6">
      <div className="overflow-hidden rounded-sm bg-surface">
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:px-12">
          {FEATURES.map((f) => (
            <div key={f.letter} className="flex flex-col gap-3 lg:border-r lg:border-brand lg:px-6 lg:first:pl-0">
              <span aria-hidden className="grid size-[66px] place-items-center rounded-full bg-brand text-xl font-bold text-ink">
                {f.letter}
              </span>
              <h2 className="text-base font-bold text-cream">{f.title}</h2>
              <p className="text-sm leading-[22px] text-brand">{f.text}</p>
            </div>
          ))}
          <div className="lg:pl-4">
            <Newsletter />
          </div>
        </div>

        <div className="grid gap-3 bg-surface-dark px-6 py-6 text-sm text-cream sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:px-8">
          <span className="font-bold tracking-[0.1em]">KURIO</span>
          <span className="leading-[22px]">Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-brand-accent">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-brand-accent">
            +55 11 4002 8922
          </a>
        </div>

        <div className="grid gap-8 px-6 py-8 text-sm text-cream sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <nav aria-labelledby="ft-profile">
            <h2 id="ft-profile" className="mb-3 text-base font-bold">
              Meu perfil
            </h2>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link to="/account/profile" className="hover:text-brand-accent">
                  Meu perfil
                </Link>
              </li>
              <li>
                <SoonLink label="Minha coleção" />
              </li>
              <li>
                <SoonLink label="Atividade" />
              </li>
              <li>
                <SoonLink label="Estúdio do criador" />
              </li>
              <li>
                <Link to="/account/favorites" className="hover:text-brand-accent">
                  Lista de interesse
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-labelledby="ft-help">
            <h2 id="ft-help" className="mb-3 text-base font-bold">
              Central de ajuda
            </h2>
            <ul className="flex flex-col gap-2.5">
              {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => (
                <li key={l}>
                  <SoonLink label={l} />
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="ft-coll">
            <h2 id="ft-coll" className="mb-3 text-base font-bold">
              Coleções
            </h2>
            <ul className="flex flex-col gap-2.5">
              {FOOTER_COLLECTIONS.map((c) => (
                <li key={c.slug}>
                  <Link to="/" search={{ collection: [c.slug] }} hash="catalogo" className="hover:text-brand-accent">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-3 text-base font-bold">Redes sociais</h2>
              <ul className="flex gap-2">
                {SOCIAL.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} (abre em nova aba)`}
                      className="grid size-8 place-items-center rounded-sm border border-brand text-brand hover:bg-surface-dark"
                    >
                      <Icon />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-base font-bold">Carteiras compatíveis</h2>
              <WalletChip />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[13px] text-cream">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

export function WalletChip() {
  return (
    <p className="inline-flex flex-wrap items-center gap-1.5 rounded-sm border border-line-soft bg-surface-dark px-2 py-1 text-[9px] font-bold tracking-[0.01em] text-brand">
      <span>METAMASK</span>
      <span aria-hidden>•</span>
      <span>WALLETCONNECT</span>
      <span aria-hidden>•</span>
      <span>COINBASE</span>
    </p>
  )
}
