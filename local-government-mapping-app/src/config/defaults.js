/**
 * Bundled Runtime Config V1 defaults for Local Government Mapping (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/local-government-mapping;
 * this document is the resilience fallback when the service is unavailable.
 *
 * Content migrated from src/data/config.js + ArcGIS item IDs from src/lib/access.js.
 */
export const DEFAULT_RUNTIME_CONFIG = {
  app: {
    name: 'Local Government Mapping',
    shortName: 'Local Gov',
    description: '',
    eyebrow: 'Local government workspace',
    homeTitle: 'Local Government Mapping',
    homeLead: 'Choose a module on the left, then open a district solution.',
    tagline: 'Citizen reports and a live district situation room in one place.',
    hero: '/dist.jpg',
    documentTitle: 'Local Government Mapping',
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
      'Supporting citizen reporting and situation awareness through reliable geospatial information.',
    quickLinks: [
      { label: 'Home', to: '/' },
      {
        label: 'Resolution Status',
        to: '/module/district-citizen-reporting/app/resolution-status',
      },
      {
        label: 'Reports by Sector',
        to: '/module/district-citizen-reporting/app/reports-summary-sector',
      },
      {
        label: 'Reports by District',
        to: '/module/district-citizen-reporting/app/reports-summary-district',
      },
      {
        label: 'Reports by Categories',
        to: '/module/district-citizen-reporting/app/reports-summary-categories',
      },
      {
        label: 'Clustered Reports',
        to: '/module/district-citizen-reporting/app/clustered-reports',
      },
      {
        label: 'District Resolution Summary',
        to: '/module/district-citizen-reporting/app/district-resolution-summary',
      },
      {
        label: 'Imihigo Progress',
        to: '/module/district-performance/app/imihigo-progress-tracker',
      },
      {
        label: 'Imihigo Approval',
        to: '/module/district-performance/app/imihigo-approval-template',
      },
      {
        label: 'Imihigo Reporting',
        to: '/module/district-performance/app/imihigo-reporting-platform',
      },
      {
        label: 'Imihigo Data Entry',
        to: '/module/district-performance/app/imihigo-data-entry',
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
      id: 'district-citizen-reporting',
      name: 'District Citizen Reporting',
      icon: 'megaphone',
      description:
        'Citizen report status and summaries by sector, district, and category.',
      image: '/image2.jpg',
      apps: [
        {
          id: 'resolution-status',
          name: 'Resolution Status',
          footerLabel: 'Resolution Status',
          description: 'Track how citizen reports are being resolved.',
          type: 'Experience',
          image: '/image2.jpg',
          icon: 'monitor',
          kind: 'experience',
          portalItemId: 'df0ddb7406b64d7db95269ab1fe6cd90',
          portalHostKey: 'gh',
        },
        {
          id: 'reports-summary-sector',
          name: 'Reports Summary by Sector',
          footerLabel: 'Reports by Sector',
          description: 'Summarise citizen reports by sector.',
          type: 'Experience',
          image: '/image1.jpg',
          icon: 'layers',
          kind: 'experience',
          portalItemId: '58fc5ade94ff4160a2e5f76f5a1e3531',
          portalHostKey: 'gh',
        },
        {
          id: 'reports-summary-district',
          name: 'Reports Summary by District',
          footerLabel: 'Reports by District',
          description: 'Summarise citizen reports by district.',
          type: 'Experience',
          image: '/image2.jpg',
          icon: 'landmark',
          kind: 'experience',
          portalItemId: '7d30814265a049b894e928f2ec99d92e',
          portalHostKey: 'gh',
        },
        {
          id: 'reports-summary-categories',
          name: 'Reports Summary by Categories',
          footerLabel: 'Reports by Categories',
          description: 'Summarise citizen reports by category.',
          type: 'Experience',
          image: '/image1.jpg',
          icon: 'megaphone',
          kind: 'experience',
          portalItemId: 'aad0cecd81e546fc80c06672d489c706',
          portalHostKey: 'gh',
        },
        {
          id: 'clustered-reports',
          name: 'Clustered Reports',
          footerLabel: 'Clustered Reports',
          description: 'View clustered citizen reports on the map.',
          type: 'Experience',
          image: '/image2.jpg',
          icon: 'layers',
          kind: 'experience',
          portalItemId: '467cf6ebdf764152b9544c550a292a38',
          portalHostKey: 'gh',
        },
        {
          id: 'district-resolution-summary',
          name: 'District Resolution Summary',
          footerLabel: 'District Resolution Summary',
          description: 'Summarise resolution status by district.',
          type: 'Experience',
          image: '/image1.jpg',
          icon: 'monitor',
          kind: 'experience',
          portalItemId: '27289d3767164057bdb290ce452ee895',
          portalHostKey: 'gh',
        },
      ],
    },
    {
      id: 'district-performance',
      name: 'District Awareness',
      icon: 'landmark',
      description: 'Operational awareness and Imihigo tools for district teams.',
      image: '/image1.jpg',
      apps: [
        {
          id: 'imihigo-progress-tracker',
          name: 'Imihigo Progress Tracker',
          footerLabel: 'Imihigo Progress',
          description: 'Track Imihigo progress on the map.',
          type: 'Dashboard',
          image: '/image1.jpg',
          icon: 'monitor',
          kind: 'dashboard',
          portalItemId: '6a04f736ca4c4074ab0f5e4dabb42c70',
          portalHostKey: 'infra',
        },
        {
          id: 'imihigo-approval-template',
          name: 'Imihigo Approval Template',
          footerLabel: 'Imihigo Approval',
          description: 'Review and approve Imihigo submissions.',
          type: 'Experience',
          image: '/image2.jpg',
          icon: 'hard-hat',
          kind: 'experience',
          portalItemId: 'a7ed028b8dd941fdbf29739bcad01469',
          portalHostKey: 'infra',
        },
        {
          id: 'imihigo-reporting-platform',
          name: 'Imihigo Reporting Platform',
          footerLabel: 'Imihigo Reporting',
          description: 'Open the Imihigo reporting site.',
          type: 'Hub',
          image: '/image1.jpg',
          icon: 'landmark',
          kind: 'external',
          externalUrl:
            'https://infrastructure.space.gov.rw/portal/apps/sites/#/imihigo-reporting-platform',
        },
        {
          id: 'imihigo-data-entry',
          name: 'Imihigo Data Entry Tool',
          footerLabel: 'Imihigo Data Entry',
          description: 'Enter and update Imihigo records.',
          type: 'Survey',
          image: '/image1.jpg',
          icon: 'layers',
          kind: 'survey123',
          portalItemId: '74ea7ceec208425e84cb1dc725475dfc',
          portalHostKey: 'infra',
        },
      ],
    },
  ],
  extensions: {
    'local-government-mapping': {
      stagedApps: [
        {
          id: 'district-citizen-reporting',
          name: 'District Citizen Reporting Login',
          note: 'Present in access.js APP_SOURCES as external EsriRW citizen login; not a published catalog solution.',
          kind: 'external',
          externalUrl: 'https://esrirw.rw/citizen/login',
        },
      ],
    },
  },
}
