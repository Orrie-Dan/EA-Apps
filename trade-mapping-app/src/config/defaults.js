/**
 * Bundled Runtime Config V1 defaults for Trade Mapping (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/trade-mapping;
 * this document is the resilience fallback when the service is unavailable.
 */
export const DEFAULT_RUNTIME_CONFIG = {
  app: {
    name: 'Trade Mapping',
    shortName: 'Trade',
    description: '',
    eyebrow: 'Markets and corridors workspace',
    homeTitle: 'Trade Mapping',
    homeLead: 'Choose a module on the left, then open a trade solution.',
    tagline:
      'Follow trade centres, markets, and cross-border flows across the country.',
    hero: '/market.png',
    documentTitle: 'Trade Mapping',
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
      'Supporting trade and market planning through reliable geospatial information.',
    quickLinks: [
      { label: 'Home', to: '/' },
      { label: 'Trade Centers V1', to: '/module/trade/app/trade-centers-v1' },
      { label: 'Cross Borders', to: '/module/trade/app/cross-borders' },
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
      id: 'trade',
      name: 'Trade Mapping',
      icon: 'truck',
      description:
        'Trade centres, markets, and cross-border corridors for commerce and logistics.',
      image: '/market1.jpeg',
      apps: [
        {
          id: 'trade-centers-v1',
          name: 'Trade Centers and Markets Mapping ',
          footerLabel: 'Trade Centers V1',
          description: 'Profile markets and trade centres in the first-generation map.',
          type: 'Dashboard',
          image: '/market.jpg',
          icon: 'shopping-bag',
          kind: 'dashboard',
          portalItemId: '703cac978e774176bd0b00011d8fc719',
          portalHostKey: 'gh',
        },
        {
          id: 'cross-borders',
          name: 'Cross Borders Trade Mapping',
          footerLabel: 'Cross Borders',
          description: 'Follow goods and activity across border posts and corridors.',
          type: 'Dashboard',
          image: '/border.jpg',
          icon: 'arrow-left-right',
          kind: 'dashboard',
          portalItemId: '96126effe6c84a218404807db30d42a3',
          portalHostKey: 'gh',
        },
      ],
    },
  ],
  extensions: {},
}
