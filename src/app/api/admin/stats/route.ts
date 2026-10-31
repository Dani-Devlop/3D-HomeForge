import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth';
import { db } from '@/lib/db';

// ============================================================
// GET /api/admin/stats — overall admin panel statistics (admin only)
// ============================================================

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const [
      projects,
      folders,
      guests,
      shareLinks,
      activeShareLinks,
      publicProjects,
      roomGroups,
      recentGuests,
    ] = await Promise.all([
      db.project.count(),
      db.folder.count(),
      db.guest.count(),
      db.shareLink.count(),
      db.shareLink.count({ where: { active: true } }),
      db.project.count({ where: { isPublic: true } }),
      db.project.groupBy({ by: ['roomType'], _count: { _all: true } }),
      db.guest.findMany({
        orderBy: { lastSeenAt: 'desc' },
        take: 12,
        include: { shareLink: { select: { project: { select: { name: true } } } } },
      }),
    ]);

    const roomTypes: Record<string, number> = {};
    for (const g of roomGroups) roomTypes[g.roomType] = g._count._all;

    // Projects where any of visit/install/due falls within yesterday → 45 days ahead
    const windowStart = new Date(Date.now() - DAY);
    const windowEnd = new Date(Date.now() + 45 * DAY);
    const inRange = (d: Date | null) => !!d && d >= windowStart && d < windowEnd;
    const upcomingProjects = await db.project.findMany({
      where: {
        OR: [
          { visitAt: { gte: windowStart, lt: windowEnd } },
          { installAt: { gte: windowStart, lt: windowEnd } },
          { dueAt: { gte: windowStart, lt: windowEnd } },
        ],
      },
    });
    upcomingProjects.sort((a, b) => {
      const nearest = (p: typeof a) => {
        const dates = [p.visitAt, p.installAt, p.dueAt].filter(inRange) as Date[];
        return dates.length ? Math.min(...dates.map((d) => d.getTime())) : Infinity;
      };
      return nearest(a) - nearest(b);
    });

    return NextResponse.json({
      stats: {
        projects,
        folders,
        guests,
        shareLinks,
        activeShareLinks,
        publicProjects,
      },
      roomTypes,
      recentGuests: recentGuests.map((g) => ({
        id: g.id,
        name: g.name,
        role: g.role,
        color: g.color,
        projectName: g.shareLink?.project?.name ?? null,
        lastSeenAt: g.lastSeenAt.toISOString(),
      })),
      upcoming: upcomingProjects.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        clientPhone: p.clientPhone,
        visitAt: p.visitAt ? p.visitAt.toISOString() : null,
        installAt: p.installAt ? p.installAt.toISOString() : null,
        dueAt: p.dueAt ? p.dueAt.toISOString() : null,
      })),
    });
  } catch (err) {
    console.error('GET /api/admin/stats failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
