const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = args.map(arg => String(arg)).join(' ');
  if (msg.includes('non-boolean') && msg.includes('jsx')) return;
  originalError(...args);
};

const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = args.map(arg => String(arg)).join(' ');
  if (msg.includes('non-boolean') && msg.includes('jsx')) return;
  originalWarn(...args);
};
