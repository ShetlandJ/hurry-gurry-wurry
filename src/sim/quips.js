// What Gurry says on the end card. Placeholders built from Glue's track titles
// until he supplies his own. Picked by the run seed, never Math.random.
import { Rng } from '../util/rng.js';

const BANDS = [
  {
    min: 10,
    lines: [
      'Ten. Not as bad as it sounds. Better, actually.',
      "Perfect. I'd frame it, but the frame would break.",
      'Not a scratch on the heart. First time for everything.',
    ],
  },
  {
    min: 8,
    lines: ['Happy for now.', "Barely a dent. The glue's still wet though.", 'Have you done this before?'],
  },
  {
    min: 5,
    lines: [
      'A dented heart, but it still beats. Mostly.',
      'Like a landlord: late, but you turned up.',
      'How do you feel? Because the keyboard feels terrible.',
    ],
  },
  {
    min: 2,
    lines: ['I doubt we survived.', "Champions bore me anyway. You're safe.", "Glitter's like guilt. So is this."],
  },
  {
    min: 0,
    lines: ['Maslow was wrong. So were you.', "That's going in the polaroid of pain album.", 'Living history, this. The bad kind.'],
  },
];

export function quipFor(whole, seed) {
  const band = BANDS.find((b) => whole >= b.min);
  return new Rng(`quip:${seed}:${whole}`).pick(band.lines);
}
