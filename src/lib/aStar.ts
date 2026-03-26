import type { RoadGraph } from './osm'
import { haversineDistance } from './geo'

export type AStarFrame = {
  currentId: string
  openIds: string[]
  closedIds: string[]
  pathIds: string[]
}

export type AStarResult = {
  frames: AStarFrame[]
  path: string[]
  pathDistance: number
  visitedCount: number
}

export function runAStar(graph: RoadGraph, startId: string, goalId: string): AStarResult {
  const openSet = new Set([startId])
  const closedSet = new Set<string>()
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>([[startId, 0]])
  const fScore = new Map<string, number>([[startId, estimate(graph, startId, goalId)]])
  const frames: AStarFrame[] = []

  while (openSet.size > 0) {
    const currentId = pickLowestScore(openSet, fScore)
    if (!currentId) {
      break
    }

    if (currentId === goalId) {
      const path = reconstructPath(cameFrom, currentId)
      frames.push({
        currentId,
        openIds: Array.from(openSet),
        closedIds: Array.from(closedSet),
        pathIds: path,
      })

      return {
        frames,
        path,
        pathDistance: computePathDistance(graph, path),
        visitedCount: closedSet.size,
      }
    }

    openSet.delete(currentId)
    closedSet.add(currentId)

    const currentNode = graph.nodes[currentId]
    for (const neighbor of currentNode.neighbors) {
      if (closedSet.has(neighbor.to)) {
        continue
      }

      const tentativeScore = (gScore.get(currentId) ?? Number.POSITIVE_INFINITY) + neighbor.distance
      if (tentativeScore >= (gScore.get(neighbor.to) ?? Number.POSITIVE_INFINITY)) {
        openSet.add(neighbor.to)
        continue
      }

      cameFrom.set(neighbor.to, currentId)
      gScore.set(neighbor.to, tentativeScore)
      fScore.set(neighbor.to, tentativeScore + estimate(graph, neighbor.to, goalId))
      openSet.add(neighbor.to)
    }

    frames.push({
      currentId,
      openIds: Array.from(openSet),
      closedIds: Array.from(closedSet),
      pathIds: reconstructPath(cameFrom, currentId),
    })
  }

  return {
    frames,
    path: [],
    pathDistance: 0,
    visitedCount: closedSet.size,
  }
}

function pickLowestScore(openSet: Set<string>, fScore: Map<string, number>) {
  let currentId: string | null = null
  let currentScore = Number.POSITIVE_INFINITY

  for (const candidateId of openSet) {
    const candidateScore = fScore.get(candidateId) ?? Number.POSITIVE_INFINITY
    if (candidateScore < currentScore) {
      currentId = candidateId
      currentScore = candidateScore
    }
  }

  return currentId
}

function estimate(graph: RoadGraph, fromId: string, toId: string) {
  return haversineDistance(graph.nodes[fromId], graph.nodes[toId])
}

function reconstructPath(cameFrom: Map<string, string>, currentId: string) {
  const path = [currentId]
  let cursor = currentId

  while (cameFrom.has(cursor)) {
    cursor = cameFrom.get(cursor)!
    path.unshift(cursor)
  }

  return path
}

function computePathDistance(graph: RoadGraph, path: string[]) {
  let distance = 0

  for (let index = 0; index < path.length - 1; index += 1) {
    const current = graph.nodes[path[index]]
    const nextId = path[index + 1]
    const edge = current.neighbors.find((neighbor) => neighbor.to === nextId)
    distance += edge?.distance ?? 0
  }

  return distance
}
