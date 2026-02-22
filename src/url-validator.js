/**
 * URL validation for QApp.
 *
 * Canonical source of truth for URL validation logic.
 * The same regex pattern is duplicated in qml/main.qml for QML use.
 * @module url-validator
 */

/** @type {RegExp} */
const URL_PATTERN =
  /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+([/\w\-._~:?#[\]@!$&'()*+,;=%]*)?$/;

/**
 * Check whether a string is a valid HTTP(S) URL.
 * @param {string} text - The string to validate.
 * @returns {boolean} True if the string matches a valid http/https URL pattern.
 */
export function isValidUrl(text) {
  if (text.length === 0) return false;
  return URL_PATTERN.test(text);
}
