import crypto from 'crypto';

const PREFIXES = {
  agency: 'agcy',
  agent: 'agt',
  property: 'prop',
  tenant: 'ten',
  lease: 'lease',
  payment: 'pay',
  buyer: 'buy',
  mandate: 'mand',
  offer: 'ofr',
  sale: 'sale',
  maintenance: 'maint',
  inspection: 'insp',
  document: 'doc',
  owner: 'own',
  interest: 'int',
  viewing: 'view',
  commission: 'comm',
};

export function newId(type) {
  const prefix = PREFIXES[type] || type;
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
