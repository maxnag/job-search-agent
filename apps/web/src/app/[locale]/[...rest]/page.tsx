import { notFound } from 'next/navigation';

/**
 * Any address under a language that no page matches — shows the not-found page in that language
 *
 * @returns {never}
 */
export default function CatchAllPage(): never {
  notFound();
}
