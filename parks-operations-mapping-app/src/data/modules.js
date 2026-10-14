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
    id: "parks",
    index: '01',
    name: "Parks Operations Mapping",
    accent: "#C98A21",
    accentText: "#9B6A19",
    description: "Park operations, ranger reporting, wildlife incidents and visitor analytics.",
    cardSlug: "parks-card",
    heroSlug: "parks-hero",
    cardAlt: "Zebra on open savannah in Akagera National Park",
    /*
     * Applications, and the groups they hang under.
     *
     * An entry with `apps` instead of `url` is a GROUP: a label carrying
     * dashboards, not something that opens. The Experience Builder app
     * "Park Operation Monitoring" (13f0692d…) is exactly that — it was one
     * embed whose own top nav led to four dashboards, so the frame showed a
     * landing page the user then had to navigate a second time. The four are
     * listed here instead and open directly, under a group named for the app
     * they came from.
     *
     * The order is the app's own nav order, so anyone who knows the app finds
     * the same sequence here. Leaves keep the exact shape they always had —
     * name, url, year — so a portal that groups nothing is unaffected, and an
     * application can still be moved between portals untouched.
     */
    apps: [
      {
        name: "Parks Operations Mapping",
        apps: [
          {
            name: "Gorilla Monitoring",
            url: "https://gis.rdb.rw/portal/apps/dashboards/c33a701b3592459c9ded457313ac8a8c",
            year: "Year 2",
            form: {
              name: "Gorilla Monitoring Reporting Form",
              url: "https://survey123.arcgis.com/share/9f3a1e1c3b9e418497c92c4cf18a15e7?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            name: "Golden Monkey Monitoring",
            url: "https://gis.rdb.rw/portal/apps/dashboards/c1f3d6464dac4fa1a5c986b558d04331",
            year: "Year 2",
            form: {
              name: "Golden Monkey Monitoring Reporting Form",
              url: "https://survey123.arcgis.com/share/e57d72b1c07649879e2dd399ed31450d?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            name: "Chimpanzee Monitoring",
            url: "https://gis.rdb.rw/portal/apps/dashboards/9db15ec819064462a1a325552daa6ac2",
            year: "Year 2",
            form: {
              name: "Chimpanzee Monitoring Reporting Form",
              url: "https://survey123.arcgis.com/share/959b131820424d51b9b07859027e9f30?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            name: "Plant Monitoring",
            url: "https://gis.rdb.rw/portal/apps/dashboards/37e9e92af64a41878564d035c41bd5cf",
            year: "Year 2",
            form: {
              name: "Plant Monitoring Reporting Form",
              url: "https://survey123.arcgis.com/share/a6326fda98cf4b81b53f7a64f20ba41f?portalUrl=https://gis.rdb.rw/portal",
            },
          },
        ],
      },
      /*
       * Wildlife Conservation Mapping.
       *
       * The entry that arrived from the Conservation portal carried a single
       * URL, and it turned out to be the Gorilla Health Check dashboard now
       * listed above — so this is the real set, five RDB dashboards named by
       * the portal itself. They are `access: "org"` rather than public, so they
       * only resolve for a signed-in user; the proxy attaches the same RDB
       * token as everything else here, so nothing about the plumbing changes.
       *
       * `form` is the Survey123 form that FEEDS that dashboard — the data entry
       * side of the same activity, which is why it hangs off the dashboard
       * rather than sitting in a list of its own. Every dashboard in both
       * groups has one.
       *
       * Its `name` is its dashboard's name plus "Reporting Form", for every form,
       * so the rows read as one set. The portal's own titles are not used:
       * they follow no pattern — some repeat their dashboard
       * ("Law__Enforcement"), some are placeholders ("Form 63"). The suffix is
       * what tells a row that COLLECTS the data from the row that shows it, so
       * a dashboard rename should carry through to its form.
       *
       * The URL is the share link exactly as Survey123 gives it, but the
       * browser never frames it as written: formEmbedUrl() serves it through
       * /api/forms and points `portalUrl` at this origin's portal proxy, so the
       * layer the form submits to gets the session token. `portalUrl` must
       * still be here — check-data.mjs requires it, and it records which
       * Enterprise the form belongs to.
       */
      {
        name: "Wildlife Conservation Mapping",
        apps: [
          {
            name: "Human-Wildlife Conflicts in VNP",
            url: "https://gis.rdb.rw/portal/apps/dashboards/ca6e8cdbba0d409e8a249a910d0707cb",
            year: "Year 1",
            form: {
              name: "Human-Wildlife Conflicts in VNP Reporting Form",
              url: "https://survey123.arcgis.com/share/286ae53b851d4bff90868e0268b1d6fe?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            name: "Human-Wildlife Conflict In GMNP",
            url: "https://gis.rdb.rw/portal/apps/dashboards/9e7b6650d9f44db899846a90c289735d",
            year: "Year 1",
            form: {
              name: "Human-Wildlife Conflict In GMNP Reporting Form",
              url: "https://survey123.arcgis.com/share/5fa9f254369c4aeca497bc6bf11c86d0?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            // Portal title: "Illegal activities dashboard".
            name: "Illegal Activities",
            url: "https://gis.rdb.rw/portal/apps/dashboards/a2851299719e40408cc131cabcf41e5f",
            year: "Year 1",
            form: {
              name: "Illegal Activities Reporting Form",
              url: "https://survey123.arcgis.com/share/60c394294a004be3a8286c29db16d3df?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            // Portal title: "Law__Enforcement" — the double underscore is a
            // typo in the item, not a name to reproduce in the sidebar.
            name: "Law Enforcement",
            url: "https://gis.rdb.rw/portal/apps/dashboards/c1c9bd914a9c4cdaac8411977ae90b21",
            year: "Year 1",
            form: {
              name: "Law Enforcement Reporting Form",
              url: "https://survey123.arcgis.com/share/e1dec01678ed46279ffce88abf1f207b?portalUrl=https://gis.rdb.rw/portal",
            },
          },
          {
            name: "Ranger Based Monitoring",
            url: "https://gis.rdb.rw/portal/apps/dashboards/2c26b366cc414a61b9ca44cb7acac4f2",
            year: "Year 1",
            form: {
              name: "Ranger Based Monitoring Reporting Form",
              url: "https://survey123.arcgis.com/share/78dcdcbcea7a4840b659c02e7acf36ec?portalUrl=https://gis.rdb.rw/portal",
            },
          }
        ],
      },
    ],
    features: features.parks,
  },
]

/** Every application in a module, with groups flattened away. */
export const leafApps = (mod) => mod.apps.flatMap((app) => app.apps || [app])

/** The data collection forms hanging off those applications. */
export const leafForms = (mod) => leafApps(mod).filter((app) => app.form)

// Derived, never typed.
export const totals = {
  modules: modules.length,
  // Leaves only. A group is a label, and counting it would overstate the
  // portal by one wherever a total is shown.
  apps: modules.reduce((n, m) => n + leafApps(m).length, 0),
  // Counted apart from `apps`: a form is a way into a dashboard, not another
  // application, and the spreadsheet's application count means the latter.
  forms: modules.reduce((n, m) => n + leafForms(m).length, 0),
  features: modules.reduce((n, m) => n + m.features.length, 0),
}

export const getModule = (id) => modules.find((m) => m.id === id)
