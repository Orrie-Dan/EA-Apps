/**
 * Bundled Runtime Config V1 defaults for Environment Mapping (HARM-01).
 * Authoritative runtime source is GET /api/v1/config/environment-mapping;
 * this document is the resilience fallback when the service is unavailable.
 */
import { srcSet } from './images.js'

export const DEFAULT_RUNTIME_CONFIG = {
  "app": {
    "name": "Environment Mapping",
    "shortName": "Environment",
    "description": "",
    "eyebrow": "Environment workspace",
    "homeTitle": "Environment Mapping",
    "homeLead": "Air quality, climate hazards, protected areas and biodiversity, mapped and monitored across Rwanda.",
    "tagline": "Air quality, climate hazards, protected areas and biodiversity, mapped and monitored across Rwanda.",
    "hero": srcSet('climate-hero').src,
    "documentTitle": "Environment Mapping",
    "identity": {
      "name": "GeoHub",
      "host": "gh.space.gov.rw"
    },
    "login": {
      "accent": "#0F7B6C",
      "tint": "#2BB39A",
      "icon": "leaf"
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
      "id": "climate",
      "name": "Environmental and Climate Mapping",
      "icon": "cloud",
      "description": "Air pollutants, carbon emissions and climate hazards, charted over time and ranked by district.",
      "image": srcSet('climate-hero').src,
      "accent": "#7C5CBF",
      "accentText": "#7C5CBF",
      "apps": [
        {
          "id": "air-quality",
          "name": "Air Quality and Pollution Mapping, Monitoring and Reporting",
          "footerLabel": "Air Quality and Pollution Mapping, Monitoring and Reporting",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "75c503067fd2423391d0789c7a4f6f8a",
          "portalHostKey": "gh"
        }
      ]
    },
    {
      "id": "conservation",
      "name": "Conservation Management",
      "icon": "leaf",
      "untitled": true,
      "description": "Protected area boundaries, species records and biodiversity analysis.",
      "image": srcSet('conservation-hero').src,
      "accent": "#C43F86",
      "accentText": "#C43F86",
      "apps": [
        {
          "id": "protected-areas",
          "name": "Protected Area Mapping",
          "footerLabel": "Protected Area Mapping",
          "type": "Dashboard",
          "icon": "map",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "3af93433d83d4c2186ee450069412077",
          "portalHostKey": "gh",
          "group": "Protected Area Mapping and Monitoring",
          "groupIcon": "mountain"
        },
        {
          "id": "protected-area-incidents",
          "name": "Incident Monitoring",
          "footerLabel": "Incident Monitoring",
          "type": "Dashboard",
          "icon": "activity",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "2df49fb357db487491fe2ebb29ab982b",
          "portalHostKey": "gh",
          "group": "Protected Area Mapping and Monitoring",
          "groupIcon": "mountain"
        },
        {
          "id": "protected-area-incidents-form",
          "name": "Incident Monitoring Reporting Form",
          "footerLabel": "Incident Monitoring Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "a67ac2db8560475db41404e54a5b65ba",
          "portalHostKey": "gh",
          "isForm": true,
          "formParentId": "protected-area-incidents",
          "group": "Protected Area Mapping and Monitoring",
          "groupIcon": "mountain"
        },
        {
          "id": "biodiversity",
          "name": "Biodiversity Profile",
          "footerLabel": "Biodiversity Profile",
          "type": "Dashboard",
          "icon": "layers",
          "year": "Year 1",
          "kind": "dashboard",
          "portalItemId": "bc469da4e9ca4d73b6ce8114d330977f",
          "portalHostKey": "gh",
          "group": "Biodiversity Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "biodiversity-form",
          "name": "Biodiversity Reporting Form",
          "footerLabel": "Biodiversity Reporting Form",
          "type": "Form",
          "icon": "clipboard",
          "kind": "survey123",
          "portalItemId": "93e9dcb1e8b04568abd3f98d1668c194",
          "portalHostKey": "gh",
          "isForm": true,
          "formParentId": "biodiversity",
          "group": "Biodiversity Mapping",
          "groupIcon": "tree"
        },
        {
          "id": "biodiversity-export",
          "name": "Biodiversity Data Explorer",
          "footerLabel": "Biodiversity Data Explorer",
          "type": "Experience",
          "icon": "download",
          "year": "Year 1",
          "kind": "experience",
          "portalItemId": "d3c75b53ca5841eabe116172a1ce04b5",
          "portalHostKey": "gh",
          "group": "Biodiversity Mapping",
          "groupIcon": "tree"
        }
      ]
    },
    {
      "id": "adaptation",
      "name": "Climate Change Adaptation",
      "icon": "mountain",
      "description": "Climate resilience projects across Rwanda: VCRP, SFERE and the Green Gicumbi Project.",
      "image": srcSet('adaptation-hero').src,
      "accent": "#2E7D46",
      "accentText": "#2E7D46",
      "apps": [
        {
          "id": "vcrp",
          "name": "Volcanoes Community Resilience Project (VCRP)",
          "footerLabel": "Volcanoes Community Resilience Project (VCRP)",
          "type": "Dashboard",
          "icon": "activity",
          "kind": "dashboard",
          "portalItemId": "5205ea5a64b44bdb8ae4873f5597c8ea",
          "portalHostKey": "moe"
        },
        {
          "id": "sfere",
          "name": "Sustainable Forestry and Efficient Renewable Energy for Improved Livelihood (SFERE Project)",
          "footerLabel": "Sustainable Forestry and Efficient Renewable Energy for Improved Livelihood (SFERE Project)",
          "type": "Dashboard",
          "icon": "activity",
          "kind": "dashboard",
          "portalItemId": "0d57726c1d35415c916910f650723695",
          "portalHostKey": "moe"
        },
        {
          "id": "green-gicumbi",
          "name": "Green Gicumbi Project",
          "footerLabel": "Green Gicumbi Project",
          "type": "Experience",
          "icon": "map",
          "kind": "experience",
          "portalItemId": "6717c827c3674a8e923da8708f6bfcf3",
          "portalHostKey": "moe"
        }
      ]
    }
  ],
  "extensions": {
    "environment-mapping": {}
  }
}
