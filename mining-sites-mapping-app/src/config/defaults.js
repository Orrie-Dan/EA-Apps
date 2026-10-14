/**
 * Bundled Runtime Config V1 defaults for Mining Sites Mapping (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/mining-sites;
 * this document is the resilience fallback when the service is unavailable.
 */
import { srcSet } from './images.js'

export const DEFAULT_RUNTIME_CONFIG = {
  "app": {
    "name": "Mining Sites Mapping",
    "shortName": "Mining Sites",
    "description": "",
    "eyebrow": "Mining workspace",
    "homeTitle": "Mining Sites Mapping",
    "homeLead": "Sites, licences, inspections and impact zones.",
    "tagline": "Sites, licences, inspections and impact zones.",
    "hero": srcSet('mining-hero').src,
    "documentTitle": "Mining Sites Mapping",
    "identity": {
      "name": "GeoHub",
      "host": "gh.space.gov.rw"
    }
  },
  "branding": {
    "favicon": "/favicon.svg"
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
    "blurb": "National environmental and natural resource intelligence, built on Earth observation and national field reporting.",
    "quickLinks": []
  },
  "legal": {
    "disclaimer": {
      "title": "Data Disclaimer",
      "body": [
        "The mapping applications in this portal present data as it is held by the source systems at Rwanda Space Agency and its partner institutions. Data is provided as-is, without warranty of accuracy, completeness, or fitness for a particular purpose.",
        "Each application carries its own refresh cycle and its own collection methodology. Confirm currency and provenance with the owning institution before relying on any figure for regulatory, legal, or operational decisions."
      ]
    },
    "privacy": {
      "title": "Privacy",
      "body": [
        "This portal does not maintain its own user accounts. You sign in with your {{app.identity.name}} credentials, and your session is held in a signed, HttpOnly cookie used solely to authorise the mapping applications you open here.",
        "Do not share your password with anyone, and do not enter it into any page that is not served from this portal or from {{app.identity.host}}. Sign out when you are finished on a shared machine."
      ]
    },
    "terms": {
      "title": "Terms of Use",
      "body": [
        "Access is granted for lawful use in support of environmental and natural resource work in Rwanda. Do not attempt to circumvent access controls, extract data in bulk without authorisation, or redistribute restricted content.",
        "Content and data remain the property of Rwanda Space Agency and the contributing institutions. Attribute the source when you reproduce any map, figure, or extract."
      ]
    },
    "accessibility": {
      "title": "Accessibility",
      "body": [
        "This portal is operable by keyboard throughout: the modules menu, every category, and every solution can be reached and activated without a pointer, and focus is always visible.",
        "The mapping applications themselves are ArcGIS products rendered inside this workspace, so their accessibility is governed by the source application. If a specific application presents a barrier, report it so it can be raised with the owning institution."
      ]
    }
  },
  "modules": [
    {
      "id": "mining",
      "name": "Mining Sites Mapping",
      "icon": "pickaxe",
      "description": "Sites, licences, inspections and impact zones.",
      "image": srcSet('mining-hero').src,
      "accent": "#A65B2A",
      "accentText": "#A65B2A",
      "apps": [
        {
          "id": "mine-sites-impact",
          "name": "Mine Sites Impact Assessment",
          "footerLabel": "Mine Sites Impact Assessment",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "e0ff7e399bb04d4eb1053cae87c62468",
          "portalHostKey": "gh"
        },
        {
          "id": "mining-inspection",
          "name": "Mining Inspection Mapping",
          "footerLabel": "Mining Inspection Mapping",
          "type": "Dashboard",
          "icon": "map",
          "year": "Year 2",
          "kind": "dashboard",
          "portalItemId": "38f39faf97994383a409255e193b5b60",
          "portalHostKey": "gh"
        }
      ]
    }
  ],
  "extensions": {
    "mining-sites": {}
  }
}
