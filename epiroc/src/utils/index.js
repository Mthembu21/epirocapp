// src/utils/index.js
export const createPageUrl = (pageName) => {
  if (!pageName || pageName === '/') return '/';
  const normalized = String(pageName).replace(/^\/+/, '');
  return `/#/${normalized}`;
};