import type { LatLngTuple } from 'leaflet'
import type { RegionPreset } from '../data/regions'
import { haversineDistance } from './geo'

type OverpassNode = {
  type: 'node'
  id: number
  lat: number
  lon: number
}

type OverpassWay = {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}

type OverpassResponse = {
  elements: Array<OverpassNode | OverpassWay>
}

export type GraphNode = {
  id: string
  lat: number
  lon: number
  neighbors: Array<{ to: string; distance: number }>
}

export type RoadGraph = {
  nodes: Record<string, GraphNode>
  roads: LatLngTuple[][]
  nodeCount: number
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export async function fetchRoadGraph(region: RegionPreset, signal: AbortSignal): Promise<RoadGraph> {
  const query = `
[out:json][timeout:25];
(
  way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed|abandoned|corridor|elevator|steps|platform"](${region.bbox.south},${region.bbox.west},${region.bbox.north},${region.bbox.east});
);
(._;>;);
out body;
`

  const errors: string[] = []

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        body: new URLSearchParams({ data: query }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        method: 'POST',
        signal,
      })

      if (!response.ok) {
        errors.push(`${endpoint} returned ${response.status}`)
        continue
      }

      const data = (await response.json()) as OverpassResponse
      const graph = buildRoadGraph(data)
      if (graph.nodeCount === 0) {
        errors.push(`${endpoint} returned no navigable nodes`)
        continue
      }

      return graph
    } catch (error) {
      if (signal.aborted) {
        throw error
      }

      errors.push(`${endpoint} failed`)
    }
  }

  throw new Error(errors.join('. '))
}

export function snapToNearestNode(graph: RoadGraph, point: { lat: number; lon: number }) {
  let nearest: GraphNode | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const node of Object.values(graph.nodes)) {
    const distance = haversineDistance(node, point)
    if (distance < bestDistance) {
      nearest = node
      bestDistance = distance
    }
  }

  return nearest
}

function buildRoadGraph(data: OverpassResponse): RoadGraph {
  const coordinates = new Map<number, { lat: number; lon: number }>()
  const ways: OverpassWay[] = []

  for (const element of data.elements) {
    if (element.type === 'node') {
      coordinates.set(element.id, { lat: element.lat, lon: element.lon })
    } else if (element.type === 'way' && element.nodes.length > 1) {
      ways.push(element)
    }
  }

  const nodes: Record<string, GraphNode> = {}
  const roads: LatLngTuple[][] = []

  const ensureNode = (nodeId: number) => {
    const key = String(nodeId)
    const coordinate = coordinates.get(nodeId)
    if (!coordinate) {
      return null
    }

    if (!nodes[key]) {
      nodes[key] = {
        id: key,
        lat: coordinate.lat,
        lon: coordinate.lon,
        neighbors: [],
      }
    }

    return nodes[key]
  }

  for (const way of ways) {
    const road: LatLngTuple[] = []
    const isOneway =
      way.tags?.oneway === 'yes' ||
      way.tags?.oneway === '1' ||
      way.tags?.junction === 'roundabout'

    for (let index = 0; index < way.nodes.length; index += 1) {
      const point = coordinates.get(way.nodes[index])
      if (point) {
        road.push([point.lat, point.lon])
      }

      if (index === way.nodes.length - 1) {
        continue
      }

      const from = ensureNode(way.nodes[index])
      const to = ensureNode(way.nodes[index + 1])
      if (!from || !to) {
        continue
      }

      const distance = haversineDistance(from, to)
      from.neighbors.push({ to: to.id, distance })
      if (!isOneway) {
        to.neighbors.push({ to: from.id, distance })
      }
    }

    if (road.length > 1) {
      roads.push(road)
    }
  }

  return {
    nodes,
    roads,
    nodeCount: Object.keys(nodes).length,
  }
}
