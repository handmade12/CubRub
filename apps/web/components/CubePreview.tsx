import { createSolvedCube, type CubeSize } from "@cuberub/cube-core";
import { renderCubeSvg } from "@cuberub/cube-render";

interface CubePreviewProps {
  size?: CubeSize;
  readonly ariaLabel?: string;
}

export function CubePreview({ size = 3, ariaLabel }: CubePreviewProps) {
  const state = createSolvedCube(size);
  const svg = renderCubeSvg({
    size,
    state,
    ariaLabel: ariaLabel ?? "Cube preview",
  });
  return (
    <div
      class={`cube-preview cube-preview--${size}`}
      role="img"
      aria-hidden={ariaLabel ? undefined : "true"}
      // deno-lint-ignore react-no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
