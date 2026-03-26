export type RegionPreset = {
  id: string
  label: string
  description: string
  center: [number, number]
  zoom: number
  bbox: {
    south: number
    west: number
    north: number
    east: number
  }
  demo: {
    start: { lat: number; lon: number }
    goal: { lat: number; lon: number }
  }
}

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'banashankari-bangalore',
    label: 'Banashankari, Bangalore',
    description: 'A Bangalore preset with a mix of residential streets and larger connectors, which makes the A* frontier spread less rigidly than a pure grid.',
    center: [12.9236, 77.5561],
    zoom: 15,
    bbox: {
      south: 12.9136,
      west: 77.5435,
      north: 12.9347,
      east: 77.5696,
    },
    demo: {
      start: { lat: 12.9179, lon: 77.5513 },
      goal: { lat: 12.9315, lon: 77.5644 },
    },
  },
  {
    id: 'lower-manhattan',
    label: 'Lower Manhattan',
    description: 'Dense blocks and short decision cycles. Good for seeing the frontier bend around the street grid.',
    center: [40.7147, -74.0072],
    zoom: 15,
    bbox: {
      south: 40.7072,
      west: -74.0177,
      north: 40.7225,
      east: -73.9963,
    },
    demo: {
      start: { lat: 40.7104, lon: -74.0113 },
      goal: { lat: 40.7198, lon: -74.0011 },
    },
  },
  {
    id: 'downtown-san-francisco',
    label: 'Downtown San Francisco',
    description: 'A tighter coastal grid with diagonal interruptions, useful for comparing heuristic guidance to obstacles.',
    center: [37.7881, -122.4049],
    zoom: 15,
    bbox: {
      south: 37.7816,
      west: -122.4148,
      north: 37.7948,
      east: -122.3945,
    },
    demo: {
      start: { lat: 37.7844, lon: -122.4094 },
      goal: { lat: 37.7925, lon: -122.3988 },
    },
  },
  {
    id: 'cambridge-river',
    label: 'Cambridge River Edge',
    description: 'Bridges and rivers force detours, which makes the A* heuristic visibly valuable.',
    center: [42.3627, -71.0948],
    zoom: 15,
    bbox: {
      south: 42.3557,
      west: -71.1115,
      north: 42.3706,
      east: -71.0782,
    },
    demo: {
      start: { lat: 42.3591, lon: -71.1042 },
      goal: { lat: 42.3671, lon: -71.0844 },
    },
  },
]
