/**
 * Bundled Runtime Config V1 defaults for Land Administration (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/land-administration;
 * this document is the resilience fallback when the service is unavailable.
 *
 * Content migrated from src/data/config.js + ArcGIS item IDs from src/lib/access.js
 * (including Experience Builder parcels-surveying and hidden-module filter support).
 */
export const DEFAULT_RUNTIME_CONFIG = {
  app: {
    name: 'Land Administration Mapping',
    shortName: 'Land',
    description: '',
    eyebrow: 'Land workspace',
    homeTitle: 'Land administration',
    homeLead: 'Choose a module on the left, then open a land solution.',
    tagline: 'See how parcels and land use change across the country.',
    hero: '/Land2.jpg',
    documentTitle: 'Land Administration Mapping',
  },
  branding: {
    favicon: '/favicon.svg',
  },
  organization: {
    name: 'Rwanda Space Agency',
    legalName: 'Government of the Republic of Rwanda',
    copyrightYear: 2026,
  },
  contact: {
    heading: 'Contact',
    email: '',
    agency: '',
    phone: '',
    phoneLabel: '',
  },
  footer: {
    blurb:
      'Supporting land administration and cadastre through reliable geospatial information.',
    quickLinks: [
      { label: 'Home', to: '/' },
      {
        label: 'Parcels',
        to: '/module/land-mapping/app/parcels-surveying',
      },
      {
        label: 'Land Use Change',
        to: '/module/land-mapping/app/land-use-change',
      },
      {
        label: 'Property Location and Valuation',
        to: '/module/immovable-property/app/property-location',
      },
    ],
  },
  legal: {
    disclaimer: {
      title: 'Data Disclaimer',
      body: [
        '{{app.name}} publishes geospatial information for planning, operations, and public awareness.',
        'Maps and statistics are provided as-is. Always confirm critical decisions with the responsible institution and the source application’s own refresh time.',
      ],
    },
    privacy: {
      title: 'Privacy',
      body: [
        'This portal uses your account to sign you in and to load mapping applications you are authorised to view.',
        'Session details stay on this origin. Do not share your username or password.',
      ],
    },
    terms: {
      title: 'Terms of Use',
      body: [
        'Use this portal for official and lawful purposes only. Do not attempt to bypass access controls or scrape restricted layers.',
        'Content remains the property of {{organization.legalName}} and its partner institutions.',
      ],
    },
    accessibility: {
      title: 'Accessibility',
      body: [
        'Pages are built for keyboard use and common assistive technologies. Mapping viewers follow the accessibility of the source ArcGIS application.',
        'If a page or map is hard to use, contact the institution listed in the footer.',
      ],
    },
  },
  modules: [
    {
      id: 'land-mapping',
      name: 'Land Mapping',
      icon: 'map',
      description:
        'Parcel surveys and land-use change for cadastre and planning.',
      image:
        'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1400&q=80',
      apps: [
        {
          id: 'land-use-change',
          name: 'Land Use Change Mapping Application',
          footerLabel: 'Land Use Change',
          description: 'Track how land use shifts over time.',
          type: 'Dashboard',
          image: '/land.jpg',
          icon: 'layers',
          kind: 'dashboard',
          portalItemId: '1dbaae64924b4f7696272d9d503a94f1',
          portalHostKey: 'gh',
        },
        {
          id: 'parcels-surveying',
          name: 'Parcels Surveying and Mapping Application',
          footerLabel: 'Parcels',
          description: 'Survey and map land parcels and boundaries.',
          type: 'Experience',
          image: '/images.jpg',
          icon: 'grid',
          kind: 'experience',
          portalItemId: '164589648e2c4e198c40ff1c462bf6e5',
          portalHostKey: 'gh',
        },
      ],
    },
    {
      id: 'immovable-property',
      name: 'Immovable Property Mapping',
      icon: 'building',
      description:
        'Locate and value immovable property for administration and planning.',
      image: '/land.jpg',
      apps: [
        {
          id: 'property-location',
          name: 'Property Location and Valuation Application',
          footerLabel: 'Property Location and Valuation',
          description: 'Locate properties and review valuation on the map.',
          type: 'Dashboard',
          image: '/images.jpg',
          icon: 'map-pin',
          kind: 'dashboard',
          portalItemId: 'bc2cbc30989c44dda9a8d27660c3a36f',
          portalHostKey: 'gh',
        },
      ],
    },
  ],
  extensions: {},
}
