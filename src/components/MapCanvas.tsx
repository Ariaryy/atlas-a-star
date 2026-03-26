import { useEffect } from 'react'
import type { LeafletMouseEvent } from 'leaflet'
import { CircleMarker, MapContainer, Pane, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { AStarFrame } from '../lib/aStar'
import type { RegionPreset } from '../data/regions'
import type { GraphNode, RoadGraph } from '../lib/osm'

type MapCanvasProps = {
  currentFrame: AStarFrame | null
  goalNode: GraphNode | null
  graph: RoadGraph | null
  isLoading: boolean
  onMapPick: (lat: number, lon: number) => void
  region: RegionPreset
  startNode: GraphNode | null
}

function MapViewport({ region }: { region: RegionPreset }) {
  const map = useMap()

  useEffect(() => {
    map.setView(region.center, region.zoom, { animate: false })
  }, [map, region])

  return null
}

function MapClickHandler({ onMapPick }: Pick<MapCanvasProps, 'onMapPick'>) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onMapPick(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

export function MapCanvas({
  currentFrame,
  goalNode,
  graph,
  isLoading,
  onMapPick,
  region,
  startNode,
}: MapCanvasProps) {
  const openNodes = currentFrame?.openIds
    .map((id) => graph?.nodes[id] ?? null)
    .filter((node): node is GraphNode => node !== null) ?? []
  const closedNodes = currentFrame?.closedIds
    .map((id) => graph?.nodes[id] ?? null)
    .filter((node): node is GraphNode => node !== null) ?? []
  const pathNodes = currentFrame?.pathIds
    .map((id) => graph?.nodes[id] ?? null)
    .filter((node): node is GraphNode => node !== null) ?? []
  const finalPath = pathNodes.map((node) => [node.lat, node.lon] as [number, number])

  return (
    <MapContainer
      attributionControl={false}
      center={region.center}
      className="map"
      scrollWheelZoom
      zoom={region.zoom}
      zoomControl={!isLoading}
    >
      <MapViewport region={region} />
      <MapClickHandler onMapPick={onMapPick} />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {graph ? (
        <>
          <Pane name="roads" style={{ zIndex: 390 }}>
            {graph.roads.map((road, index) => (
              <Polyline
                color="#253a49"
                key={`${index}-${road.length}`}
                opacity={0.4}
                pane="roads"
                positions={road}
                weight={2}
              />
            ))}
          </Pane>

          <Pane name="closed" style={{ zIndex: 410 }}>
            {closedNodes.map((node) => (
              <CircleMarker
                center={[node.lat, node.lon]}
                color="#355c7d"
                fillColor="#355c7d"
                fillOpacity={0.35}
                key={`closed-${node.id}`}
                pane="closed"
                radius={3}
                stroke={false}
              />
            ))}
          </Pane>

          <Pane name="frontier" style={{ zIndex: 420 }}>
            {openNodes.map((node) => (
              <CircleMarker
                center={[node.lat, node.lon]}
                color="#d58d36"
                fillColor="#d58d36"
                fillOpacity={0.85}
                key={`open-${node.id}`}
                pane="frontier"
                radius={3.5}
                stroke={false}
              />
            ))}
          </Pane>

          <Pane name="path" style={{ zIndex: 430 }}>
            {finalPath.length > 1 ? (
              <Polyline color="#d95550" opacity={0.95} pane="path" positions={finalPath} weight={6} />
            ) : null}
          </Pane>

          {startNode ? (
            <CircleMarker
              center={[startNode.lat, startNode.lon]}
              color="#1c8f63"
              fillColor="#1c8f63"
              fillOpacity={1}
              radius={8}
              weight={2}
            />
          ) : null}

          {goalNode ? (
            <CircleMarker
              center={[goalNode.lat, goalNode.lon]}
              color="#8f3140"
              fillColor="#8f3140"
              fillOpacity={1}
              radius={8}
              weight={2}
            />
          ) : null}
        </>
      ) : null}
    </MapContainer>
  )
}
