// Lets a screen catch Back (button or swipe) while it's in the middle of something,
// like editing a recipe, so Back closes the editor instead of leaving the screen.
// A screen calls setBackGuard(fn) and gets back a function to remove it.
// fn should undo the in-progress thing and return true if it handled Back.

let guard = null

export function setBackGuard(fn) {
  guard = fn
  return () => { if (guard === fn) guard = null }
}

export function hasBackGuard() {
  return guard !== null
}

export function runBackGuard() {
  return guard ? guard() === true : false
}
