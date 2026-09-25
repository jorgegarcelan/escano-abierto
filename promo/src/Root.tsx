import { Composition } from "remotion";
import { Sneak, DURACION } from "./Sneak";

// 16:9 a 1920×1080: X lo muestra sin recortar en el móvil y en el escritorio.
export const Root = () => (
  <Composition id="Sneak" component={Sneak} durationInFrames={DURACION} fps={30} width={1920} height={1080} />
);
