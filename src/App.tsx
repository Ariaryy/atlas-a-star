import { startTransition, useDeferredValue, useEffect, useCallback, useMemo, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { MapCanvas } from './components/MapCanvas'
import { TreeCanvas } from './components/TreeCanvas'
import { REGION_PRESETS } from './data/regions'
import { runAStar } from './lib/aStar'
import { snapToNearestNode, type RoadGraph, fetchRoadGraph } from './lib/osm'

type SelectionMode = 'start' | 'goal'
type LoadState =
  | { status: 'loading'; graph: null; error: null }
  | { status: 'ready'; graph: RoadGraph; error: null }
  | { status: 'error'; graph: null; error: string }

const DEFAULT_SPEED = 70

function App() {
  const [regionId, setRegionId] = useState(REGION_PRESETS[0].id)
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    graph: null,
    error: null,
  })
  const [startId, setStartId] = useState<string | null>(null)
  const [goalId, setGoalId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('start')
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)

  const region = useMemo(
    () => REGION_PRESETS.find((entry) => entry.id === regionId) ?? REGION_PRESETS[0],
    [regionId],
  )

  useEffect(() => {
    const controller = new AbortController()

    fetchRoadGraph(region, controller.signal)
      .then((graph) => {
        startTransition(() => {
          setLoadState({ status: 'ready', graph, error: null })

          const demoStart = snapToNearestNode(graph, region.demo.start)
          const demoGoal = snapToNearestNode(graph, region.demo.goal)
          setStartId(demoStart?.id ?? null)
          setGoalId(demoGoal?.id ?? null)
          setPlaybackIndex(0)
          setIsPlaying(true)
          setSelectionMode('start')
        })
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setLoadState({
          status: 'error',
          graph: null,
          error: error.message || 'Unable to load street data for this region.',
        })
      })

    return () => controller.abort()
  }, [region])

  const result = useMemo(() => {
    if (loadState.status !== 'ready' || !startId || !goalId || startId === goalId) {
      return null
    }

    return runAStar(loadState.graph, startId, goalId)
  }, [goalId, loadState, startId])

  const maxFrameIndex = Math.max((result?.frames.length ?? 1) - 1, 0)
  const frameIndex = Math.min(playbackIndex, maxFrameIndex)
  const currentFrame = result?.frames[frameIndex] ?? null
  const deferredFrame = useDeferredValue(currentFrame)

  const tickPlayback = useCallback(() => {
    if (!result) {
      return
    }

    startTransition(() => {
      setPlaybackIndex((current) => {
        if (current >= result.frames.length - 1) {
          setIsPlaying(false)
          return current
        }

        return current + 1
      })
    })
  }, [result])

  useEffect(() => {
    if (!isPlaying || !result || result.frames.length < 2) {
      return
    }

    const intervalId = window.setInterval(tickPlayback, speed)
    return () => window.clearInterval(intervalId)
  }, [isPlaying, result, speed, tickPlayback])

  const handleMapPick = (lat: number, lon: number) => {
    if (loadState.status !== 'ready') {
      return
    }

    const snapped = snapToNearestNode(loadState.graph, { lat, lon })
    if (!snapped) {
      return
    }

    if (selectionMode === 'start') {
      setStartId(snapped.id)
      setPlaybackIndex(0)
      setIsPlaying(false)
      setSelectionMode('goal')
      return
    }

    setGoalId(snapped.id)
    setPlaybackIndex(0)
    setIsPlaying(true)
    setSelectionMode('start')
  }

  const loadDemoRoute = () => {
    if (loadState.status !== 'ready') {
      return
    }

    const demoStart = snapToNearestNode(loadState.graph, region.demo.start)
    const demoGoal = snapToNearestNode(loadState.graph, region.demo.goal)
    setStartId(demoStart?.id ?? null)
    setGoalId(demoGoal?.id ?? null)
    setPlaybackIndex(0)
    setIsPlaying(true)
  }

  const clearRoute = () => {
    setStartId(null)
    setGoalId(null)
    setPlaybackIndex(0)
    setIsPlaying(false)
    setSelectionMode('start')
  }

  const startNode = loadState.status === 'ready' && startId ? loadState.graph.nodes[startId] : null
  const goalNode = loadState.status === 'ready' && goalId ? loadState.graph.nodes[goalId] : null
  const exploredNodes = deferredFrame?.closedIds.length ?? 0
  const frontierNodes = deferredFrame?.openIds.length ?? 0
  const progress = result ? Math.round(((frameIndex + 1) / result.frames.length) * 100) : 0
  const pathDistanceKm = result ? (result.pathDistance / 1000).toFixed(2) : '--'

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero__intro">
          <p className="eyebrow">Real street data. Live search playback.</p>
          <h1>Atlas A*</h1>
          <p className="hero__lede">
            Pick two points on a real OpenStreetMap street network and watch A* grow its frontier,
            commit explored intersections, and converge on the route.
          </p>
        </div>

        <div className="hero__stats" aria-label="Visualizer summary">
          <article>
            <span>Region graph</span>
            <strong>{loadState.status === 'ready' ? loadState.graph.nodeCount.toLocaleString() : '--'}</strong>
          </article>
          <article>
            <span>Explored now</span>
            <strong>{exploredNodes.toLocaleString()}</strong>
          </article>
          <article>
            <span>Path length</span>
            <strong>{pathDistanceKm} km</strong>
          </article>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel panel--controls">
          <div className="panel__section">
            <label className="field">
              <span>Urban region</span>
              <select
                value={regionId}
                onChange={(event) => {
                  setLoadState({ status: 'loading', graph: null, error: null })
                  setStartId(null)
                  setGoalId(null)
                  setPlaybackIndex(0)
                  setIsPlaying(true)
                  setSelectionMode('start')
                  setRegionId(event.target.value)
                }}
              >
                {REGION_PRESETS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="region-copy">{region.description}</p>
          </div>

          <div className="panel__section">
            <div className="segmented" role="tablist" aria-label="Point selection mode">
              <button
                className={selectionMode === 'start' ? 'is-active' : ''}
                onClick={() => setSelectionMode('start')}
                type="button"
              >
                Place start
              </button>
              <button
                className={selectionMode === 'goal' ? 'is-active' : ''}
                onClick={() => setSelectionMode('goal')}
                type="button"
              >
                Place goal
              </button>
            </div>

            <div className="actions">
              <button className="button button--primary" onClick={loadDemoRoute} type="button">
                Load demo route
              </button>
              <button className="button" onClick={clearRoute} type="button">
                Clear points
              </button>
            </div>
          </div>

          <div className="panel__section">
            <div className="timeline">
              <div className="timeline__header">
                <span>Playback</span>
                <strong>{progress}%</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  className="button"
                  style={{ minHeight: 'auto', padding: '0.45rem 0.6rem' }}
                  onClick={() => {
                    setPlaybackIndex(Math.max(0, frameIndex - 1))
                    setIsPlaying(false)
                  }}
                  disabled={frameIndex <= 0}
                  type="button"
                  title="Previous Step"
                >
                  ◀
                </button>
                <input
                  aria-label="Playback progress"
                  max={maxFrameIndex}
                  min={0}
                  step={1}
                  onChange={(event) => {
                    setPlaybackIndex(Number(event.target.value))
                    setIsPlaying(false)
                  }}
                  type="range"
                  value={frameIndex}
                  style={{ flex: 1 }}
                />
                <button
                  className="button"
                  style={{ minHeight: 'auto', padding: '0.45rem 0.6rem' }}
                  onClick={() => {
                    setPlaybackIndex(Math.min(maxFrameIndex, frameIndex + 1))
                    setIsPlaying(false)
                  }}
                  disabled={frameIndex >= maxFrameIndex}
                  type="button"
                  title="Next Step"
                >
                  ▶
                </button>
              </div>

              <div className="actions">
                <button
                  className="button button--primary"
                  onClick={() => {
                    if (!result) {
                      return
                    }

                    if (frameIndex >= maxFrameIndex) {
                      setPlaybackIndex(0)
                    }

                    setIsPlaying((current) => !current || frameIndex >= maxFrameIndex)
                  }}
                  type="button"
                >
                  {isPlaying ? 'Pause' : frameIndex >= maxFrameIndex ? 'Replay' : 'Play'}
                </button>

                <label className="field field--inline">
                  <span>Speed</span>
                  <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                    <option value={130}>Slow</option>
                    <option value={70}>Normal</option>
                    <option value={30}>Fast</option>
                  </select>
                </label>
              </div>
            </div>
          </div>



          <div className="panel__section panel__section--compact">
            <div className="metric-list">
              <div>
                <span>Frontier nodes</span>
                <strong>{frontierNodes.toLocaleString()}</strong>
              </div>
              <div>
                <span>Visited total</span>
                <strong>{result?.visitedCount.toLocaleString() ?? '--'}</strong>
              </div>
              <div>
                <span>Route points</span>
                <strong>{result?.path.length.toLocaleString() ?? '--'}</strong>
              </div>
            </div>
          </div>

          <div className="panel__section panel__section--compact">
            <div className="legend">
              <div><i className="legend__swatch legend__swatch--start" />Start</div>
              <div><i className="legend__swatch legend__swatch--goal" />Goal</div>
              <div><i className="legend__swatch legend__swatch--frontier" />Frontier</div>
              <div><i className="legend__swatch legend__swatch--closed" />Explored</div>
              <div><i className="legend__swatch legend__swatch--path" />Final path</div>
            </div>
          </div>
        </aside>

        <section className="panel panel--map">
          <header className="map-header">
            <div>
              <p className="eyebrow">Interaction</p>
              <h2>
                {selectionMode === 'start'
                  ? 'Click the map to place the start node.'
                  : 'Click the map to place the goal node.'}
              </h2>
            </div>
            <p className="map-header__copy">
              Road geometry comes from Overpass / OpenStreetMap. Clicks are snapped to the nearest
              graph node so the search always runs on actual street intersections.
            </p>
          </header>

          <div className="map-frame visualizations-wrap">
            <div className="map-container">
              <MapCanvas
                currentFrame={deferredFrame}
                goalNode={goalNode}
                graph={loadState.status === 'ready' ? loadState.graph : null}
                isLoading={loadState.status === 'loading'}
                onMapPick={handleMapPick}
                region={region}
                startNode={startNode}
              />
            </div>

            <div className="tree-container">
              <TreeCanvas
                currentFrame={deferredFrame}
                goalNode={goalNode}
                graph={loadState.status === 'ready' ? loadState.graph : null}
                startNode={startNode}
              />
            </div>

            {loadState.status === 'error' ? (
              <div className="map-notice map-notice--error">{loadState.error}</div>
            ) : null}
            {loadState.status === 'loading' ? (
              <div className="map-notice">Downloading a compact road graph for {region.label}...</div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
