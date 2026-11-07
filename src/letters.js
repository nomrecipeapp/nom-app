// Letters for the Cookbook's A to Z rail. Titles starting with a number or symbol go under #.

export const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

export function letterOf(title) {
  const first = (title || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return first >= 'A' && first <= 'Z' ? first : '#'
}
