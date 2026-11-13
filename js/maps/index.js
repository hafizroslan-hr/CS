import { DUST_FRONT } from './dust-front.js';

// Maps without `rows` are planned for Phase 4 and cannot be selected yet.
export const MAPS = [
  DUST_FRONT,
  { id: 'urban-strike', name: 'URBAN STRIKE', available: false, desc: 'Concrete blocks, narrow streets, interior passages and courtyards.' },
  { id: 'industrial-zone', name: 'INDUSTRIAL ZONE', available: false, desc: 'Warehouse floor, container yard and loading bays.' },
  { id: 'winter-assault', name: 'WINTER ASSAULT', available: false, desc: 'Snow-covered compound with restricted sight lines.' },
  { id: 'desert-fortress', name: 'DESERT FORTRESS', available: false, desc: 'Stone fortress with corridors and an open courtyard.' }
];

export function getMapDef(id) {
  return MAPS.find(m => m.id === id && m.available) || MAPS[0];
}
