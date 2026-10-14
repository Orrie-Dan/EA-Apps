function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Lightweight structural check before merging a remote Runtime Config document.
 * Soft-open: sections are validated only when present (HARM-01).
 */
export function validateRuntimeConfigDocument(raw) {
  if (!isPlainObject(raw)) {
    return {
      valid: false,
      error: 'Runtime config must be a JSON object',
    }
  }

  if ('app' in raw && !isPlainObject(raw.app)) {
    return {
      valid: false,
      error: 'Runtime config app must be an object',
    }
  }

  if ('organization' in raw && !isPlainObject(raw.organization)) {
    return {
      valid: false,
      error: 'Runtime config organization must be an object',
    }
  }

  if ('contact' in raw && !isPlainObject(raw.contact)) {
    return {
      valid: false,
      error: 'Runtime config contact must be an object',
    }
  }

  if ('footer' in raw && !isPlainObject(raw.footer)) {
    return {
      valid: false,
      error: 'Runtime config footer must be an object',
    }
  }

  if ('legal' in raw && !isPlainObject(raw.legal)) {
    return {
      valid: false,
      error: 'Runtime config legal must be an object',
    }
  }

  if ('branding' in raw && !isPlainObject(raw.branding)) {
    return {
      valid: false,
      error: 'Runtime config branding must be an object',
    }
  }

  if ('extensions' in raw && !isPlainObject(raw.extensions)) {
    return {
      valid: false,
      error: 'Runtime config extensions must be an object',
    }
  }

  if ('modules' in raw && !Array.isArray(raw.modules)) {
    return {
      valid: false,
      error: 'Runtime config modules must be an array',
    }
  }

  return { valid: true, error: null }
}
