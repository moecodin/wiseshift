// Put the cursor in the first field only where there is a real keyboard and mouse.
// On a phone, auto-focusing pops the on-screen keyboard over the page before anyone asked for it.
export const autoFocusOnDesktop = () => window.matchMedia?.('(pointer: fine)').matches ?? false
