/**
 * Bundled Runtime Config V1 defaults for Parks Operations Mapping (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/parks-operations;
 * this document is the resilience fallback when the service is unavailable.
 */
import { srcSet } from './images.js'

export const DEFAULT_RUNTIME_CONFIG = {
  "app": {
    "name": "Parks Operations Mapping",
    "shortName": "Parks Operations",
    "description": "",
    "eyebrow": "Parks workspace",
    "homeTitle": "Parks Operations Mapping",
    "homeLead": "Park operations, ranger reporting and wildlife.",
    "tagline": "Park operations, ranger reporting and wildlife.",
    "hero": srcSet('parks-hero').src,
    "documentTitle": "Parks Operations Mapping",
    "identity": {
      "name": "RDB Portal",
      "host": "gis.rdb.rw"
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
      "id": "parks",
      "name": "Parks Operations Mapping",
      "icon": "mountain",
      "description": "Park operations, ranger reporting, wildlife incidents and visitor analytics.",
      "image": srcSet('parks-hero').src,
      "accent": "#C98A21",
      "accentText": "#9B6A19",
      "apps": [
        {
          "id": "gorilla-health",
          "name": "Gorilla Monitoring",
          "footerLabel": "Gorilla Monitoring",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 2",
          "kind": "dashboard",
          "portalItemId": "c33a701b3592459c9ded457313ac8a8c",
          "portalHostKey": "rdb",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "gorilla-health-form",
          "name": "Gorilla Monitoring Reporting Form",
          "footerLabel": "Gorilla Monitoring Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "9f3a1e1c3b9e418497c92c4cf18a15e7",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "gorilla-health",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "golden-monkey",
          "name": "Golden Monkey Monitoring",
          "footerLabel": "Golden Monkey Monitoring",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 2",
          "kind": "dashboard",
          "portalItemId": "c1f3d6464dac4fa1a5c986b558d04331",
          "portalHostKey": "rdb",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "golden-monkey-form",
          "name": "Golden Monkey Monitoring Reporting Form",
          "footerLabel": "Golden Monkey Monitoring Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "e57d72b1c07649879e2dd399ed31450d",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "golden-monkey",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "chimpanzee",
          "name": "Chimpanzee Monitoring",
          "footerLabel": "Chimpanzee Monitoring",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 2",
          "kind": "dashboard",
          "portalItemId": "9db15ec819064462a1a325552daa6ac2",
          "portalHostKey": "rdb",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "chimpanzee-form",
          "name": "Chimpanzee Monitoring Reporting Form",
          "footerLabel": "Chimpanzee Monitoring Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "959b131820424d51b9b07859027e9f30",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "chimpanzee",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "plant-monitoring",
          "name": "Plant Monitoring",
          "footerLabel": "Plant Monitoring",
          "type": "Dashboard",
          "icon": "leaf",
          "year": "Year 2",
          "kind": "dashboard",
          "portalItemId": "37e9e92af64a41878564d035c41bd5cf",
          "portalHostKey": "rdb",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "plant-monitoring-form",
          "name": "Plant Monitoring Reporting Form",
          "footerLabel": "Plant Monitoring Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "a6326fda98cf4b81b53f7a64f20ba41f",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "plant-monitoring",
          "group": "Parks Operations Mapping",
          "groupIcon": "map"
        },
        {
          "id": "human-wildlife-conflict",
          "name": "Human-Wildlife Conflicts in VNP",
          "footerLabel": "Human-Wildlife Conflicts in VNP",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "ca6e8cdbba0d409e8a249a910d0707cb",
          "portalHostKey": "rdb",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "human-wildlife-conflict-form",
          "name": "Human-Wildlife Conflicts in VNP Reporting Form",
          "footerLabel": "Human-Wildlife Conflicts in VNP Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "286ae53b851d4bff90868e0268b1d6fe",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "human-wildlife-conflict",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "gmn-park-conflict",
          "name": "Human-Wildlife Conflict In GMNP",
          "footerLabel": "Human-Wildlife Conflict In GMNP",
          "type": "Dashboard",
          "icon": "mountain",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "9e7b6650d9f44db899846a90c289735d",
          "portalHostKey": "rdb",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "gmn-park-conflict-form",
          "name": "Human-Wildlife Conflict In GMNP Reporting Form",
          "footerLabel": "Human-Wildlife Conflict In GMNP Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "5fa9f254369c4aeca497bc6bf11c86d0",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "gmn-park-conflict",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "illegal-activities",
          "name": "Illegal Activities",
          "footerLabel": "Illegal Activities",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "a2851299719e40408cc131cabcf41e5f",
          "portalHostKey": "rdb",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "illegal-activities-form",
          "name": "Illegal Activities Reporting Form",
          "footerLabel": "Illegal Activities Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "60c394294a004be3a8286c29db16d3df",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "illegal-activities",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "law-enforcement",
          "name": "Law Enforcement",
          "footerLabel": "Law Enforcement",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "c1c9bd914a9c4cdaac8411977ae90b21",
          "portalHostKey": "rdb",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "law-enforcement-form",
          "name": "Law Enforcement Reporting Form",
          "footerLabel": "Law Enforcement Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "e1dec01678ed46279ffce88abf1f207b",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "law-enforcement",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "ranger-monitoring",
          "name": "Ranger Based Monitoring",
          "footerLabel": "Ranger Based Monitoring",
          "type": "Dashboard",
          "icon": "map",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "2c26b366cc414a61b9ca44cb7acac4f2",
          "portalHostKey": "rdb",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "ranger-monitoring-form",
          "name": "Ranger Based Monitoring Reporting Form",
          "footerLabel": "Ranger Based Monitoring Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "78dcdcbcea7a4840b659c02e7acf36ec",
          "portalHostKey": "rdb",
          "isForm": true,
          "formParentId": "ranger-monitoring",
          "group": "Wildlife Conservation Mapping",
          "groupIcon": "tree"
        }
      ]
    }
  ],
  "extensions": {
    "parks-operations": {}
  }
}
