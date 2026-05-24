export function select<T, R>(i: Iterable<T>, filter: (item: T, index: number) => R | undefined, keepRest: true): [R[], []];
export function select<T, R>(i: Iterable<T>, filter: (item: T, index: number) => R | undefined): R[];
export function select<T, R>(i: Iterable<T>, filter: (item: T, index: number) => R | undefined, keepRest?: true) {
  let index = 0;

  const selected: R[] = [];
  const other: T[] = [];

  for (const item of i) {
    const r = filter(item, index++);
    if (r !== undefined) selected.push(r);
    else if (keepRest) other.push(item);
  }
  return keepRest ? [selected, other] : selected;
}