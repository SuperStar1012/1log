import { Plugin } from "./log";
import { ColorName } from "./palette";

export interface Label {
  caption: string;
  color?: ColorName;
}

export const labelsSymbol = Symbol("labelsSymbol");

declare module "./log" {
  interface Meta {
    [labelsSymbol]?: Label[];
  }
}

export const label =
  (arg: string | Label): Plugin =>
  ({ args, meta }) => ({
    args,
    meta: {
      ...meta,
      [labelsSymbol]: [
        typeof arg === "string" ? { caption: arg } : arg,
        ...(meta[labelsSymbol] ?? []),
      ],
    },
  });
