// Everything tunable in one place. Distances in metres, times in seconds.
// s = distance along Leith Walk from Elm Row (northbound, up the screen).
// x = lateral offset, positive = right. Lanes: -1 left pavement, 0 tram line, 1 right pavement.

export const SIM_DT = 1 / 120;

export const LANE_W = 3.2;
export const LANE_SPEED = LANE_W / 0.15; // m/s sideways; a lane change takes ~0.15s

export const ROUTE_LENGTH = 760;
export const SPEED_START = 8.5;
export const SPEED_END = 13;
export const ACCEL = 5;

// The gig starts STAGE_TIME seconds after "HURRY!". A clean run takes 64-69s.
export const STAGE_TIME = 75;

export const JUMP_TIME = 0.6;
export const JUMP_HEIGHT = 1.15;
export const JUMP_CLEAR = 0.45; // must be this high to clear a jumpable obstacle

// Gurry's gig kit. Each hit breaks the next thing in this order; glue fixes the
// most recent breakage first.
export const ITEMS = [
  { key: 'heart', label: 'Heart', broke: 'Dented heart!' },
  { key: 'keyboard', label: 'Keyboard', broke: 'Keyboard snapped!' },
  { key: 'mic', label: 'Mic', broke: "Mic's gone wonky!" },
];
export const BROKEN_SLOWDOWN = 0.1; // per broken item
export const HIT_SPEED_KEEP = 0.45; // speed is cut to this on a hit
export const FALL_TIME = 1.3; // hit with everything already broken: he goes down
export const INVULN_TIME = 0.9;

export const GLUE_TIME = 0.55; // hold time to glue one item
export const GLUE_START = 1;
export const GLUE_MAX = 3;

export const TRAM_LEAD = 100; // tram front starts this far ahead when it rings
export const TRAM_SPEED = 8;
export const TRAM_LEN = 30;
export const TRAM_W = 2.65;
export const TRAM_ZONE = 95; // after a tram rings, only jumpables on the pavements

// The Glue creature keeps to the schedule and peeks up from the bottom of the
// screen once it's this close behind. If it reaches him it bites (a hit that
// breaks kit but never knocks him down) and drops back CREATURE_KNOCKBACK metres.
export const CREATURE_SHOW = 45;
export const CREATURE_KNOCKBACK = 40;

// Claw attacks: a shadow marks Gurry's lane for CLAW_WARN, then the claw slams
// down it for CLAW_SLAM. Change lane to dodge; jumping doesn't help.
export const CLAW_WARN = 0.85;
export const CLAW_SLAM = 0.3;
export const CLAW_W = 2.4;

// Pilrig St was the Edinburgh/Leith border. Crossing it flips the whole game
// into a negative print for a stretch.
export const FLIP_FROM = 380;
export const FLIP_TO = 500;

// Each record is a burst of pace: how you pull away from the creature.
export const RECORD_BOOST = 0.8; // m/s added per record
export const BOOST_MAX = 3;
export const BOOST_DECAY = 0.9; // m/s lost per second

// Cross streets along Leith Walk, south to north.
export const LANDMARKS = [
  { s: 0, name: 'Elm Row' },
  { s: 190, name: 'McDonald Rd' },
  { s: 380, name: 'Pilrig St' },
  { s: 570, name: 'Balfour St' },
  { s: ROUTE_LENGTH, name: 'Foot of the Walk' },
];
export const VENUE = 'Leith Theatre';

// Shopfront names along the Walk.
export const SHOP_SIGNS = [
  'HAPPY FOR NOW CAFÉ',
  'MASLOW WAS WRONG THERAPY',
  "GLITTER'S LIKE GUILT NAILS",
  'LIKE A LANDLORD LETTINGS',
  'LIVING HISTORY MUSEUM',
  'THURSDAY EVENING BAR',
  'POLAROID OF PAIN PHOTOS',
  'TELEVISION LOVESEAT',
  'CHAMPIONS BORE ME BOOKIES',
  'DENTED HEART PANEL BEATERS',
  'HAVE YOU? DELI',
  'NOT AS BAD AS IT SOUNDS HI-FI',
  'HOW DO YOU FEEL? CHIPPY',
  'THE QUAKER OATCAKES',
];

// A-board slogans (drawn on the pavement obstacles).
export const ABOARD_LINES = [
  ['OPEN MIC', 'THURSDAY', 'EVENING'],
  ['GLUE', 'OUT NOW'],
  ['CHIPS', '£3'],
  ['MASLOW', 'WAS', 'WRONG'],
  ['LIVING', 'HISTORY', 'TOURS'],
];

// Glue by Gurry Wurry. Drop audio into public/music/<file>.mp3 (or .m4a) and the
// track becomes pickable on the title screen. `start` skips into the song.
export const TRACKS = [
  { file: 'have-you', title: 'Have You', start: 0 },
  { file: 'television-loveseat', title: 'Television Loveseat', start: 0 },
  { file: 'polaroid-of-pain', title: 'Polaroid Of Pain', start: 0 },
  { file: 'living-history', title: 'Living History', start: 0 },
  { file: 'dented-heart', title: 'Dented Heart', start: 0 },
  { file: 'i-doubt-we-survived', title: 'I Doubt We Survived', start: 0 },
  { file: 'champions-bore-me', title: 'Champions Bore Me', start: 0 },
  { file: 'glitters-like-guilt', title: "Glitter's Like Guilt", start: 0 },
  { file: 'how-do-you-feel', title: 'How Do You Feel?', start: 0 },
  { file: 'the-gun-was-a-quaker', title: 'The Gun Was A Quaker', start: 0 },
  { file: 'like-a-landlord', title: 'Like A Landlord', start: 0 },
  { file: 'thursday-evening', title: 'Thursday Evening', start: 0 },
  { file: 'maslow-was-wrong', title: 'Maslow Was Wrong', start: 0 },
];

export const BANDCAMP_URL = 'https://gurrywurry.bandcamp.com/album/glue';
