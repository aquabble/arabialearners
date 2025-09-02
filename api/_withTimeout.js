export async function withTimeout(promise, ms, onTimeout = () => ({})) {
  let to;
  const timeout = new Promise((resolve) => {
    to = setTimeout(() => resolve(onTimeout()), ms);
  });
  try {
    const res = await Promise.race([promise, timeout]);
    return res;
  } finally {
    clearTimeout(to);
  }
}
