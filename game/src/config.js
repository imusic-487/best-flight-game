// Skyline Valley — Ring Runner: shared constants, mission definitions and palette.
// One job: every number the rest of the game tunes against lives here.

export const GAME_NAME = 'Skyline Valley';
export const GAME_SUBTITLE = 'Ring Runner';
export const VERSION = '1.0.0';

// World geometry (metres). The valley runs along +z; x is lateral from the centreline.
export const WORLD = {
  valleyHalfWidth: 420, // fields give way to hills beyond this
  runwayLength: 520,
  runwayHalfWidth: 14,
  farAirfieldZ: 6000, // destination runway for the Mail Run
  courseEndZ: 6800,
  maxAltitude: 900, // soft ceiling; above it the air gets thin
  minSpeed: 24, // below this the wing stops flying
  maxSpeed: 118,
  stallSpeed: 30,
};

// Flight tuning.
export const FLIGHT = {
  maxThrottleAccel: 26, // m/s^2 at full throttle, sea level
  dragCoefficient: 0.011,
  pitchAuthority: 26, // deg/s of pitch at full elevator
  bankAuthority: 55, // deg/s of roll
  turnRateFactor: 0.42, // heading deg/s per deg of bank, scaled by speed
  climbEfficiency: 0.62, // how much pitch turns into climb vs speed bleed
  fuelBurnBase: 0.22, // fuel units per second at idle
  fuelBurnThrottle: 1.35, // extra burn at full throttle
  fuelCapacity: 100,
  damagePerHardHit: 34,
  damagePerScrape: 12,
};

// Mission definitions. Three sorties, three different goals.
export const MISSIONS = [
  {
    id: 'rings',
    key: '1',
    name: 'Ring Course',
    blurb: 'Thread all 10 rings down the valley before the clock runs out.',
    ringCount: 10,
    timeLimit: 210,
    fuelStart: 100,
    startZ: 0,
    scoring: { ring: 100, timeBonusPerSecond: 5, landingBonus: 250 },
  },
  {
    id: 'mail',
    key: '2',
    name: 'Mail Run',
    blurb: 'Carry the valley mail to the far airfield and land on its runway.',
    ringCount: 4,
    timeLimit: 300,
    fuelStart: 78,
    startZ: 0,
    scoring: { ring: 60, timeBonusPerSecond: 4, landingBonus: 400 },
  },
  {
    id: 'landing',
    key: '3',
    name: 'Precision Landing',
    blurb: 'Short hop, tight fuel. Touch down on the numbers, soft and centred.',
    ringCount: 2,
    timeLimit: 150,
    fuelStart: 42,
    startZ: 0,
    scoring: { ring: 80, timeBonusPerSecond: 3, landingBonus: 600 },
  },
];

// Palette: one dawn-valley style shared by sky, ground and instruments.
export const PALETTE = {
  skyTop: '#2e5f8f',
  skyMid: '#7fb2d9',
  skyHorizon: '#ffd9a0',
  sun: '#fff3c4',
  mountainFar: '#8aa8c4',
  mountainNear: '#5d7d5a',
  fieldGreen: '#6da24f',
  fieldGold: '#c9a44a',
  fieldDark: '#4f7d3c',
  fieldPlough: '#8a6a42',
  river: '#4f9fd8',
  townRoof: '#b5543a',
  townWall: '#e8dcc3',
  runway: '#3c4148',
  runwayMark: '#f2f0e6',
  hudAmber: '#ffb347',
  hudCyan: '#7fe3ff',
  hudGreen: '#8dff6e',
  hudRed: '#ff5d4d',
  panel: 'rgba(10, 18, 30, 0.62)',
  panelEdge: 'rgba(127, 227, 255, 0.45)',
};

// Wind: gusts that push the aircraft sideways and show on the HUD.
export const WIND = {
  baseSpeed: 6, // m/s
  gustAmplitude: 9,
  gustPeriod: 17, // seconds per gust cycle
};
