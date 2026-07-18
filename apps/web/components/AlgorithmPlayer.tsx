import { type CubeSize, type CubeState } from "@cuberub/cube-core";
import { renderCubeSvg } from "@cuberub/cube-render";
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

interface PlayerElement extends HTMLElement {
  disconnect?: () => void;
}

interface AlgorithmPlayerProps {
  readonly size: CubeSize;
  readonly algorithm: string;
  readonly fallbackState: CubeState;
  readonly ariaLabel: string;
}

export function AlgorithmPlayer({
  size,
  algorithm,
  fallbackState,
  ariaLabel,
}: AlgorithmPlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ready = useSignal(false);

  useEffect(() => {
    let active = true;
    let player: PlayerElement | null = null;
    void import("cubing/twisty")
      .then(({ TwistyPlayer }) => {
        if (!active || !hostRef.current) return;
        player = new TwistyPlayer({
          puzzle: size === 2 ? "2x2x2" : "3x3x3",
          alg: algorithm,
          visualization: "3D",
          background: "none",
          controlPanel: "bottom-row",
          hintFacelets: "floating",
          experimentalDragInput: "auto",
          cameraLatitude: 24,
          cameraLongitude: 32,
        }) as PlayerElement;
        player.style.width = "100%";
        player.style.height = "100%";
        hostRef.current.replaceChildren(player);
        ready.value = true;
      })
      .catch(() => {
        ready.value = false;
      });

    return () => {
      active = false;
      player?.disconnect?.();
      player?.remove();
    };
  }, [size, algorithm]);

  return (
    <div class="algorithm-player" aria-label={ariaLabel}>
      <div class="algorithm-player__host" ref={hostRef} />
      {!ready.value && (
        <div
          class="algorithm-player__fallback"
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{
            __html: renderCubeSvg({ size, state: fallbackState, ariaLabel }),
          }}
        />
      )}
    </div>
  );
}
