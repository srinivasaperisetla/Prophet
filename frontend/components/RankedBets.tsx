'use client'

import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@/lib/supabase-auth'


type RankedBet = {
  id: string
  player: string
  market: string
  line: number
  side: 'Over' | 'Under'
  dfs_book: string
  fair_prob: number
  edge: number
  fair_american: number | null
  num_books: number
  matchup: string
  commence_time: string
  snapshot_at: string
}

function rowKey(bet: RankedBet): string {
  return `${bet.player}|${bet.market}|${bet.line}|${bet.side}|${bet.dfs_book}`
}

const RankedBets = () => {
  const supabase = useSupabaseClient()
  const [bets, setBets] = useState<Map<string, RankedBet>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 1. Initial fetch
    const loadInitial = async () => {
      const { data, error } = await supabase
        .from('ranked_bets')
        .select('*')
        .order('edge', { ascending: false })
        .limit(100)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const initialMap = new Map<string, RankedBet>()
      for (const bet of data as RankedBet[]) {
        initialMap.set(rowKey(bet), bet)
      }
      setBets(initialMap)
      setLoading(false)
    }

    loadInitial()

    // 2. Subscribe to changes
    const channel = supabase
      .channel('ranked_bets_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ranked_bets' },
        (payload) => {
          setBets((prev) => {
            const next = new Map(prev)
            if (payload.eventType === 'DELETE') {
              const oldBet = payload.old as RankedBet
              next.delete(rowKey(oldBet))
            } else {
              const newBet = payload.new as RankedBet
              next.set(rowKey(newBet), newBet)
            }
            return next
          })
        }
      )
      .subscribe()

    // 3. Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Sort once for rendering — Map preserves insertion order but we want edge desc
  const sortedBets = Array.from(bets.values())
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 50)

  if (loading) {
    return <main className="p-8">Loading…</main>
  }

  if (error) {
    return <main className="p-8 text-red-600">Error: {error}</main>
  }

  return (
    <main className="p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">
        Top +EV DFS Bets ({sortedBets.length})
      </h1>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Edge</th>
            <th className="text-left p-2">Player</th>
            <th className="text-left p-2">Market</th>
            <th className="text-left p-2">Side</th>
            <th className="text-right p-2">Line</th>
            <th className="text-right p-2">Fair</th>
            <th className="text-right p-2">Books</th>
            <th className="text-left p-2">DFS Book</th>
            <th className="text-left p-2">Matchup</th>
          </tr>
        </thead>
        <tbody>
          {sortedBets.map((bet) => (
            <tr key={rowKey(bet)} className="border-b hover:bg-gray-50">
              <td className="p-2 text-green-600 font-bold">
                +{(bet.edge * 100).toFixed(2)}%
              </td>
              <td className="p-2">{bet.player}</td>
              <td className="p-2 text-gray-600">
                {bet.market.replace('player_', '')}
              </td>
              <td className="p-2">{bet.side}</td>
              <td className="p-2 text-right">{bet.line}</td>
              <td className="p-2 text-right">
                {(bet.fair_prob * 100).toFixed(1)}%
              </td>
              <td className="p-2 text-right">{bet.num_books}</td>
              <td className="p-2">{bet.dfs_book}</td>
              <td className="p-2 text-gray-500 text-xs">{bet.matchup}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

export default RankedBets