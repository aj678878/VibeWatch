import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const groups = await prisma.group.findMany({
    where: {
      participants: {
        some: {
          user_id: user.id,
          status: 'active',
        },
      },
    },
    include: {
      participants: {
        where: { status: 'active' },
      },
      _count: {
        select: {
          watchlists: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  return (
    <div className="min-h-screen bg-netflix-dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-netflix-dark to-transparent">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4">
          <Link href="/groups">
            <h1 className="text-netflix-red text-xl sm:text-2xl font-bold tracking-tight">VIBEWATCH</h1>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-netflix-gray text-xs sm:text-sm hidden sm:inline">
              {user.email || `Guest ${user.id.slice(0, 8)}`}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 sm:pt-24 px-4 sm:px-6 md:px-8 pb-8 sm:pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-medium">My Groups</h2>
            <Link
              href="/groups/create"
              className="netflix-btn px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base w-full sm:w-auto text-center"
            >
              Create Group
            </Link>
          </div>

          {groups.length === 0 ? (
            <div className="bg-card-bg rounded p-12 text-center animate-fade-in">
              <h3 className="text-xl mb-4">No groups yet</h3>
              <p className="text-netflix-gray mb-6">
                Create a group to start deciding on movies with friends
              </p>
              <Link
                href="/groups/create"
                className="netflix-btn px-8 py-3 inline-block"
              >
                Create Your First Group
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}/watchlist`}
                  className="netflix-card p-6 block"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-netflix-red/20 text-netflix-red px-3 py-1 rounded text-sm font-medium">
                      {group.invite_code.toUpperCase()}
                    </div>
                    <span className="text-netflix-gray text-xs">
                      {new Date(group.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Watch Group
                  </h3>
                  <div className="flex gap-4 text-sm text-netflix-gray">
                    <span>{group.participants.length} members</span>
                    <span>{group._count.watchlists} movies</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
