// Stand-in for `next/dynamic` in the shareable redesign preview (esbuild alias): React.lazy with
// the loader's own loading component as the fallback.
import { lazy, Suspense, type ComponentType } from "react";

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>;

export default function dynamic<P extends object>(
  loader: Loader<P>,
  options: { loading?: ComponentType; ssr?: boolean } = {},
) {
  const Lazy = lazy(async () => {
    const loaded = await loader();
    return { default: "default" in loaded ? loaded.default : loaded };
  });
  const Fallback = options.loading;
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={Fallback ? <Fallback /> : null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
