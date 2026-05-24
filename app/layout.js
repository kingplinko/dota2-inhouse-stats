'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Trophy, Map, Network, List, Upload, Calendar } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

const navigation = [
  { name: 'Leaderboard', href: '/', icon: Home },
  { name: 'Players', href: '/players', icon: Users },
  { name: 'Heroes', href: '/heroes', icon: Trophy },
  { name: 'Positions', href: '/positions', icon: Map },
  { name: 'Synergy', href: '/synergy', icon: Network },
  { name: 'Matches', href: '/matches', icon: List },
  { name: 'Seasons', href: '/seasons', icon: Calendar },
  { name: 'Replays', href: '/replays', icon: Upload },
  { name: 'Admin', href: '/admin', icon: Upload },
]

export default function RootLayout({ children }) {
  const pathname = usePathname()

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-gray-900">Dota 2 Inhouse Stats</h1>
                </div>
              </div>
            </div>
          </header>

          <div className="flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16">
              <nav className="p-4 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
