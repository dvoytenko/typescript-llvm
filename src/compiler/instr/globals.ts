type Factory<V, Args extends [...any[]]> = (key: string, ...args: Args) => V;

export class Globals<V, Args extends [...any[]]> {
  private readonly map: Map<string, V> = new Map();

  constructor(private readonly factory: Factory<V, Args>) {}

  get(key: string, ...args: Args) {
    const { factory, map } = this;
    let value = map.get(key);
    if (!value) {
      value = factory(key, ...args);
      map.set(key, value);
    }
    return value;
  }
}
