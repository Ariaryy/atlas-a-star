import { useMemo } from 'react'
import type { AStarFrame } from '../lib/aStar'
import type { GraphNode, RoadGraph } from '../lib/osm'

type TreeCanvasProps = {
  currentFrame: AStarFrame | null
  goalNode: GraphNode | null
  graph: RoadGraph | null
  startNode: GraphNode | null
}

type TreeNode = {
  id: string
  x: number
  y: number
  group: 'start' | 'goal' | 'path' | 'frontier' | 'closed' | 'discovered'
  scoreLabel: string
}

type TreeLink = {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  isPath: boolean
}

const VIEWBOX_WIDTH = 640
const TOP_PADDING = 54
const SIDE_PADDING = 42
const LEVEL_GAP = 82

export function TreeCanvas({ currentFrame, goalNode, graph, startNode }: TreeCanvasProps) {
  const treeLayout = useMemo(() => {
    if (!graph || !currentFrame) {
      return null
    }

    const discoveredIds = Array.from(new Set<string>([...currentFrame.closedIds, ...currentFrame.openIds]))
    if (discoveredIds.length === 0) {
      return null
    }

    const discoveredSet = new Set(discoveredIds)
    const pathSet = new Set(currentFrame.pathIds)
    const openSet = new Set(currentFrame.openIds)
    const closedSet = new Set(currentFrame.closedIds)
    const pathEdges = new Set<string>()

    for (let index = 0; index < currentFrame.pathIds.length - 1; index += 1) {
      const from = currentFrame.pathIds[index]
      const to = currentFrame.pathIds[index + 1]
      pathEdges.add(`${from}-${to}`)
      pathEdges.add(`${to}-${from}`)
    }

    const depths = new Map<string, number>()
    const visiting = new Set<string>()

    const getDepth = (nodeId: string): number => {
      if (depths.has(nodeId)) {
        return depths.get(nodeId)!
      }

      if (visiting.has(nodeId)) {
        return 0
      }

      visiting.add(nodeId)
      const parentId = currentFrame.cameFrom[nodeId]
      const depth =
        parentId && discoveredSet.has(parentId)
          ? getDepth(parentId) + 1
          : nodeId === startNode?.id
            ? 0
            : 1
      visiting.delete(nodeId)
      depths.set(nodeId, depth)
      return depth
    }

    const groupedByDepth = new Map<number, string[]>()
    for (const nodeId of discoveredIds) {
      const depth = getDepth(nodeId)
      const bucket = groupedByDepth.get(depth) ?? []
      bucket.push(nodeId)
      groupedByDepth.set(depth, bucket)
    }

    for (const bucket of groupedByDepth.values()) {
      bucket.sort((left, right) => {
        const leftScore = currentFrame.scores[left]?.f ?? Number.POSITIVE_INFINITY
        const rightScore = currentFrame.scores[right]?.f ?? Number.POSITIVE_INFINITY
        if (leftScore !== rightScore) {
          return leftScore - rightScore
        }

        return left.localeCompare(right)
      })
    }

    const maxDepth = Math.max(...groupedByDepth.keys())
    const viewBoxHeight = Math.max(320, TOP_PADDING * 2 + maxDepth * LEVEL_GAP + 64)
    const nodes = new Map<string, TreeNode>()

    groupedByDepth.forEach((bucket, depth) => {
      const availableWidth = VIEWBOX_WIDTH - SIDE_PADDING * 2
      const slotWidth = bucket.length > 1 ? availableWidth / (bucket.length - 1) : 0
      const y = TOP_PADDING + depth * LEVEL_GAP

      bucket.forEach((nodeId, index) => {
        const x =
          bucket.length === 1
            ? VIEWBOX_WIDTH / 2
            : SIDE_PADDING + slotWidth * index

        let group: TreeNode['group'] = 'discovered'
        if (nodeId === startNode?.id) {
          group = 'start'
        } else if (nodeId === goalNode?.id) {
          group = 'goal'
        } else if (pathSet.has(nodeId)) {
          group = 'path'
        } else if (openSet.has(nodeId)) {
          group = 'frontier'
        } else if (closedSet.has(nodeId)) {
          group = 'closed'
        }

        const score = currentFrame.scores[nodeId]?.f
        nodes.set(nodeId, {
          id: nodeId,
          x,
          y,
          group,
          scoreLabel:
            score != null && Number.isFinite(score)
              ? Math.round(score).toString()
              : '',
        })
      })
    })

    const links: TreeLink[] = []
    for (const nodeId of discoveredIds) {
      const parentId = currentFrame.cameFrom[nodeId]
      if (!parentId || !discoveredSet.has(parentId)) {
        continue
      }

      const source = nodes.get(parentId)
      const target = nodes.get(nodeId)
      if (!source || !target) {
        continue
      }

      links.push({
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        isPath: pathEdges.has(`${parentId}-${nodeId}`),
      })
    }

    return {
      viewBoxHeight,
      links,
      nodes: Array.from(nodes.values()),
    }
  }, [currentFrame, goalNode, graph, startNode])

  if (!treeLayout) {
    return (
      <div className="tree-canvas tree-canvas--empty">
        Structured tree will build here during playback.
      </div>
    )
  }

  return (
    <div className="tree-canvas">
      <svg
        aria-label="A* search tree"
        className="tree-canvas__svg"
        preserveAspectRatio="xMidYMin meet"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${treeLayout.viewBoxHeight}`}
      >
        {treeLayout.links.map((link, index) => (
          <line
            key={`link-${index}`}
            stroke={link.isPath ? '#d95550' : 'rgba(53, 92, 125, 0.35)'}
            strokeWidth={link.isPath ? 3 : 1.4}
            x1={link.sourceX}
            x2={link.targetX}
            y1={link.sourceY}
            y2={link.targetY}
          />
        ))}

        {treeLayout.nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <circle
              cx={0}
              cy={0}
              fill={getNodeColor(node.group)}
              r={node.group === 'start' || node.group === 'goal' ? 7 : 5}
            />
            {node.scoreLabel ? (
              <text
                className="tree-canvas__label"
                dominantBaseline="hanging"
                textAnchor="middle"
                x={0}
                y={10}
              >
                {node.scoreLabel}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  )
}

function getNodeColor(group: TreeNode['group']) {
  switch (group) {
    case 'start':
      return '#1c8f63'
    case 'goal':
      return '#8f3140'
    case 'path':
      return '#d95550'
    case 'frontier':
      return '#d58d36'
    case 'closed':
      return '#355c7d'
    default:
      return '#6f8799'
  }
}
