import { useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { AStarFrame } from '../lib/aStar'
import type { GraphNode, RoadGraph } from '../lib/osm'

type TreeCanvasProps = {
  currentFrame: AStarFrame | null
  goalNode: GraphNode | null
  graph: RoadGraph | null
  startNode: GraphNode | null
}

export function TreeCanvas({ currentFrame, goalNode, graph, startNode }: TreeCanvasProps) {
  const treeData = useMemo(() => {
    if (!graph || !currentFrame) {
      return { nodes: [], links: [] }
    }

    const discoveredIds = new Set<string>([...currentFrame.closedIds, ...currentFrame.openIds])
    
    // Build path set for coloring
    const pathSet = new Set(currentFrame.pathIds)
    const pathEdges = new Set<string>()
    if (currentFrame.pathIds.length > 1) {
      for (let i = 0; i < currentFrame.pathIds.length - 1; i++) {
        const u = currentFrame.pathIds[i]
        const v = currentFrame.pathIds[i + 1]
        pathEdges.add(`${u}-${v}`)
        pathEdges.add(`${v}-${u}`)
      }
    }

    const openSet = new Set(currentFrame.openIds)
    const closedSet = new Set(currentFrame.closedIds)

    const nodes = Array.from(discoveredIds).map((id) => {
      let group = 'discovered'
      if (id === startNode?.id) group = 'start'
      else if (id === goalNode?.id) group = 'goal'
      else if (pathSet.has(id)) group = 'path'
      else if (openSet.has(id)) group = 'frontier'
      else if (closedSet.has(id)) group = 'closed'
      
      const fScore = currentFrame.scores?.[id]?.f
      return { id, group, fScore }
    })

    const links: any[] = []
    
    // Explicitly draw links forming the cameFrom hierarchy
    for (const childId of discoveredIds) {
      const parentId = currentFrame.cameFrom[childId]
      if (parentId && discoveredIds.has(parentId)) {
        const isPath = pathEdges.has(`${parentId}-${childId}`)
        links.push({
          source: parentId, // Point parent -> child for Top-Down Tree
          target: childId,
          isPath,
        })
      }
    }

    return { nodes, links }
  }, [currentFrame, graph, startNode, goalNode])

  const getNodeColor = (node: any) => {
    switch (node.group) {
      case 'start': return '#1c8f63'
      case 'goal': return '#8f3140'
      case 'path': return '#d95550'
      case 'frontier': return '#d58d36'
      case 'closed': return '#355c7d'
      default: return '#355c7d'
    }
  }

  const getLinkColor = (link: any) => {
    return link.isPath ? '#d95550' : 'rgba(53, 92, 125, 0.4)'
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      {treeData.nodes.length > 0 ? (
        <ForceGraph2D
          graphData={treeData}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const hasValidScore = node.fScore != null && node.fScore !== Number.POSITIVE_INFINITY
            const label = hasValidScore ? Math.round(node.fScore).toString() : ''
            
            // Draw circle
            const radius = 4
            ctx.beginPath()
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
            ctx.fillStyle = getNodeColor(node)
            ctx.fill()
            
            // Draw text adjacent to circle if zoomed in
            if (label && globalScale > 1.3) {
              const fontSize = 11 / globalScale
              ctx.font = `${fontSize}px Sans-Serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = '#11181c' // Dark ink color
              ctx.fillText(label, node.x, node.y + radius + (3 / globalScale))
            }
          }}
          linkColor={getLinkColor}
          linkWidth={(link: any) => (link.isPath ? 3 : 1)}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          dagMode="td"
          dagLevelDistance={40}
          enableNodeDrag={false}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={100}
        />
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Structured tree will build here during playback.
        </div>
      )}
    </div>
  )
}
