/** One plotted point in domain units — x is elapsed ms here, distance/date later. */
export interface ChartPoint {
  x: number;
  y: number;
}

/** A contiguous run of points. A break between segments renders as a gap. */
export type ChartSegment = ChartPoint[];

/** Plot bounds in domain units. */
export interface ChartDomain {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Horizontal marker drawn behind the trace (avg / max here). */
export interface ChartReferenceLine {
  value: number;
  label?: string;
  color: string;
  dashed?: boolean;
}

/** One labelled x-axis position, in domain units. */
export interface ChartTick {
  value: number;
  label: string;
}

/** Pixel rect the series is scaled into, inside the SVG viewport. */
export interface PlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
