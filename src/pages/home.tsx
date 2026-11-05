import { useEffect } from 'react'
import { Catalog, MobileSearchBar } from '@/components/home/catalog'
import { Blog, Promos } from '@/components/home/editorial'
import { Hero } from '@/components/home/hero'

export function HomePage() {
  useEffect(() => {
    document.title = 'Kurio | Marketplace de NFTs'
  }, [])

  return (
    <div className="pb-4">
      <MobileSearchBar />
      <Hero />
      <Catalog />
      <Promos />
      <Blog />
    </div>
  )
}
