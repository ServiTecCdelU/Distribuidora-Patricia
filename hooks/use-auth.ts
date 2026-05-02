'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/lib/types'
import { onAuthChange, signOut } from '@/services/auth-service'
import { ensureUserProfile } from '@/services/users-service'

// Caché en memoria del perfil — evita re-leer Firestore en cada navegación
let cachedProfile: { uid: string; user: User } | null = null

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(cachedProfile?.user ?? null)
  const [loading, setLoading] = useState(!cachedProfile)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        cachedProfile = null
        setUser(null)
        setLoading(false)
        return
      }

      // Si ya tenemos el perfil cacheado para este uid, usarlo directamente
      if (cachedProfile && cachedProfile.uid === firebaseUser.uid) {
        setUser(cachedProfile.user)
        setLoading(false)
        return
      }

      const profile = await ensureUserProfile({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
      })
      if (!profile.isActive) {
        cachedProfile = null
        await signOut()
        setUser(null)
        setLoading(false)
        return
      }
      cachedProfile = { uid: firebaseUser.uid, user: profile }
      setUser(profile)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}

/** Invalida el caché del perfil (usar tras cambios de rol, etc.) */
export const invalidateAuthCache = () => {
  cachedProfile = null
}
