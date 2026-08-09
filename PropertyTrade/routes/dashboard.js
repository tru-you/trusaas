import { Router } from 'express';
import { query, count } from '../lib/persist.js';
import { filterByAgentScope } from '../lib/isolation.js';
import { leaseExpiringWithin, isDepositReceiptOverdue } from '../lib/sa-rules.js';

export default function dashboardRoutes(dataDir) {
  const r = Router();

  r.get('/api/dashboard', (req, res) => {
    let properties = query(dataDir, 'properties', req.agencyId, p => !p.deleted);
    properties = filterByAgentScope(req, properties);

    const rental = properties.filter(p => p.purpose === 'rental' || p.purpose === 'both');
    const sales = properties.filter(p => p.purpose === 'sale' || p.purpose === 'both');

    const occupied = rental.filter(p => p.rentalStatus === 'occupied').length;
    const vacant = rental.filter(p => p.rentalStatus === 'vacant').length;
    const totalRental = rental.length || 1;
    const occupancyRate = Math.round((occupied / totalRental) * 100);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let leases = query(dataDir, 'leases', req.agencyId, l => l.status === 'active');
    leases = filterByAgentScope(req, leases);

    let totalRentDue = 0;
    let totalRentPaid = 0;
    for (const lease of leases) {
      totalRentDue += lease.monthlyRentZAR || 0;
      const payments = query(dataDir, 'payments', req.agencyId, p =>
        p.leaseId === lease.id && p.dueDate === currentMonth && p.status === 'received'
      );
      totalRentPaid += payments.reduce((s, p) => s + p.amountZAR, 0);
    }

    const arrearsCount = leases.filter(l => {
      const payments = query(dataDir, 'payments', req.agencyId, p =>
        p.leaseId === l.id && p.dueDate === currentMonth && p.status === 'received'
      );
      return payments.reduce((s, p) => s + p.amountZAR, 0) < (l.monthlyRentZAR || 0);
    }).length;

    let maintenance = query(dataDir, 'maintenance', req.agencyId, m =>
      m.status !== 'resolved' && m.status !== 'closed'
    );
    maintenance = filterByAgentScope(req, maintenance);
    const urgentMaint = maintenance.filter(m => m.priority === 'urgent').length;

    const activeListings = sales.filter(p => p.salesStatus === 'available').length;
    const pendingOffers = query(dataDir, 'offers', req.agencyId, o =>
      o.status === 'submitted' || o.status === 'countered'
    ).length;

    const activeLeads = count(dataDir, 'interests', req.agencyId, i =>
      !i.deleted && i.status !== 'won' && i.status !== 'lost'
    );

    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const viewingsThisWeek = count(dataDir, 'viewings', req.agencyId, v =>
      v.status === 'scheduled' && v.scheduledDate >= today && v.scheduledDate <= weekFromNow
    );

    const expiringLeases = leases.filter(l => leaseExpiringWithin(l, 60)).map(l => ({
      id: l.id, propertyId: l.propertyId, tenantId: l.tenantId,
      endDate: l.endDate, monthlyRentZAR: l.monthlyRentZAR,
    }));

    const depositAlerts = leases.filter(l => isDepositReceiptOverdue(l)).map(l => ({
      leaseId: l.id, propertyId: l.propertyId, depositPaidDate: l.depositPaidDate,
    }));

    res.json({
      totalProperties: properties.length,
      occupiedCount: occupied,
      vacantCount: vacant,
      occupancyRate,
      rentDueThisMonthZAR: totalRentDue,
      rentCollectedThisMonthZAR: totalRentPaid,
      rentOutstandingZAR: totalRentDue - totalRentPaid,
      arrearsCount,
      maintenanceOpen: maintenance.length,
      maintenanceUrgent: urgentMaint,
      activeListings,
      pendingOffers,
      activeLeads,
      viewingsThisWeek,
      expiringLeases,
      depositAlerts,
      month: currentMonth,
    });
  });

  return r;
}
