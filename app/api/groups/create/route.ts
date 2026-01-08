import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate unique invite code
    const inviteCode = nanoid(8).toLowerCase()

    // Create group with participant (host)
    const group = await prisma.group.create({
      data: {
        invite_code: inviteCode,
        created_by_user_id: user.id,
        members: {
          create: {
            user_id: user.id,
          },
        },
        participants: {
          create: {
            type: 'member',
            user_id: user.id,
            preferred_name: user.email?.split('@')[0] || 'Member',
            status: 'active',
          },
        },
      },
      include: {
        participants: {
          where: { status: 'active' },
        },
      },
    })

    return NextResponse.json({ 
      group: {
        ...group,
        invite_link: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/groups/join/${inviteCode}`,
      }
    })
  } catch (error: any) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create group',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
