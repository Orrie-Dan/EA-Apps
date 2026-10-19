/**
 * Bundled Runtime Config V1 defaults for Health Mapping (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/health-mapping;
 * this document is the resilience fallback when the service is unavailable.
 *
 * Content migrated from existing src/data/config.js + ArcGIS item IDs from src/lib/access.js.
 */
export const DEFAULT_RUNTIME_CONFIG = {
  "app": {
    "name": "Health Mapping",
    "shortName": "Health",
    "description": "",
    "eyebrow": "",
    "homeTitle": "Health Mapping",
    "homeLead": "Choose a module on the left, then open a solution. It will load in this pane.",
    "tagline": "A central platform for health facility, service accessibility, disease surveillance, and food and drugs industry mapping.",
    "hero": "/Login-health.png",
    "documentTitle": "Health Mapping"
  },
  "branding": {
    "favicon": "/favicon.png"
  },
  "organization": {
    "name": "Rwanda Space Agency",
    "legalName": "Government of the Republic of Rwanda",
    "copyrightYear": 2026
  },
  "contact": {
    "heading": "Contact",
    "email": "",
    "agency": "",
    "phone": "",
    "phoneLabel": ""
  },
  "footer": {
    "blurb": "Supporting health planning and service delivery through reliable geospatial information.",
    "quickLinks": [
      {
        "label": "Home",
        "to": "/"
      },
      {
        "label": "Primary Healthcare Access",
        "to": "/module/health-service-accessibility/app/primary-healthcare-access"
      },
      {
        "label": "Health Centers to District Hospital Analysis",
        "to": "/module/health-service-accessibility/app/health-centre-to-district-hospital"
      },
      {
        "label": "District Hospital to Provincial Hospital Analysis",
        "to": "/module/health-service-accessibility/app/district-to-provincial-hospital"
      },
      {
        "label": "Sector to Referral Hospital Access Analysis",
        "to": "/module/health-service-accessibility/app/sector-to-referral-hospital"
      },
      {
        "label": "Confirmed Cases Dashboard",
        "to": "/module/disease-surveillance/app/confirmed-case-dashboard"
      },
      {
        "label": "Contact Tracing Dashboard",
        "to": "/module/disease-surveillance/app/contact-tracing-dashboard"
      },
      {
        "label": "Confirmed Cases Report form",
        "to": "/module/disease-surveillance/app/confirmed-case-report-form"
      },
      {
        "label": "Contact Report Form",
        "to": "/module/disease-surveillance/app/contact-report-form"
      },
      {
        "label": "Health Emergency Response",
        "to": "/module/health-emergency-mapping/app/health-emergency-response"
      },
      {
        "label": "Emergency Medical Service",
        "to": "/module/health-emergency-mapping/app/emergency-medical-service"
      },
      {
        "label": "SAMU Reporting Form",
        "to": "/module/health-emergency-mapping/app/samu-reporting-form"
      },
      {
        "label": "Vaccine Distribution Planning",
        "to": "/module/vaccination-distribution/app/vaccination"
      },
      {
        "label": "Vaccine Management",
        "to": "/module/vaccination-distribution/app/national-vaccination-dashboard"
      },
      {
        "label": "Vaccine Distribution Routing",
        "to": "/module/vaccination-distribution/app/medical-supply-routing"
      }
    ]
  },
  "legal": {
    "disclaimer": {
      "title": "Data Disclaimer",
      "body": [
        "Mapping applications and related geospatial data are provided as-is for planning and operational use. Completeness, accuracy, and currency may vary by source and refresh cycle.",
        "Users should verify critical decisions against authoritative records. Rwanda Space Agency and contributing institutions are not liable for decisions made solely on the basis of these maps."
      ]
    },
    "privacy": {
      "title": "Privacy",
      "body": [
        "This workspace does not collect sign-in credentials. Embedded maps may still load public GeoHub or partner portal content according to each application’s sharing settings.",
        "Avoid entering personal credentials into third-party pages unless your institution requires it for a specific secured service."
      ]
    },
    "terms": {
      "title": "Terms of Use",
      "body": [
        "Use this workspace only for lawful, authorized purposes related to health mapping and institutional mandates in Rwanda.",
        "Do not attempt to bypass access controls, scrape protected services, or redistribute proprietary content without permission."
      ]
    },
    "accessibility": {
      "title": "Accessibility",
      "body": [
        "This portal supports keyboard navigation for primary chrome (header, sidebar, and legal pages). Embedded mapping applications inherit accessibility features from their ArcGIS source apps.",
        "If you encounter a barrier, contact your GeoHub administrator so the issue can be routed to the application owner."
      ]
    }
  },
  "modules": [
    {
      "id": "health-service-accessibility",
      "name": "Health Service Accessibility",
      "icon": "heart-pulse",
      "description": "Access to health services by location, travel, and coverage.",
      "image": "/Floods.jpeg",
      "apps": [
        {
          "id": "primary-healthcare-access",
          "name": "Primary Healthcare Access",
          "description": "Population access to primary healthcare facilities.",
          "type": "Dashboard",
          "image": "/Floods.jpeg",
          "icon": "stethoscope",
          "kind": "dashboard",
          "portalItemId": "27973ee1a8e247d7b44a98479eec71f3",
          "portalHostKey": "gh"
        },
        {
          "id": "health-centre-to-district-hospital",
          "name": "Health Centers to District Hospital Analysis",
          "description": "Travel and coverage from health centres to district hospitals.",
          "type": "Dashboard",
          "image": "/Floods.jpeg",
          "icon": "route",
          "kind": "dashboard",
          "portalItemId": "626b6461ae4948788b2c6b9b9231ecec",
          "portalHostKey": "gh"
        },
        {
          "id": "district-to-provincial-hospital",
          "name": "District Hospital to Provincial Hospital Analysis",
          "description": "Travel and coverage from district to provincial hospitals.",
          "type": "Dashboard",
          "image": "/Floods.jpeg",
          "icon": "route",
          "kind": "dashboard",
          "portalItemId": "b874415d6ebb4bf4b428189d5fef85be",
          "portalHostKey": "gh"
        },
        {
          "id": "sector-to-referral-hospital",
          "name": "Sector to Referral Hospital Access Analysis",
          "description": "Sector-level access to referral hospitals.",
          "type": "Dashboard",
          "image": "/Floods.jpeg",
          "icon": "map-pin",
          "kind": "dashboard",
          "portalItemId": "7bcfb3bfcd114ef487fc3cb0c86204ad",
          "portalHostKey": "gh"
        }
      ]
    },
    {
      "id": "disease-surveillance",
      "name": "Disease Outbreaks Mapping",
      "icon": "activity",
      "description": "Disease outbreak reporting and surveillance mapping.",
      "image": "/Emergency response.webp",
      "apps": [
        {
          "id": "confirmed-case-dashboard",
          "name": "Confirmed Cases Dashboard",
          "description": "Confirmed case dashboard and indicators.",
          "type": "Dashboard",
          "image": "/reporting.jpeg",
          "icon": "layers",
          "kind": "dashboard",
          "portalItemId": "58672ddce9ee433ca4edde6d0f85c486",
          "portalHostKey": "rbc"
        },
        {
          "id": "contact-tracing-dashboard",
          "name": "Contact Tracing Dashboard",
          "description": "Contact tracing dashboard and indicators.",
          "type": "Dashboard",
          "image": "/reporting.jpeg",
          "icon": "activity",
          "kind": "dashboard",
          "portalItemId": "2189cc6c7f0a431ab6db31476aaf17c1",
          "portalHostKey": "rbc"
        },
        {
          "id": "confirmed-case-report-form",
          "name": "Confirmed Cases Report form",
          "description": "Confirmed case reporting form.",
          "type": "Form",
          "image": "/reporting.jpeg",
          "icon": "clipboard-list",
          "kind": "survey123",
          "portalItemId": "d0ccb11cd8424ee39114c2a986cd04c2",
          "portalHostKey": "rbc1"
        },
        {
          "id": "contact-report-form",
          "name": "Contact Report Form",
          "description": "Contact reporting form.",
          "type": "Form",
          "image": "/reporting.jpeg",
          "icon": "clipboard-list",
          "kind": "survey123",
          "portalItemId": "93a5a69aeccf4903b6bc94e2a3021539",
          "portalHostKey": "rbc1"
        }
      ]
    },
    {
      "id": "health-emergency-mapping",
      "name": "Health Emergency",
      "icon": "shield",
      "description": "Health emergency response, medical services, and field reporting.",
      "image": "/Emergency operations.jpg",
      "apps": [
        {
          "id": "health-emergency-response",
          "name": "Health Emergency Response",
          "description": "Ambulance dispatch, tasks, and response monitoring.",
          "type": "Dashboard",
          "image": "/Emergency operations.jpg",
          "icon": "siren",
          "kind": "dashboard",
          "portalItemId": "0853f19fe0a645008c0c95969855b1f2",
          "portalHostKey": "esrirw"
        },
        {
          "id": "emergency-medical-service",
          "name": "Emergency Medical Service",
          "description": "Emergency medical service operations and coverage.",
          "type": "Dashboard",
          "image": "/Emergency operations.jpg",
          "icon": "ambulance",
          "kind": "dashboard",
          "portalItemId": "fac586ef13be4c84856f66d0b5de0034",
          "portalHostKey": "esrirw"
        },
        {
          "id": "samu-reporting-form",
          "name": "SAMU Reporting Form",
          "description": "Field reporting form for SAMU emergency records.",
          "type": "Form",
          "image": "/Emergency operations.jpg",
          "icon": "clipboard-list",
          "kind": "survey123",
          "portalItemId": "9ea5acc523984c45b2aae19a33c43796",
          "portalHostKey": "esrirw"
        }
      ]
    },
    {
      "id": "vaccination-distribution",
      "name": "Vaccine Distribution",
      "icon": "syringe",
      "description": "Vaccination planning, distribution, and coverage mapping.",
      "image": "/Lightining.jpeg",
      "apps": [
        {
          "id": "vaccination",
          "name": "Vaccine Distribution Planning",
          "description": "Vaccination planning, distribution, and coverage mapping.",
          "type": "Experience",
          "image": "/Lightining.jpeg",
          "icon": "syringe",
          "kind": "experience",
          "portalItemId": "9d6b84d4e7b24d6aa379f0c221f4b264",
          "portalHostKey": "rbc"
        },
        {
          "id": "national-vaccination-dashboard",
          "name": "Vaccine Management",
          "description": "National vaccination management dashboard.",
          "type": "Dashboard",
          "image": "/Lightining.jpeg",
          "icon": "layers",
          "kind": "dashboard",
          "portalItemId": "e20ff598d2cc493ca909e7cc12ee78e8",
          "portalHostKey": "rbc"
        },
        {
          "id": "medical-supply-routing",
          "name": "Vaccine Distribution Routing",
          "description": "Vaccine distribution routing dashboard.",
          "type": "Dashboard",
          "image": "/Lightining.jpeg",
          "icon": "activity",
          "kind": "dashboard",
          "portalItemId": "f50838e3c7b74912963d6f4da4248723",
          "portalHostKey": "rbc"
        }
      ]
    }
  ],
  "extensions": {
    "health-mapping": {
      "moduleFeatures": {
        "health-facility-mapping": [
          "Health facility locations and profiles.",
          "Facility type, capacity, and coverage."
        ],
        "health-service-accessibility": [
          "Service accessibility by location.",
          "Coverage and travel analysis across the referral chain."
        ],
        "disease-surveillance": [
          "Outbreak reporting and mapping.",
          "Surveillance across districts."
        ],
        "health-emergency-mapping": [
          "Emergency response and ambulance operations.",
          "Emergency medical service monitoring and field reporting."
        ],
        "vaccination-distribution": [
          "Vaccination planning and distribution.",
          "Coverage mapping."
        ],
        "food-drugs-industries": [
          "Drugs industry locations and mapping.",
          "Foods industry locations and mapping."
        ]
      },
      "stagedApps": [
        {
          "id": "provincial-to-referral-hospital",
          "name": "Provincial to Referral Hospital Analysis",
          "note": "Present in APP_EMBED_URL / APP_SOURCES; missing from catalog UI.",
          "kind": "dashboard",
          "portalItemId": "bd50d196e7bb4e4ea474fff04c44303e",
          "portalHostKey": "gh"
        },
        {
          "id": "health-facility",
          "moduleId": "health-facility-mapping",
          "note": "Catalog only; no portal item ID yet.",
          "kind": "dashboard"
        },
        {
          "id": "drugs-industry",
          "moduleId": "food-drugs-industries",
          "note": "Catalog only; no portal item ID yet.",
          "kind": "dashboard"
        },
        {
          "id": "foods-industry",
          "moduleId": "food-drugs-industries",
          "note": "Catalog only; no portal item ID yet.",
          "kind": "dashboard"
        }
      ]
    }
  }
}
