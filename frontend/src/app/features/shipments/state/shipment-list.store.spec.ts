import { DEFAULT_SHIPMENT_QUERY, hasFilters, queryFromParams, queryToParams } from './shipment-list.store';

describe('shipment list query mapping', () => {
  it('returns defaults for empty params', () => {
    expect(queryFromParams({})).toEqual(DEFAULT_SHIPMENT_QUERY);
  });

  it('parses filters, paging and sorting', () => {
    const q = queryFromParams({
      search: ' ISH-2026 ', status: 'IN_TRANSIT', serviceType: 'EXPRESS', paymentStatus: 'PAID',
      customerId: '12', dateFrom: '2026-10-01', dateTo: '2026-10-24', sort: 'trackingNumber', page: '3', pageSize: '50',
    });
    expect(q).toEqual({
      search: 'ISH-2026', status: 'IN_TRANSIT', serviceType: 'EXPRESS', paymentStatus: 'PAID', customerId: 12,
      dateFrom: '2026-10-01', dateTo: '2026-10-24', sort: 'trackingNumber', page: 3, pageSize: 50,
    });
  });

  it('ignores invalid values', () => {
    const q = queryFromParams({ page: '-2', pageSize: '9999', customerId: 'abc', dateFrom: '24/10/2026' });
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(100);
    expect(q.customerId).toBeNull();
    expect(q.dateFrom).toBe('');
  });

  it('round-trips and omits defaults', () => {
    expect(queryToParams(DEFAULT_SHIPMENT_QUERY)).toEqual({});
    const q = { ...DEFAULT_SHIPMENT_QUERY, status: 'DELIVERED' as const, page: 2 };
    expect(queryToParams(q)).toEqual({ status: 'DELIVERED', page: 2 });
    expect(queryFromParams(queryToParams(q))).toEqual(q);
  });

  it('detects active filters', () => {
    expect(hasFilters(DEFAULT_SHIPMENT_QUERY)).toBe(false);
    expect(hasFilters({ ...DEFAULT_SHIPMENT_QUERY, page: 4 })).toBe(false);
    expect(hasFilters({ ...DEFAULT_SHIPMENT_QUERY, dateTo: '2026-10-24' })).toBe(true);
  });
});
