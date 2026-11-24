import type { IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';

/**
 * The positions of a board split by what the discovery knows of their place: `known` have a country — from the field
 * or from the location text — and, in a country the profiles want, a work mode, unless every mode is accepted there;
 * `unknown` lack either. Only known positions may count as wanted — the discovery has no LLM to read the rest
 */
export interface IPositionPlaces {
  /**
   * Positions whose place the screening can judge, the country filled in
   *
   * @var {IATSPosition[]}
   */
  readonly known: IATSPosition[];

  /**
   * How many positions have no known country, or no known work mode where the mode matters
   *
   * @var {number}
   */
  readonly unknown: number;
}
