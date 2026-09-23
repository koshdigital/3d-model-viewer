// Deterrents against casual copying. They can't stop a determined user:
// anything a browser renders has already been downloaded.
export function protect() {
  const editable = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
  document.addEventListener('contextmenu', (e) => e.preventDefault())
  document.addEventListener('dragstart', (e) => e.preventDefault())
  document.addEventListener('copy', (e) => {
    if (!editable(e.target)) e.preventDefault()
  })
  document.addEventListener(
    'keydown',
    (e) => {
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      if (
        e.key === 'F12' ||
        (mod && (e.shiftKey || e.altKey) && ['i', 'j', 'c'].includes(k)) ||
        (mod && ['u', 's', 'p'].includes(k))
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    true
  )
}
