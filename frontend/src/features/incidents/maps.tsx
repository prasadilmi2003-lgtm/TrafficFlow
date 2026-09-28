import { useEffect, useRef, type ReactNode } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { MAP_DEFAULTS } from '../../config';
import type { IncidentStatus } from '../../types/api';
import { STATUS_MARKER_COLORS } from '../../utils/labels';

/** OpenStreetMap tiles. Their usage policy requires the attribution shown on the map. */
function OsmTiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  );
}

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  /** Shown on hover */
  label: string;
  /** Shown when the marker is clicked */
  popup?: ReactNode;
}

/** Zooms to fit the markers the first time they arrive (later refreshes keep the user's view). */
function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) {
      map.setView([points[0]!.latitude, points[0]!.longitude], 15);
    } else {
      map.fitBounds(
        points.map((p) => [p.latitude, p.longitude] as [number, number]),
        { padding: [40, 40], maxZoom: 15 },
      );
    }
  }, [map, points]);

  return null;
}

/** Incidents as coloured dots, one colour per status (see the legend). */
export function IncidentMap({ points, height = 520 }: { points: MapPoint[]; height?: number }) {
  return (
    <MapContainer center={MAP_DEFAULTS.center} zoom={MAP_DEFAULTS.zoom} style={{ height }} className="w-full rounded-lg">
      <OsmTiles />
      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.latitude, point.longitude]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: STATUS_MARKER_COLORS[point.status], fillOpacity: 0.95 }}
        >
          <Tooltip>{point.label}</Tooltip>
          {point.popup && <Popup>{point.popup}</Popup>}
        </CircleMarker>
      ))}
      <FitToPoints points={points} />
    </MapContainer>
  );
}

/** A small map showing one location, e.g. on an incident's detail page. */
export function LocationMap({ latitude, longitude, status, height = 220 }: { latitude: number; longitude: number; status: IncidentStatus; height?: number }) {
  return (
    <MapContainer center={[latitude, longitude]} zoom={15} style={{ height }} className="w-full rounded-lg" scrollWheelZoom={false}>
      <OsmTiles />
      <CircleMarker
        center={[latitude, longitude]}
        radius={10}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: STATUS_MARKER_COLORS[status], fillOpacity: 0.95 }}
      />
    </MapContainer>
  );
}

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

function ClickToPick({ onPick }: { onPick: (location: PickedLocation) => void }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) });
    },
  });
  return null;
}

/** Moves the map when the location is set from outside (e.g. "Use my location"). */
function FollowLocation({ location, version }: { location: PickedLocation | null; version: number }) {
  const map = useMap();
  useEffect(() => {
    if (location && version > 0) map.setView([location.latitude, location.longitude], 16);
    // Only react to explicit "go here" requests, not to every click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, map]);
  return null;
}

/** The database stores 6 decimal places (about 10 cm). */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Click on the map to choose where the incident is. */
export function LocationPicker({
  value,
  onChange,
  recenterVersion,
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
  /** Increase to move the map to `value` */
  recenterVersion: number;
}) {
  return (
    <MapContainer
      center={value ? [value.latitude, value.longitude] : MAP_DEFAULTS.center}
      zoom={value ? 16 : MAP_DEFAULTS.zoom}
      style={{ height: 340 }}
      className="w-full cursor-crosshair rounded-lg"
    >
      <OsmTiles />
      <ClickToPick onPick={onChange} />
      <FollowLocation location={value} version={recenterVersion} />
      {value && (
        <CircleMarker
          center={[value.latitude, value.longitude]}
          radius={10}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}

export { round as roundCoordinate };
