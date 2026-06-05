import { cp, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const root = process.cwd()
const standaloneDir = join(root, '.next', 'standalone')

const assetCopies = [
  {
    label: 'Next static assets',
    source: join(root, '.next', 'static'),
    destination: join(standaloneDir, '.next', 'static'),
  },
  {
    label: 'public assets',
    source: join(root, 'public'),
    destination: join(standaloneDir, 'public'),
  },
]

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

if (!await exists(standaloneDir)) {
  console.warn('Standalone output was not found; skipping asset copy.')
  process.exit(0)
}

for (const assetCopy of assetCopies) {
  if (!await exists(assetCopy.source)) {
    console.warn(`${assetCopy.label} not found; skipping.`)
    continue
  }

  await mkdir(dirname(assetCopy.destination), { recursive: true })
  await cp(assetCopy.source, assetCopy.destination, {
    recursive: true,
    force: true,
  })
  console.log(`Copied ${assetCopy.label} to ${assetCopy.destination}`)
}
