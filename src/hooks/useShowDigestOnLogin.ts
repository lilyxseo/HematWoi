import { useCallback, useEffect, useRef, useState } from "react"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import { supabase } from "../lib/supabase"

dayjs.extend(utc)
dayjs.extend(timezone)

const TIMEZONE = "Asia/Jakarta"

function todayKey(): string {
  return dayjs().tz(TIMEZONE).format("YYYY-MM-DD")
}

function buildStorageKey(date: string, userId: string): string {
  return `hw_digest_seen_${date}_${userId}`
}

function readFlag(userId: string, date: string): { seen: boolean; value: string | null } {
  if (typeof window === "undefined") return { seen: false, value: null }
  const key = buildStorageKey(date, userId)
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return { seen: false, value: null }
    if (stored === date || stored === "1" || stored === "true") {
      return { seen: true, value: stored }
    }
    return { seen: false, value: stored }
  } catch {
    return { seen: false, value: null }
  }
}

export interface UseShowDigestOnLoginOptions {
  userId: string | null | undefined
  onOpen?: () => void
}

export interface UseShowDigestOnLoginResult {
  hasSeenToday: boolean
  lastSeenDate: string | null
  markSeen: (date?: string) => void
  refresh: () => void
}

export default function useShowDigestOnLogin({
  userId,
  onOpen,
}: UseShowDigestOnLoginOptions): UseShowDigestOnLoginResult {
  const [hasSeenToday, setHasSeenToday] = useState(false)
  const [lastSeenDate, setLastSeenDate] = useState<string | null>(null)
  const onOpenRef = useRef(onOpen)

  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  const refresh = useCallback(() => {
    if (!userId) {
      setHasSeenToday(false)
      setLastSeenDate(null)
      return
    }
    const today = todayKey()
    const { seen, value } = readFlag(userId, today)
    setHasSeenToday(seen)
    setLastSeenDate(value)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markSeen = useCallback(
    (date?: string) => {
      if (!userId || typeof window === "undefined") return
      const targetDate = date ?? todayKey()
      const key = buildStorageKey(targetDate, userId)
      try {
        window.localStorage.setItem(key, targetDate)
      } catch {
        // ignore write failure
      }
      setHasSeenToday(true)
      setLastSeenDate(targetDate)
    },
    [userId],
  )

  useEffect(() => {
    let active = true

    const evaluate = (targetUserId: string | null) => {
      if (!active || !targetUserId) return
      const today = todayKey()
      const { seen } = readFlag(targetUserId, today)
      setHasSeenToday(seen)
      setLastSeenDate(seen ? today : null)
      if (!seen) {
        onOpenRef.current?.()
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        const sessionUserId = data.session?.user?.id ?? null
        evaluate(sessionUserId)
      })
      .catch(() => {
        if (!active) return
        setHasSeenToday(false)
        setLastSeenDate(null)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === "SIGNED_OUT") {
        setHasSeenToday(false)
        setLastSeenDate(null)
        return
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        evaluate(session?.user?.id ?? null)
      }
    })

    return () => {
      active = false
      subscription.subscription?.unsubscribe()
    }
  }, [])

  return {
    hasSeenToday,
    lastSeenDate,
    markSeen,
    refresh,
  }
}
