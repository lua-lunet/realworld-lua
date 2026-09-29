/**
 * Pure pagination math for the Conduit pager. No fetch, no DOM.
 */

/**
 * @param {number} articlesCount
 * @param {number} limit
 * @returns {number} number of pages, at least 1
 */
export function totalPages(articlesCount, limit) {
  return Math.max(1, Math.ceil(articlesCount / Math.max(1, limit)));
}

/**
 * Pager page numbers: every page from 1 to pages (Conduit lists all pages).
 * @param {number} pages
 * @param {number} _current
 * @returns {number[]}
 */
export function pageItems(pages, _current) {
  return Array.from({ length: Math.max(1, pages) }, (_, i) => i + 1);
}

/**
 * @param {number} page
 * @param {number} limit
 * @returns {number} query offset for a page number (1-based)
 */
export function pageOffset(page, limit) {
  return (Math.max(1, page) - 1) * Math.max(1, limit);
}
