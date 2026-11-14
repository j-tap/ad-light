import Phaser from 'phaser';
import { config, Point } from '../../config';

export interface TerrainContact {
  hit: boolean,
  x: number,
  y: number,
  normalX: number,
  normalY: number,
}

interface Segment {
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  lengthSq: number,
  normalX: number,
  normalY: number,
  stamp: number,
}

const { cellSize, backfaceLimit, passes } = config.terrain;
const KEY_OFFSET = 4096;
const KEY_STRIDE = 16384;

/**
 * Solid rock as one sided line segments in a spatial hash. Bodies are pushed out as circles,
 * which lets them slide along slopes instead of snagging on the box edges of arcade statics.
 */
export class Terrain {
  private readonly cells = new Map<number, Segment[]>();
  private readonly contact: TerrainContact = { hit: false, x: 0, y: 0, normalX: 0, normalY: 0 };
  private stamp = 0;

  /** An open outline: water is on the right hand side when walking from the first point to the last. */
  addPolyline(points: Point[]) {
    for (let i = 0; i < points.length - 1; i++) {
      this.addSegment(points[i], points[i + 1]);
    }
  }

  /** Closed solid shape, winding does not matter. */
  addPolygon(points: Point[]) {
    const ordered = signedArea(points) > 0 ? points : [...points].reverse();

    for (let i = 0; i < ordered.length; i++) {
      this.addSegment(ordered[i], ordered[(i + 1) % ordered.length]);
    }
  }

  clear() {
    this.cells.clear();
  }

  /** The returned contact object is reused between calls. */
  resolveCircle(x: number, y: number, radius: number): TerrainContact {
    const contact = this.contact;

    contact.hit = false;
    contact.x = x;
    contact.y = y;

    for (let pass = 0; pass < passes; pass++) {
      if (!this.pushOut(contact, radius)) break;
    }

    return contact;
  }

  private pushOut(contact: TerrainContact, radius: number) {
    const minCx = Math.floor((contact.x - radius) / cellSize);
    const maxCx = Math.floor((contact.x + radius) / cellSize);
    const minCy = Math.floor((contact.y - radius) / cellSize);
    const maxCy = Math.floor((contact.y + radius) / cellSize);
    const stamp = ++this.stamp;
    let moved = false;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const segments = this.cells.get(cellKey(cx, cy));

        if (!segments) continue;

        for (const segment of segments) {
          if (segment.stamp === stamp) continue;

          segment.stamp = stamp;

          if (this.pushOutOfSegment(contact, segment, radius)) moved = true;
        }
      }
    }

    return moved;
  }

  private pushOutOfSegment(contact: TerrainContact, segment: Segment, radius: number) {
    const relX = contact.x - segment.ax;
    const relY = contact.y - segment.ay;
    const rawT = (relX * segment.dx + relY * segment.dy) / segment.lengthSq;
    const t = Phaser.Math.Clamp(rawT, 0, 1);
    const closestX = segment.ax + segment.dx * t;
    const closestY = segment.ay + segment.dy * t;
    const offsetX = contact.x - closestX;
    const offsetY = contact.y - closestY;
    const side = offsetX * segment.normalX + offsetY * segment.normalY;

    if (side < 0) {
      // Already behind the face: only a body that just slipped through is brought back.
      if (rawT <= 0 || rawT >= 1 || -side > backfaceLimit) return false;

      return this.place(contact, closestX, closestY, segment.normalX, segment.normalY, radius);
    }

    const distance = Math.hypot(offsetX, offsetY);

    if (distance >= radius) return false;

    if (distance < 0.0001) {
      return this.place(contact, closestX, closestY, segment.normalX, segment.normalY, radius);
    }

    return this.place(contact, closestX, closestY, offsetX / distance, offsetY / distance, radius);
  }

  private place(
    contact: TerrainContact,
    fromX: number,
    fromY: number,
    normalX: number,
    normalY: number,
    radius: number
  ) {
    contact.hit = true;
    contact.x = fromX + normalX * radius;
    contact.y = fromY + normalY * radius;
    contact.normalX = normalX;
    contact.normalY = normalY;

    return true;
  }

  private addSegment(a: Point, b: Point) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) return;

    const length = Math.sqrt(lengthSq);
    const segment: Segment = {
      ax: a.x,
      ay: a.y,
      dx,
      dy,
      lengthSq,
      normalX: dy / length,
      normalY: -dx / length,
      stamp: 0,
    };

    const minCx = Math.floor(Math.min(a.x, b.x) / cellSize);
    const maxCx = Math.floor(Math.max(a.x, b.x) / cellSize);
    const minCy = Math.floor(Math.min(a.y, b.y) / cellSize);
    const maxCy = Math.floor(Math.max(a.y, b.y) / cellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = cellKey(cx, cy);
        const bucket = this.cells.get(key);

        if (bucket) {
          bucket.push(segment);
        } else {
          this.cells.set(key, [segment]);
        }
      }
    }
  }
}

function cellKey(cx: number, cy: number) {
  return (cx + KEY_OFFSET) + (cy + KEY_OFFSET) * KEY_STRIDE;
}

/** Positive for the winding whose right hand side faces outwards on a y-down screen. */
function signedArea(points: Point[]) {
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];

    area += a.x * b.y - b.x * a.y;
  }

  return area;
}
