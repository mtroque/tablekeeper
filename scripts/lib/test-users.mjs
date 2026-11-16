// The seeded local users (db/seed.sql). Local only; never real accounts.
export const TEST_PASSWORD = 'tablekeeper-e2e';
export const TEST_USERS = {
  default: 'e2e@local',
  patchwork: 'e2e-patchwork@local',
  azul: 'e2e-azul@local',
  harmonies: 'e2e-harmonies@local',
  dorfromantik: 'e2e-dorfromantik@local',
};
export const TEST_USER_DETAILS = {
  default: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'e2e@local',
    name: 'E2E Player',
  },
  patchwork: {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'e2e-patchwork@local',
    name: 'Patchwork Player',
  },
  azul: {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'e2e-azul@local',
    name: 'Azul Player',
  },
  harmonies: {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'e2e-harmonies@local',
    name: 'Harmonies Player',
  },
  dorfromantik: {
    id: '00000000-0000-4000-8000-000000000005',
    email: 'e2e-dorfromantik@local',
    name: 'Dorfromantik Player',
  },
};
