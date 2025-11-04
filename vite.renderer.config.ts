import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig(async () => {
  // eslint-disable-next-line import/no-unresolved
  const tailwind = await import('@tailwindcss/vite');

  return {
    plugins: [tailwind.default?.()],
  };
});
