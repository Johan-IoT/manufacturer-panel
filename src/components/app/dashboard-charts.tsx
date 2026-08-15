import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/app/states";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
];

const CHART_TOOLTIP = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "none",
};

type StatusPoint = { status: string; count: number };
type TrendPoint = { label: string; count: number };

type PieSlice = {
  name: string;
  value: number;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  percent: number;
};

const PIE_CX = 200;
const PIE_CY = 118;
const PIE_RADIUS = 78;
const PIE_TILT = 0.58;
const PIE_DEPTH = 18;

function toRad(angle: number) {
  return ((angle - 90) * Math.PI) / 180;
}

function polarPoint(cx: number, cy: number, radius: number, angle: number, yScale = 1) {
  const rad = toRad(angle);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad) * yScale,
  };
}

function sliceTopPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, yScale: number) {
  if (endAngle - startAngle <= 0) return "";
  const start = polarPoint(cx, cy, radius, endAngle, yScale);
  const end = polarPoint(cx, cy, radius, startAngle, yScale);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius * yScale} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function sliceOuterWallPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  depth: number,
  yScale: number,
) {
  if (endAngle - startAngle <= 0) return "";
  const topStart = polarPoint(cx, cy, radius, startAngle, yScale);
  const topEnd = polarPoint(cx, cy, radius, endAngle, yScale);
  const bottomStart = polarPoint(cx, cy + depth, radius, startAngle, yScale);
  const bottomEnd = polarPoint(cx, cy + depth, radius, endAngle, yScale);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${topStart.x} ${topStart.y}`,
    `A ${radius} ${radius * yScale} 0 ${largeArc} 1 ${topEnd.x} ${topEnd.y}`,
    `L ${bottomEnd.x} ${bottomEnd.y}`,
    `A ${radius} ${radius * yScale} 0 ${largeArc} 0 ${bottomStart.x} ${bottomStart.y}`,
    "Z",
  ].join(" ");
}

function sliceRadialWallPath(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  depth: number,
  yScale: number,
) {
  const top = polarPoint(cx, cy, radius, angle, yScale);
  const bottom = polarPoint(cx, cy + depth, radius, angle, yScale);
  return `M ${cx} ${cy} L ${top.x} ${top.y} L ${bottom.x} ${bottom.y} L ${cx} ${cy + depth} Z`;
}

function buildPieSlices(data: StatusPoint[]): PieSlice[] {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;

  return data.map((item, index) => {
    const share = total > 0 ? item.count / total : 0;
    const sweep = share * 360;
    const startAngle = cursor;
    const endAngle = cursor + sweep;
    cursor = endAngle;

    return {
      name: item.status,
      value: item.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      startAngle,
      endAngle,
      midAngle: startAngle + sweep / 2,
      percent: share,
    };
  });
}

function Pie3DTooltip({
  slice,
  x,
  y,
}: {
  slice: PieSlice;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-none"
      style={{ left: x, top: y, transform: "translate(-50%, -120%)" }}
    >
      <span className="font-medium text-foreground">{slice.name}</span>
      <span className="text-muted-foreground"> · {slice.value} ({Math.round(slice.percent * 100)}%)</span>
    </div>
  );
}

export function DeviceStatusPie3D({ data }: { data: StatusPoint[] }) {
  const slices = useMemo(() => buildPieSlices(data), [data]);
  const [activeSlice, setActiveSlice] = useState<PieSlice | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const ordered = useMemo(
    () => [...slices].sort((a, b) => Math.sin(toRad(a.midAngle)) - Math.sin(toRad(b.midAngle))),
    [slices],
  );

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 400 250" className="h-full w-full" role="img" aria-label="Device status breakdown">
        <defs>
          {slices.map((slice, index) => (
            <linearGradient key={slice.name} id={`pie-top-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={slice.color} stopOpacity={1} />
              <stop offset="100%" stopColor={slice.color} stopOpacity={0.78} />
            </linearGradient>
          ))}
        </defs>

        <ellipse
          cx={PIE_CX}
          cy={PIE_CY + PIE_DEPTH + 10}
          rx={PIE_RADIUS * 0.92}
          ry={PIE_RADIUS * PIE_TILT * 0.35}
          fill="var(--color-muted)"
          opacity={0.35}
        />

        {ordered.map((slice) => (
          <path
            key={`${slice.name}-outer`}
            d={sliceOuterWallPath(PIE_CX, PIE_CY, PIE_RADIUS, slice.startAngle, slice.endAngle, PIE_DEPTH, PIE_TILT)}
            fill={slice.color}
            opacity={0.55}
          />
        ))}

        {ordered.map((slice) => (
          <path
            key={`${slice.name}-start`}
            d={sliceRadialWallPath(PIE_CX, PIE_CY, PIE_RADIUS, slice.startAngle, PIE_DEPTH, PIE_TILT)}
            fill={slice.color}
            opacity={0.68}
          />
        ))}

        {ordered.map((slice, index) => (
          <path
            key={`${slice.name}-top`}
            d={sliceTopPath(PIE_CX, PIE_CY, PIE_RADIUS, slice.startAngle, slice.endAngle, PIE_TILT)}
            fill={`url(#pie-top-${index})`}
            stroke="var(--color-surface)"
            strokeWidth={2}
            className="cursor-pointer transition-opacity hover:opacity-90"
            onMouseEnter={(event) => {
              const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (!rect) return;
              setActiveSlice(slice);
              setTooltipPos({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
            onMouseMove={(event) => {
              const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (!rect) return;
              setTooltipPos({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
            onMouseLeave={() => setActiveSlice(null)}
          >
            <title>
              {slice.name}: {slice.value} ({Math.round(slice.percent * 100)}%)
            </title>
          </path>
        ))}

        {slices.map((slice) => {
          if (slice.percent < 0.06) return null;
          const labelRadius = PIE_RADIUS + 24;
          const point = polarPoint(PIE_CX, PIE_CY, labelRadius, slice.midAngle, PIE_TILT);
          const anchor = point.x >= PIE_CX ? "start" : "end";
          return (
            <text
              key={`${slice.name}-label`}
              x={point.x}
              y={point.y}
              fill="var(--color-muted-foreground)"
              fontSize={11}
              textAnchor={anchor}
              dominantBaseline="central"
            >
              {slice.name} {Math.round(slice.percent * 100)}%
            </text>
          );
        })}
      </svg>

      {activeSlice ? <Pie3DTooltip slice={activeSlice} x={tooltipPos.x} y={tooltipPos.y} /> : null}
    </div>
  );
}

export function RegistrationTrendAreaChart({ data }: { data: TrendPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const peak = data.reduce((max, point) => Math.max(max, point.count), 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState title="No registrations in the last 14 days" />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="registration-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.38} />
            <stop offset="55%" stopColor="var(--color-primary)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={28}
          domain={[0, Math.max(peak + 1, 3)]}
        />
        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value, "Registrations"]} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          fill="url(#registration-area-fill)"
          dot={({ cx, cy, payload }) =>
            payload && payload.count > 0 && cx != null && cy != null ? (
              <circle
                cx={cx}
                cy={cy}
                r={4}
                fill="var(--color-surface)"
                stroke="var(--color-primary)"
                strokeWidth={2}
              />
            ) : null
          }
          activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-surface)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
