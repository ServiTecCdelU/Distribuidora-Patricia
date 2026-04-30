'use client'

import { StoreFront } from '@/app/tienda/page'

export default function HomePage() {
  return (
    <StoreFront
      showHeader
      showBackButton={false}
      publicMode
    />
  )
}
