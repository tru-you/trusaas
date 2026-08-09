import { Router } from 'express';
import { load, query } from '../lib/persist.js';
import { filterByAgentScope } from '../lib/isolation.js';
import { requireRole } from '../lib/isolation.js';
import { formatZAR, formatDateSA } from '../lib/sa-rules.js';

export default function reportRoutes(dataDir) {
  const r = Router();

  r.get('/api/reports/rent-roll', (req, res) => {
    const leases = query(dataDir, 'leases', req.agencyId, l => l.status === 'active');
    const now = new Date();
    const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const rows = [];
    let totalDue = 0;
    let totalPaid = 0;

    for (const lease of leases) {
      const prop = load(dataDir, 'properties', lease.propertyId);
      const tenant = load(dataDir, 'tenants', lease.tenantId);
      const payments = query(dataDir, 'payments', req.agencyId, p =>
        p.leaseId === lease.id && p.dueDate === month && p.status === 'received'
      );
      const paid = payments.reduce((sum, p) => sum + p.amountZAR, 0);
      totalDue += lease.monthlyRentZAR;
      totalPaid += paid;

      rows.push({
        propertyId: lease.propertyId,
        address: prop?.address || '',
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
        monthlyRentZAR: lease.monthlyRentZAR,
        paidZAR: paid,
        balanceZAR: lease.monthlyRentZAR - paid,
        leaseEnd: lease.endDate,
      });
    }

    res.json({
      month,
      totalDueZAR: totalDue,
      totalPaidZAR: totalPaid,
      totalOutstandingZAR: totalDue - totalPaid,
      rows: filterByAgentScope(req, rows),
    });
  });

  r.get('/api/reports/arrears', (req, res) => {
    const leases = query(dataDir, 'leases', req.agencyId, l => l.status === 'active');
    const now = new Date();
    const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const rows = [];
    for (const lease of leases) {
      const payments = query(dataDir, 'payments', req.agencyId, p =>
        p.leaseId === lease.id && p.dueDate === month && p.status === 'received'
      );
      const paid = payments.reduce((sum, p) => sum + p.amountZAR, 0);
      if (paid >= lease.monthlyRentZAR) continue;

      const prop = load(dataDir, 'properties', lease.propertyId);
      const tenant = load(dataDir, 'tenants', lease.tenantId);
      rows.push({
        propertyId: lease.propertyId,
        address: prop?.address || '',
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
        phone: tenant?.phone || '',
        monthlyRentZAR: lease.monthlyRentZAR,
        paidZAR: paid,
        outstandingZAR: lease.monthlyRentZAR - paid,
      });
    }

    res.json({ month, count: rows.length, rows: filterByAgentScope(req, rows) });
  });

  r.get('/api/reports/owner-statement/:ownerId', (req, res) => {
    const owner = load(dataDir, 'owners', req.params.ownerId);
    if (!owner || owner.agencyId !== req.agencyId) return res.status(404).json({ error: 'Owner not found.' });

    const month = req.query.month || (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    })();

    const properties = query(dataDir, 'properties', req.agencyId, p => p.ownerId === owner.id);
    const lines = [];
    let totalRent = 0;
    let totalCommission = 0;
    let totalMaintenance = 0;

    for (const prop of properties) {
      const payments = query(dataDir, 'payments', req.agencyId, p =>
        p.propertyId === prop.id && p.dueDate === month && p.status === 'received'
      );
      const rent = payments.reduce((sum, p) => sum + p.amountZAR, 0);
      const commission = Math.round(rent * (owner.commissionPercent || 10) / 100);

      const maintItems = query(dataDir, 'maintenance', req.agencyId, m =>
        m.propertyId === prop.id && m.resolvedDate && m.resolvedDate.startsWith(month)
      );
      const maintCost = maintItems.reduce((sum, m) => sum + (m.actualCostZAR || 0), 0);

      totalRent += rent;
      totalCommission += commission;
      totalMaintenance += maintCost;

      lines.push({
        propertyId: prop.id,
        address: prop.address,
        rentCollectedZAR: rent,
        commissionZAR: commission,
        maintenanceZAR: maintCost,
        netPayableZAR: rent - commission - maintCost,
      });
    }

    res.json({
      ownerId: owner.id,
      ownerName: owner.name,
      month,
      properties: lines,
      totalRentZAR: totalRent,
      totalCommissionZAR: totalCommission,
      totalMaintenanceZAR: totalMaintenance,
      netPayableZAR: totalRent - totalCommission - totalMaintenance,
      bankName: owner.bankName,
      bankAccount: owner.bankAccount,
    });
  });

  r.get('/api/reports/sales-pipeline', (req, res) => {
    const properties = query(dataDir, 'properties', req.agencyId, p =>
      (p.purpose === 'sale' || p.purpose === 'both') && !p.deleted
    );

    const pipeline = { available: [], 'under-offer': [], sold: [], withdrawn: [] };
    for (const prop of properties) {
      const status = prop.salesStatus || 'available';
      if (pipeline[status]) {
        const mandates = query(dataDir, 'mandates', req.agencyId, m => m.propertyId === prop.id && m.status === 'active');
        const offers = query(dataDir, 'offers', req.agencyId, o => o.propertyId === prop.id && o.status === 'submitted');
        pipeline[status].push({
          propertyId: prop.id,
          address: prop.address,
          suburb: prop.suburb,
          askingPriceZAR: prop.askingPriceZAR,
          activeMandates: mandates.length,
          pendingOffers: offers.length,
          daysOnMarket: prop.createdAt ? Math.floor((Date.now() - new Date(prop.createdAt).getTime()) / 86400000) : 0,
        });
      }
    }

    res.json({
      summary: {
        available: pipeline.available.length,
        underOffer: pipeline['under-offer'].length,
        sold: pipeline.sold.length,
        withdrawn: pipeline.withdrawn.length,
        totalListingValueZAR: properties.reduce((s, p) => s + (p.askingPriceZAR || 0), 0),
      },
      pipeline,
    });
  });

  r.get('/api/reports/commission', (req, res) => {
    const month = req.query.month || (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    })();

    const rentalRows = [];
    const leases = query(dataDir, 'leases', req.agencyId, l => l.status === 'active');
    for (const lease of leases) {
      const payments = query(dataDir, 'payments', req.agencyId, p =>
        p.leaseId === lease.id && p.dueDate === month && p.status === 'received'
      );
      const rent = payments.reduce((sum, p) => sum + p.amountZAR, 0);
      if (rent <= 0) continue;

      const prop = load(dataDir, 'properties', lease.propertyId);
      const owner = prop?.ownerId ? load(dataDir, 'owners', prop.ownerId) : null;
      const pct = owner?.commissionPercent || 10;
      rentalRows.push({
        propertyId: lease.propertyId,
        address: prop?.address || '',
        ownerName: owner?.name || '',
        rentCollectedZAR: rent,
        commissionPercent: pct,
        commissionZAR: Math.round(rent * pct / 100),
      });
    }

    const salesRows = [];
    const sales = query(dataDir, 'sales', req.agencyId, s =>
      s.saleDate && s.saleDate.startsWith(month)
    );
    for (const sale of sales) {
      const prop = load(dataDir, 'properties', sale.propertyId);
      salesRows.push({
        propertyId: sale.propertyId,
        address: prop?.address || '',
        salePriceZAR: sale.salePriceZAR,
        commissionZAR: sale.commissionZAR || 0,
        commissionPaid: !!sale.commissionPaidDate,
      });
    }

    const totalRentalCommission = rentalRows.reduce((s, r) => s + r.commissionZAR, 0);
    const totalSalesCommission = salesRows.reduce((s, r) => s + r.commissionZAR, 0);

    res.json({
      month,
      rental: { rows: rentalRows, totalCommissionZAR: totalRentalCommission },
      sales: { rows: salesRows, totalCommissionZAR: totalSalesCommission },
      grandTotalZAR: totalRentalCommission + totalSalesCommission,
    });
  });

  return r;
}
