import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get groups where user is a member
  const groups = await prisma.group.findMany({
    where: {
      members: {
        some: {
          user_id: user.id,
        },
      },
    },
    include: {
      members: true,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-light">Groups</h1>
          <div className="flex gap-4 items-center">
            <Link
              href="/groups/create"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-colors"
            >
              Create Group
            </Link>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-gray-400 mb-4">No groups yet</p>
            <Link
              href="/groups/create"
              className="text-white/80 hover:text-white underline"
            >
              Create your first group
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}/watchlist`}
                className="block backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-6 hover:bg-white/10 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-light mb-2">
                      Group {group.invite_code}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {group.members.length} member
                      {group.members.length !== 1 ? 's' : ''} •{' '}
                      {group._count.watchlists} movie
                      {group._count.watchlists !== 1 ? 's' : ''} in watchlist
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
