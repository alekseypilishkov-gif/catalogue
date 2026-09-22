/** Public assets must respect the GitHub Pages repository subpath. */
export function useAssetUrl() {
  const base = useRuntimeConfig().app.baseURL
  return (path: string) => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
