import { assertNever, pipe } from "antiutils";
import { LogMessage } from "../../../logger/handler";
import { normalizeSeverity } from "../../../logger/normalizeSeverity";
import { Severity } from "../../../logger/severity";
import { logPalette } from "../../../logPalette";
import { LogStyle } from "../logStyle";
import { formatTime } from "./formatTime";
import { hexToRgb } from "./hexToRgb";
import { rgbToAnsi256 } from "./rgbToAnsi256";

type TimeDeltaStyle = { bold: boolean; mutedColor: boolean };

const ansiColor = (color: string) =>
  pipe(
    color,
    hexToRgb,
    (value) => rgbToAnsi256(...value),
    (color) => `\u001B[38;5;${color}m`
  );

const ansiDim = `\u001B[2m`;

const ansiDimItalic = `\u001B[2;3m`;

const ansiItalic = `\u001B[3m`;

const ansiBoldItalic = `\u001B[1;3m`;

const ansiClear = `\u001B[0m`;

const mutedTextColor = "#c0c0c0";

const getSeverityCaption = (severity: Severity) =>
  severity === Severity.debug
    ? "DEBUG"
    : severity === Severity.info
    ? "INFO"
    : severity === Severity.warn
    ? "WARNING"
    : severity === Severity.error
    ? "ERROR"
    : assertNever(severity);

const getStyledTimeDelta = (
  timeDelta: number
): [caption: string, style: TimeDeltaStyle] => [
  "+" + formatTime(timeDelta),
  pipe(Math.round(timeDelta), (value) => ({
    bold: value >= 1000,
    mutedColor: !(value >= 10),
  })),
];

const timeDeltaStyleToCss = ({ bold, mutedColor }: TimeDeltaStyle) =>
  [
    "font-style: italic",
    ...(bold ? ["font-weight: bold"] : []),
    ...(mutedColor ? [`color: ${mutedTextColor}`] : []),
  ].join("; ");

const tryToSerialize = ({
  data,
  maxLength = 4000,
}: {
  data: unknown;
  maxLength?: number;
}) => {
  try {
    const retval = JSON.stringify(data, null, " ");
    if (retval.length > maxLength) {
      return retval.slice(0, maxLength) + "... [truncated]";
    } else {
      return retval;
    }
  } catch (e) {
    return data;
  }
};

const renderWithCssStyles = (
  data: readonly (readonly [text: string, style: string])[]
) => [
  data.map(([text]) => `%c${text}%c`).join(""),
  ...data.flatMap(([, style]) => [style, ""]),
];

/**
 * @internal
 */
export const pureConsoleHandler =
  ({
    getImpureHandler,
    logStyle,
    maxLength,
  }: {
    getImpureHandler: (severity?: Severity) => (...data: unknown[]) => void;
    logStyle: LogStyle;
    maxLength?: number;
  }) =>
  ({
    severity: nonNormalizedSeverity,
    stackLevel,
    badges,
    timeDelta,
    data,
  }: LogMessage): void => {
    const stackIndicator = new Array(stackLevel).fill("\u00B7");
    const styledTimeDelta = getStyledTimeDelta(timeDelta);
    const severity = normalizeSeverity(nonNormalizedSeverity);
    const log = getImpureHandler(severity);
    if (logStyle === "css") {
      log(
        ...renderWithCssStyles(
          [
            ...(severity !== undefined
              ? [
                  [
                    getSeverityCaption(severity),
                    `color: ${mutedTextColor}`,
                  ] as const,
                ]
              : []),
            ...stackIndicator.map(
              (caption) => [caption, `color: ${mutedTextColor}`] as const
            ),
            ...badges.map(
              ({ caption, color }) =>
                [
                  caption,
                  `background: ${color}; color: #ffffff; padding: 0 3px;`,
                ] as const
            ),
            pipe(
              styledTimeDelta,
              ([caption, style]) =>
                [caption, timeDeltaStyleToCss(style)] as const
            ),
          ].flatMap((el, index) => [
            ...(index === 0 ? [] : [[" ", ""] as const]),
            el,
          ])
        ),
        ...data
      );
    } else if (logStyle === "ansi") {
      log(
        [
          ...(severity !== undefined
            ? [
                `${
                  severity === Severity.warn
                    ? ansiColor(logPalette.yellow)
                    : severity === Severity.error
                    ? ansiColor(logPalette.red)
                    : ansiDim
                }${getSeverityCaption(severity)}${ansiClear}`,
              ]
            : []),
          ...stackIndicator.map(
            (caption) => `${ansiDim}${caption}${ansiClear}`
          ),
          ...badges.map(
            ({ caption, color }) =>
              `${ansiColor(color)}[${caption}]${ansiClear}`
          ),
          `${pipe(
            styledTimeDelta,
            ([caption, { bold, mutedColor }]) =>
              `${
                bold ? ansiBoldItalic : mutedColor ? ansiDimItalic : ansiItalic
              }${caption}${ansiClear}`
          )}`,
        ].join(" "),
        ...data
      );
    } else if (logStyle === "none") {
      log(
        `${[
          ...(severity !== undefined ? [getSeverityCaption(severity)] : []),
          ...stackIndicator,
          ...badges.map(
            (value) => `[${value.captionNoColor ?? value.caption}]`
          ),
          styledTimeDelta[0],
          ...(data.length ? [tryToSerialize({ data, maxLength })] : []),
        ].join(" ")}`
      );
    } else {
      assertNever(logStyle);
    }
  };