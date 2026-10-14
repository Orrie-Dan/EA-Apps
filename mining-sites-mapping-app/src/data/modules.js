import { features } from './features.generated.js'

/**
 * This portal carries ONE module. It was split out of the combined
 * Environmental and Natural Resource portal so each module ships, deploys and
 * is access-controlled on its own.
 *
 * The shape is unchanged from the parent — same fields, same guard — so a
 * module can be moved back or across without touching any component.
 */
export const modules = [
  {
    id: "mining",
    index: '01',
    name: "Mining Sites Mapping",
    accent: "#A65B2A",
    accentText: "#A65B2A",
    description: "Sites, licences, inspections and impact zones.",
    cardSlug: "mining-card",
    heroSlug: "mining-hero",
    cardAlt: "Excavation machinery working an open pit mine",
    apps: [
      {
        name: "Mine Sites Impact Assessment",
        url: "https://gh.space.gov.rw/portal/apps/dashboards/e0ff7e399bb04d4eb1053cae87c62468",
        year: "Year 1",
      },
      {
        name: "Mining Inspection Mapping",
        url: "https://gh.space.gov.rw/portal/apps/dashboards/38f39faf97994383a409255e193b5b60",
        year: "Year 2",
      },
    ],
    features: features.mining,
  },
]

// Derived, never typed.
export const totals = {
  modules: modules.length,
  apps: modules.reduce((n, m) => n + m.apps.length, 0),
  features: modules.reduce((n, m) => n + m.features.length, 0),
}

export const getModule = (id) => modules.find((m) => m.id === id)
