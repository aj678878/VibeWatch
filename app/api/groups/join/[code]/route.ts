import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = params

    // Find group by invite code
    const group = await prisma.group.findUnique({
      where: { invite_code: code },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        user_id_group_id: {
          user_id: user.id,
          group_id: group.id,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json({ group })
    }

    // Add user as member
    await prisma.groupMember.create({
      data: {
        user_id: user.id,
        group_id: group.id,
      },
    })

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json(
      { error: 'Failed to join group' },
      { status: 500 }
    )
  }
}
