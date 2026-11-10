/**
 * Re-export of vendored Organon population helpers.
 * Prefer importing from `../population.js` (same path shape as dsh-evolve-loop).
 * @see ../population.js
 * @see docs/UPSTREAM.md
 */

export {
  POPULATION_FILE,
  readPopulation,
  appendPopulation,
  writePopulation,
  alive,
  merit,
  populationOf,
} from '../population.js'
