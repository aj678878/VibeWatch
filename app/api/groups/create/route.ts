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

    // Create group
    const group = await prisma.group.create({
      data: {
        invite_code: inviteCode,
        created_by_user_id: user.id,
        members: {
          create: {
            user_id: user.id,
          },
        },
      },
    })

    return NextResponse.json({ group })
  } catch (error: any) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create group',
        details: error.message || 'Unknown error',
        code: error.code,
      },
      { status: 500 }
    )
  }
}
