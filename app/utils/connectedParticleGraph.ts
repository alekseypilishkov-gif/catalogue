export interface ConnectedGraphOptions {
  nodeCount: number
  maxConnectionDistance: number
  maxNeighbors: number
}

export interface ConnectedGraphData {
  nodePositions: Float32Array
  nodePhases: Float32Array
  nodeDirections: Float32Array
  nodeSizes: Float32Array
  linePositions: Float32Array
  linePhases: Float32Array
  lineDirections: Float32Array
  lineStrengths: Float32Array
  edgeCount: number
}

function hash(index: number, salt: number) {
  const value = Math.sin((index + 1) * salt) * 43758.5453123
  return value - Math.floor(value)
}

function cellKey(x: number, y: number, z: number, cellSize: number) {
  return `${Math.floor(x / cellSize)}|${Math.floor(y / cellSize)}|${Math.floor(z / cellSize)}`
}

export function buildConnectedParticleGraph(source: Float32Array, options: ConnectedGraphOptions): ConnectedGraphData {
  const sourceCount = Math.floor(source.length / 3)
  const nodeCount = Math.max(2, Math.min(sourceCount, Math.round(options.nodeCount)))
  const maxDistance = Math.max(0.001, options.maxConnectionDistance)
  const maxNeighbors = Math.max(1, Math.round(options.maxNeighbors))
  const nodePositions = new Float32Array(nodeCount * 3)
  const nodePhases = new Float32Array(nodeCount)
  const nodeDirections = new Float32Array(nodeCount * 3)
  const nodeSizes = new Float32Array(nodeCount)
  const bins = new Map<string, number[]>()

  for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
    const sourceIndex = nodeIndex * 7919 % sourceCount
    const sourceOffset = sourceIndex * 3
    const offset = nodeIndex * 3
    const x = source[sourceOffset] ?? 0
    const y = source[sourceOffset + 1] ?? 0
    const z = source[sourceOffset + 2] ?? 0
    nodePositions[offset] = x
    nodePositions[offset + 1] = y
    nodePositions[offset + 2] = z
    nodePhases[nodeIndex] = hash(sourceIndex, 12.9898) * Math.PI * 2
    nodeSizes[nodeIndex] = 0.78 + hash(sourceIndex, 41.531) * 0.58

    let directionX = hash(sourceIndex, 17.231) * 2 - 1
    let directionY = hash(sourceIndex, 29.417) * 2 - 1
    let directionZ = hash(sourceIndex, 53.173) * 2 - 1
    const directionLength = Math.hypot(directionX, directionY, directionZ) || 1
    directionX /= directionLength
    directionY /= directionLength
    directionZ /= directionLength
    nodeDirections[offset] = directionX
    nodeDirections[offset + 1] = directionY
    nodeDirections[offset + 2] = directionZ

    const key = cellKey(x, y, z, maxDistance)
    const bin = bins.get(key)
    if (bin) bin.push(nodeIndex)
    else bins.set(key, [nodeIndex])
  }

  const degrees = new Uint8Array(nodeCount)
  const edges: Array<{ from: number, to: number, strength: number }> = []
  const maxDistanceSquared = maxDistance * maxDistance

  for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
    if ((degrees[nodeIndex] ?? 0) >= maxNeighbors) continue
    const offset = nodeIndex * 3
    const x = nodePositions[offset] ?? 0
    const y = nodePositions[offset + 1] ?? 0
    const z = nodePositions[offset + 2] ?? 0
    const cellX = Math.floor(x / maxDistance)
    const cellY = Math.floor(y / maxDistance)
    const cellZ = Math.floor(z / maxDistance)
    const candidates: Array<{ index: number, distanceSquared: number }> = []

    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const bin = bins.get(`${cellX + dx}|${cellY + dy}|${cellZ + dz}`)
          if (!bin) continue
          for (const candidateIndex of bin) {
            if (candidateIndex <= nodeIndex || (degrees[candidateIndex] ?? 0) >= maxNeighbors) continue
            const candidateOffset = candidateIndex * 3
            const deltaX = (nodePositions[candidateOffset] ?? 0) - x
            const deltaY = (nodePositions[candidateOffset + 1] ?? 0) - y
            const deltaZ = (nodePositions[candidateOffset + 2] ?? 0) - z
            const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
            if (distanceSquared <= maxDistanceSquared) candidates.push({ index: candidateIndex, distanceSquared })
          }
        }
      }
    }

    candidates.sort((a, b) => a.distanceSquared - b.distanceSquared)
    for (const candidate of candidates) {
      if ((degrees[nodeIndex] ?? 0) >= maxNeighbors) break
      if ((degrees[candidate.index] ?? 0) >= maxNeighbors) continue
      const normalizedDistance = Math.sqrt(candidate.distanceSquared) / maxDistance
      edges.push({ from: nodeIndex, to: candidate.index, strength: Math.pow(1 - normalizedDistance, 0.65) })
      degrees[nodeIndex] = (degrees[nodeIndex] ?? 0) + 1
      degrees[candidate.index] = (degrees[candidate.index] ?? 0) + 1
    }
  }

  const vertexCount = edges.length * 2
  const linePositions = new Float32Array(vertexCount * 3)
  const linePhases = new Float32Array(vertexCount)
  const lineDirections = new Float32Array(vertexCount * 3)
  const lineStrengths = new Float32Array(vertexCount)

  edges.forEach((edge, edgeIndex) => {
    const vertices = [edge.from, edge.to]
    vertices.forEach((nodeIndex, endpointIndex) => {
      const nodeOffset = nodeIndex * 3
      const vertexIndex = edgeIndex * 2 + endpointIndex
      const vertexOffset = vertexIndex * 3
      linePositions[vertexOffset] = nodePositions[nodeOffset] ?? 0
      linePositions[vertexOffset + 1] = nodePositions[nodeOffset + 1] ?? 0
      linePositions[vertexOffset + 2] = nodePositions[nodeOffset + 2] ?? 0
      linePhases[vertexIndex] = nodePhases[nodeIndex] ?? 0
      lineDirections[vertexOffset] = nodeDirections[nodeOffset] ?? 0
      lineDirections[vertexOffset + 1] = nodeDirections[nodeOffset + 1] ?? 0
      lineDirections[vertexOffset + 2] = nodeDirections[nodeOffset + 2] ?? 0
      lineStrengths[vertexIndex] = edge.strength
    })
  })

  return {
    nodePositions,
    nodePhases,
    nodeDirections,
    nodeSizes,
    linePositions,
    linePhases,
    lineDirections,
    lineStrengths,
    edgeCount: edges.length,
  }
}
