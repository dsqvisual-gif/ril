/** A unique id for local records; time first, so ids sort by creation. */
export function newId(): string {
  const time = Date.now().toString(36);
  let rand = "";
  for (let i = 0; i < 10; i++) rand += Math.floor(Math.random() * 36).toString(36);
  return `${time}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
