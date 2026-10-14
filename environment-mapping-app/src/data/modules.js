import { features } from './features.generated.js'

/**
 * This portal carries three modules: climate; conservation, which was moved in
 * from its own split portal; and climate change adaptation. The first two run
 * on GeoHub, so they share one sign-in and one access server. Adaptation's
 * applications live on the Ministry of Environment's Enterprise instead — see
 * its entry.
 *
 * The shape is unchanged from the parent — same fields, same guard — so a
 * module can be moved back or across without touching any component.
 */
export const modules = [
  {
    id: "climate",
    index: '01',
    name: "Environmental and Climate Mapping",
    accent: "#7C5CBF",
    accentText: "#7C5CBF",
    description: "Air pollutants, carbon emissions and climate hazards, charted over time and ranked by district.",
    cardSlug: "climate-card",
    heroSlug: "climate-hero",
    cardAlt: "Open sky over Rwandan wetlands",
    apps: [
      {
        name: "Air Quality and Pollution Mapping, Monitoring and Reporting",
        url: "https://gh.space.gov.rw/portal/apps/dashboards/75c503067fd2423391d0789c7a4f6f8a",
        year: "Year 1",
      },
    ],
    features: features.climate,
  },
  {
    id: "conservation",
    index: '02',
    name: "Conservation Management",
    accent: "#C43F86",
    accentText: "#C43F86",
    description: "Protected area boundaries, species records and biodiversity analysis.",
    cardSlug: "conservation-card",
    heroSlug: "conservation-hero",
    cardAlt: "A young mountain gorilla among forest foliage",
    /*
     * Applications, and the groups they hang under.
     *
     * An entry with `apps` instead of `url` is a GROUP: a label carrying
     * dashboards, not something that opens. Both entries here were one
     * Experience Builder app whose own tab bar led to the pages listed under
     * it, so the frame showed a landing page the user then had to navigate a
     * second time. The pages are listed here instead and open directly, under a
     * group named for the app they came from:
     *
     *   Protected Area Mapping and Monitoring — experience 935a93ef…
     *   Biodiversity Mapping                  — experience 3ab8b6b4…
     *
     * The order is each app's own tab order. Leaves keep the exact shape they
     * always had — name, url, year — so an application can still be moved
     * between portals untouched.
     *
     * `form` is the Survey123 form that FEEDS that dashboard — the data entry
     * side of the same activity, which is why it hangs off the dashboard rather
     * than sitting beside it. Its name is free-form; check-data.mjs only
     * requires that it differ from the dashboard's own. The URL is the share
     * link as Survey123 gives it;
     * formEmbedUrl() serves it through /api/forms and points `portalUrl` at this
     * origin's portal proxy, so the layer the form submits to gets the session
     * token. `portalUrl` must still be here — check-data.mjs requires it, and it
     * records which Enterprise the form belongs to.
     */
    apps: [
      {
        name: "Protected Area Mapping and Monitoring",
        apps: [
          {
            // Portal title: "Rwanda Protected Area Mapping Application (WDPA)".
            name: "Protected Area Mapping",
            url: "https://gh.space.gov.rw/portal/apps/dashboards/3af93433d83d4c2186ee450069412077",
            year: "Year 1",
          },
          {
            // Portal title: "Protected Area Incident Report Application".
            name: "Incident Monitoring",
            url: "https://gh.space.gov.rw/portal/apps/dashboards/2df49fb357db487491fe2ebb29ab982b",
            year: "Year 1",
            form: {
              // Portal title: "Protected Area Incident Report".
              name: "Incident Monitoring Reporting Form",
              url: "https://survey123.arcgis.com/share/a67ac2db8560475db41404e54a5b65ba?portalUrl=https://gh.space.gov.rw/portal",
            },
          },
        ],
      },
      {
        /*
         * The app's own tabs are "Dashboard", "Data Export" and "Form" — fine
         * inside it, meaningless in a sidebar that lists other modules too, so
         * each row names what it is.
         */
        name: "Biodiversity Mapping",
        apps: [
          {
            // Portal title: "Rwanda Biodiversity Profile".
            name: "Biodiversity Profile",
            url: "https://gh.space.gov.rw/portal/apps/dashboards/bc469da4e9ca4d73b6ce8114d330977f",
            year: "Year 1",
            form: {
              // Portal title: "Rwanda Biodiversity Collection Form".
              name: "Biodiversity Reporting Form",
              url: "https://survey123.arcgis.com/share/93e9dcb1e8b04568abd3f98d1668c194?portalUrl=https://gh.space.gov.rw/portal",
            },
          },
          {
            // Portal title: "Rwanda Biodiversity Dowloader" — an Experience
            // Builder app of its own, not a dashboard, so it is framed as one.
            name: "Biodiversity Data Explorer",
            url: "https://gh.space.gov.rw/portal/apps/experiencebuilder/experience/?id=d3c75b53ca5841eabe116172a1ce04b5",
            year: "Year 1",
          },
        ],
      },
    ],
    features: features.conservation,
  },
  {
    id: "adaptation",
    index: '03',
    name: "Climate Change Adaptation",
    accent: "#2E7D46",
    accentText: "#2E7D46",
    description: "Climate resilience projects across Rwanda: VCRP, SFERE and the Green Gicumbi Project.",
    cardSlug: "adaptation-card",
    heroSlug: "adaptation-hero",
    cardAlt: "Terraced green hillsides",
    /*
     * The one module NOT on GeoHub. All three applications live on the Ministry
     * of Environment's Enterprise (moegis.environment.gov.rw), which does not
     * accept GeoHub credentials. They are proxied with the `moe` token the
     * Runtime Config broker issues from its MoE credential (host key "moe"), so
     * the private VCRP and SFERE apps open without a second sign-in.
     *
     * No spreadsheet row covers this module, so it carries no features.
     */
    apps: [
      {
        name: "Volcanoes Community Resilience Project (VCRP)",
        url: "https://moegis.environment.gov.rw/portal/apps/dashboards/5205ea5a64b44bdb8ae4873f5597c8ea",
      },
      {
        name: "Sustainable Forestry and Efficient Renewable Energy for Improved Livelihood (SFERE Project)",
        url: "https://moegis.environment.gov.rw/portal/apps/dashboards/0d57726c1d35415c916910f650723695",
      },
      {
        // An Experience Builder app, not a dashboard, so it is framed as one.
        name: "Green Gicumbi Project",
        url: "https://moegis.environment.gov.rw/portal/apps/experiencebuilder/experience/?id=6717c827c3674a8e923da8708f6bfcf3",
      },
    ],
    features: [],
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
  // portal wherever a total is shown.
  apps: modules.reduce((n, m) => n + leafApps(m).length, 0),
  // Counted apart from `apps`: a form is a way into a dashboard, not another
  // application.
  forms: modules.reduce((n, m) => n + leafForms(m).length, 0),
  features: modules.reduce((n, m) => n + m.features.length, 0),
}

export const getModule = (id) => modules.find((m) => m.id === id)
