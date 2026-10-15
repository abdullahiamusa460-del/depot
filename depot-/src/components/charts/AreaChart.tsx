interface Point {
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: Point[];
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function AreaChart({
  data,
  valueFormatter = (value) => String(value),
  height = 240,
}: AreaChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  const width = 720;
  const padX = 16;
  const padTop = 16;
  const padBottom = 34;
  const chartHeight = height - padTop - padBottom;
  const max = Math.max(...data.map((point) => point.value), 1);
  const stepX =
    data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = padX + index * stepX;
    const y = padTop + chartHeight - (point.value / max) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    padTop + chartHeight
  } L ${points[0].x} ${padTop + chartHeight} Z`;

  const gridLines = 4;
  const labelEvery = Math.ceil(data.length / 7);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sales trend"
      className="h-auto w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: gridLines + 1 }).map((_, index) => {
        const y = padTop + (chartHeight / gridLines) * index;
        return (
          <line
            key={index}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray={index === gridLines ? "0" : "4 6"}
          />
        );
      })}

      <path d={areaPath} fill="url(#area-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {points.map((point, index) => (
        <g key={point.label + index}>
          <circle
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="var(--surface)"
            stroke="var(--primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${point.label}: ${valueFormatter(point.value)}`}</title>
          </circle>
          {index % labelEvery === 0 && (
            <text
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
