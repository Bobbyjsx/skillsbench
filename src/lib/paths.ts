export function makePathDisplay(home: string) {
  return {
    display(p: string): string {
      if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
      return p;
    },
  };
}
